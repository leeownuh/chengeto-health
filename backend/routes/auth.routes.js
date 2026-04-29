/**
 * CHENGETO Health - Authentication Routes
 * Handles user registration, login, token refresh, and MFA
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { body, param, query, validationResult } from 'express-validator';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import CheckIn from '../models/CheckIn.js';
import Alert from '../models/Alert.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';
import { authenticate, authorize, checkDeviceTrust } from '../middleware/auth.middleware.js';
import { authLimiter, sensitiveLimiter } from '../middleware/rateLimit.middleware.js';
import logger from '../config/logger.js';

const router = express.Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || process.env.REFRESH_TOKEN_EXPIRE || '7d';
const DEFAULT_ACTIVITY_LIMIT = 20;

const getQueryLimit = (value, fallback = DEFAULT_ACTIVITY_LIMIT) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : Math.max(1, Math.min(parsed, 100));
};

/**
 * Generate JWT tokens
 */
function generateTokens(user, { mfaVerified = false } = {}) {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    mfaVerified: Boolean(mfaVerified) || !user.mfaEnabled
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(
    { userId: user._id, mfaVerified: payload.mfaVerified },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

/**         xkxl x,,,mmmmmmmmmmm,m m,
 * Set token cookies
 */
function setTokenCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

async function createAuditLogSafe(payload) {
  try {
    await AuditLog.log(payload);
  } catch (error) {
    logger.warn('Audit log creation failed', {
      action: payload.action,
      error: error.message
    });
  }
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public (or Admin only in production)
 */
router.post('/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
    body('role').isIn(['admin', 'chw', 'caregiver', 'patient', 'family', 'clinician', 'auditor'])
      .withMessage('Valid role required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
    body('nationalId').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        role,
        phone,
        nationalId,
        location,
        assignedFacility,
        healthFacility
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = new User({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        phone,
        nationalId,
        location,
        healthFacility: healthFacility || assignedFacility,
        isEmailVerified: false,
        isActive: true,
        mfaEnabled: false,
        loginAttempts: 0,
        lockUntil: null
      });

      // Set role-specific permissions
      user.setPermissions();

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      await user.save();

      // Create audit log
      await AuditLog.create({
        action: 'USER_REGISTERED',
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        details: {
          message: `New user registered: ${email}`,
          role,
          registrationMethod: 'self'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`User registered: ${email} (${role})`);

      // Generate tokens for auto-login
      const { accessToken, refreshToken } = generateTokens(user);
      setTokenCookies(res, accessToken, refreshToken);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your email.',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            permissions: user.permissions
          },
          accessToken,
          refreshToken,
          verificationToken // In production, send via email
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 */
router.post('/login',
  sensitiveLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('deviceFingerprint').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password, deviceFingerprint, mfaCode } = req.body;

      // Find user
      const user = await User.findOne({ email }).select('+password +mfaSecret');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      let mfaVerified = !user.mfaEnabled;

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account locked due to too many failed attempts. Try again later.',
          lockUntil: user.lockUntil
        });
      }

      // Check if account is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Contact administrator.'
        });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        await user.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaCode) {
          return res.status(200).json({
            success: true,
            message: 'MFA code required',
            data: {
              requiresMFA: true,
              mfaEnabled: true
            }
          });
        }

        const isValidMFA = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: mfaCode,
          window: 1
        });

        if (!isValidMFA) {
          await user.incLoginAttempts();
          return res.status(401).json({
            success: false,
            message: 'Invalid MFA code'
          });
        }

        mfaVerified = true;
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Update last login
      user.lastLogin = {
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      
      const normalizedDeviceFingerprint = deviceFingerprint && typeof deviceFingerprint === 'object'
        ? {
            fingerprint: deviceFingerprint.fingerprint,
            name: deviceFingerprint.name || deviceFingerprint.userAgent || deviceFingerprint.platform || 'Trusted device',
            type: deviceFingerprint.type || 'browser',
            platform: deviceFingerprint.platform || null,
            browser: deviceFingerprint.browser || deviceFingerprint.userAgent || null,
            ipAddress: req.ip,
            addedAt: new Date(),
            lastUsed: new Date()
          }
        : null;

      // Handle device fingerprint
      if (normalizedDeviceFingerprint?.fingerprint && Array.isArray(user.trustedDevices)) {
        const existingDevice = user.trustedDevices.find(
          (device) => device.fingerprint === normalizedDeviceFingerprint.fingerprint
        );
        
        if (existingDevice) {
          existingDevice.lastUsed = new Date();
          existingDevice.ipAddress = req.ip;
          existingDevice.name = normalizedDeviceFingerprint.name || existingDevice.name;
          existingDevice.type = normalizedDeviceFingerprint.type || existingDevice.type;
          existingDevice.platform = normalizedDeviceFingerprint.platform || existingDevice.platform;
          existingDevice.browser = normalizedDeviceFingerprint.browser || existingDevice.browser;
        } else {
          user.trustedDevices.push(normalizedDeviceFingerprint);
        }
      }
      
      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user, { mfaVerified });
      setTokenCookies(res, accessToken, refreshToken);

      // Create audit log
      await createAuditLogSafe({
        action: AUDIT_ACTIONS.LOGIN,
        category: 'authentication',
        result: AUDIT_RESULT.SUCCESS,
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        target: {
          type: 'user',
          id: user._id,
          model: 'User',
          description: user.email
        },
        request: {
          method: req.method,
          endpoint: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        details: {
          message: `User logged in: ${email}`,
          loginMethod: user.mfaEnabled ? 'password+mfa' : 'password',
          deviceFingerprint: normalizedDeviceFingerprint?.fingerprint
        }
      });

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            permissions: user.permissions,
            mfaEnabled: user.mfaEnabled,
            mfaVerified,
            lastLogin: user.lastLogin
          },
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    const refreshMfaVerified = Boolean(decoded?.mfaVerified) || !user.mfaEnabled;

    // Generate new tokens
    const tokens = generateTokens(user, { mfaVerified: refreshMfaVerified });
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        mfaVerified: refreshMfaVerified
      }
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear tokens
 * @access  Private
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Create audit log
    await createAuditLogSafe({
      action: AUDIT_ACTIONS.LOGOUT,
      category: 'authentication',
      result: AUDIT_RESULT.SUCCESS,
      actor: {
        userId: req.user._id,
        email: req.user.email,
        role: req.user.role
      },
      target: {
        type: 'user',
        id: req.user._id,
        model: 'User',
        description: req.user.email
      },
      request: {
        method: req.method,
        endpoint: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      details: {
        message: `User logged out: ${req.user.email}`
      }
    });

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    logger.info(`User logged out: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * @route   POST /api/auth/mfa/setup
 * @desc    Setup MFA for user
 * @access  Private
 */
router.post('/mfa/setup', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+pendingMfaSecret');
    
    if (user.mfaEnabled) {
      return res.status(400).json({
        success: false,
        message: 'MFA is already enabled'
      });
    }

    // Generate MFA secret
    const secret = speakeasy.generateSecret({
      name: `CHENGETO Health (${user.email})`,
      length: 20
    });

    // Temporarily store secret (will be confirmed after verification)
    user.pendingMfaSecret = secret.base32;
    await user.save();

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      message: 'MFA setup initiated',
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      }
    });

  } catch (error) {
    logger.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'MFA setup failed'
    });
  }
});

/**
 * @route   POST /api/auth/mfa/verify
 * @desc    Verify and enable MFA
 * @access  Private
 */
router.post('/mfa/verify',
  authenticate,
  [body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit code required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { code } = req.body;
      const user = await User.findById(req.user._id).select('+pendingMfaSecret');

      if (!user.pendingMfaSecret) {
        return res.status(400).json({
          success: false,
          message: 'MFA setup not initiated'
        });
      }

      // Verify the code
      const isValid = speakeasy.totp.verify({
        secret: user.pendingMfaSecret,
        encoding: 'base32',
        token: code,
        window: 1
      });

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Enable MFA
      user.mfaSecret = user.pendingMfaSecret;
      user.mfaEnabled = true;
      user.pendingMfaSecret = undefined;

      const backupCodes = Array.from({ length: 8 }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
      user.mfaBackupCodes = backupCodes.map((value) => ({ code: value }));
      await user.save();

      await createAuditLogSafe({
        action: AUDIT_ACTIONS.MFA_ENABLED,
        category: 'authentication',
        result: AUDIT_RESULT.SUCCESS,
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        target: {
          type: 'user',
          id: user._id,
          model: 'User',
          description: user.email
        },
        request: {
          method: req.method,
          endpoint: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        details: {
          message: 'MFA enabled for account'
        }
      });

      res.json({
        success: true,
        message: 'MFA enabled successfully',
        data: {
          backupCodes
        }
      });

    } catch (error) {
      logger.error('MFA verification error:', error);
      res.status(500).json({
        success: false,
        message: 'MFA verification failed'
      });
    }
  }
);

/**
 * @route   POST /api/auth/mfa/disable
 * @desc    Disable MFA
 * @access  Private
 */
router.post('/mfa/disable',
  authenticate,
  [
    body('password').notEmpty().withMessage('Password required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit MFA code required')
  ],
  async (req, res) => {
    try {
      const { password, code } = req.body;
      const user = await User.findById(req.user._id).select('+password +mfaSecret');

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }

      // Verify MFA code
      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: code
      });

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid MFA code'
        });
      }

      // Disable MFA
      user.mfaSecret = undefined;
      user.mfaEnabled = false;
      user.mfaBackupCodes = [];
      await user.save();

      await createAuditLogSafe({
        action: AUDIT_ACTIONS.MFA_DISABLED,
        category: 'authentication',
        result: AUDIT_RESULT.SUCCESS,
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        target: {
          type: 'user',
          id: user._id,
          model: 'User',
          description: user.email
        },
        request: {
          method: req.method,
          endpoint: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        details: {
          message: 'MFA disabled for account'
        }
      });

      res.json({
        success: true,
        message: 'MFA disabled successfully'
      });

    } catch (error) {
      logger.error('MFA disable error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disable MFA'
      });
    }
  }
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
  async (req, res) => {
    try {
      const { email } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'If account exists, reset email has been sent'
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();

      // Create audit log
      await AuditLog.create({
        action: 'PASSWORD_RESET_REQUESTED',
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        details: {
          message: 'Password reset requested'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Password reset requested for: ${email}`);

      // In production, send email with reset link
      res.json({
        success: true,
        message: 'If account exists, reset email has been sent',
        data: {
          resetToken // In production, remove this and send via email
        }
      });

    } catch (error) {
      logger.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        message: 'Password reset request failed'
      });
    }
  }
);

/**
 * @route   GET /api/auth/reset-password/:token
 * @desc    Validate password reset token
 * @access  Public
 */
router.get('/reset-password/:token',
  [param('token').notEmpty().withMessage('Reset token required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      }).select('_id email');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      res.json({
        success: true,
        message: 'Reset token is valid'
      });
    } catch (error) {
      logger.error('Reset token validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate reset token'
      });
    }
  }
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  sensitiveLimiter,
  [
    body('token').notEmpty().withMessage('Reset token required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const { token, password } = req.body;

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();

      // Create audit log
      await AuditLog.create({
        action: 'PASSWORD_RESET_COMPLETED',
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        details: {
          message: 'Password reset completed'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      logger.info(`Password reset completed for: ${user.email}`);

      // Auto-login after reset
      const { accessToken, refreshToken } = generateTokens(user);
      setTokenCookies(res, accessToken, refreshToken);

      res.json({
        success: true,
        message: 'Password reset successful',
        data: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Password reset failed'
      });
    }
  }
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -mfaSecret -emailVerificationToken -passwordResetToken');

    res.json({
      success: true,
      data: {
        ...(user?.toObject ? user.toObject() : user),
        mfaVerified: Boolean(req.tokenDecoded?.mfaVerified) || !user.mfaEnabled
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
});

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me',
  authenticate,
  [
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('address').optional().isObject(),
    body('language').optional().isIn(['en', 'sn', 'nd']),
    body('location').optional().isObject(),
    body('preferences').optional().isObject(),
    body('bio').optional().isString(),
    body('specialization').optional().isString(),
    body('qualification').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const allowedUpdates = [
        'email',
        'firstName',
        'lastName',
        'phone',
        'address',
        'language',
        'location',
        'preferences',
        'bio',
        'specialization',
        'qualification'
      ];
      const updates = {};
      
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (updates.email && updates.email !== user.email) {
        const existingUser = await User.findOne({
          email: updates.email,
          _id: { $ne: user._id }
        }).select('_id');

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'A user with that email already exists'
          });
        }
      }

      Object.assign(user, updates);
      await user.save();

      const updatedUser = await User.findById(user._id).select(
        '-password -mfaSecret -pendingMfaSecret -emailVerificationToken -passwordResetToken'
      );

      // Create audit log
      await createAuditLogSafe({
        action: AUDIT_ACTIONS.USER_UPDATE,
        category: 'user_management',
        result: AUDIT_RESULT.SUCCESS,
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        target: {
          type: 'user',
          id: user._id,
          model: 'User',
          description: user.email
        },
        request: {
          method: req.method,
          endpoint: req.originalUrl,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        details: {
          message: 'Profile updated',
          updatedFields: Object.keys(updates)
        }
      });

      res.json({
        success: true,
        message: 'Profile updated',
        data: updatedUser
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }
);

/**
 * @route   GET /api/auth/stats
 * @desc    Get current user activity stats for profile pages
 * @access  Private
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const currentUser = await User.findById(userId).lean();

    let totalCheckIns = 0;
    let patientsHelped = 0;
    let alertsResolved = 0;
    let hoursActive = 0;

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (['caregiver', 'chw', 'admin'].includes(currentUser.role)) {
      const checkIns = await CheckIn.find({
        caregiver: userId,
        status: 'completed'
      }).select('patient duration').lean();

      totalCheckIns = checkIns.length;
      patientsHelped = new Set(checkIns.map((entry) => entry.patient?.toString()).filter(Boolean)).size;
      hoursActive = Math.round(((checkIns.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0) / 60) || 0) * 10) / 10;
    }

    if (currentUser.role === 'chw' && patientsHelped === 0) {
      patientsHelped = await Patient.countDocuments({ assignedCHW: userId });
    }

    if (currentUser.role === 'clinician') {
      patientsHelped = await Patient.countDocuments({ assignedClinician: userId });
    }

    if (currentUser.role === 'family') {
      const linkedPatients = Array.isArray(currentUser.linkedPatients) ? currentUser.linkedPatients : [];
      const linkedIds = linkedPatients
        .map((link) => link?.patient || link)
        .filter(Boolean)
        .map((value) => value.toString());

      patientsHelped = new Set(linkedIds).size;
      totalCheckIns = await CheckIn.countDocuments({
        patient: { $in: linkedIds },
        status: 'completed'
      });
    }

    if (currentUser.role === 'admin') {
      patientsHelped = await Patient.countDocuments();
      alertsResolved = await Alert.countDocuments({ 'resolution.resolvedBy': userId });
    } else if (['caregiver', 'chw', 'clinician'].includes(currentUser.role)) {
      alertsResolved = await Alert.countDocuments({ 'resolution.resolvedBy': userId });
    }

    res.json({
      success: true,
      data: {
        totalCheckIns,
        patientsHelped,
        alertsResolved,
        hoursActive
      }
    });
  } catch (error) {
    logger.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user stats'
    });
  }
});

/**
 * @route   GET /api/auth/activity
 * @desc    Get current user activity timeline for profile pages
 * @access  Private
 */
router.get('/activity',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const limit = getQueryLimit(req.query.limit, DEFAULT_ACTIVITY_LIMIT);
      const auditActivity = await AuditLog.getUserActivity(req.user._id, { limit });
      let activities = auditActivity.map((entry) => ({
        _id: entry._id,
        type: mapAuditActionToType(entry.action),
        description: entry.details?.message || formatAuditAction(entry.action),
        timestamp: entry.timestamp
      }));

      if (activities.length === 0) {
        const [checkIns, resolvedAlerts] = await Promise.all([
          CheckIn.find({
            caregiver: req.user._id,
            status: 'completed'
          })
            .sort({ actualTime: -1, createdAt: -1 })
            .limit(limit)
            .populate('patient', 'firstName lastName')
            .lean(),
          Alert.find({ 'resolution.resolvedBy': req.user._id })
            .sort({ 'resolution.resolvedAt': -1, updatedAt: -1 })
            .limit(limit)
            .populate('patient', 'firstName lastName')
            .lean()
        ]);

        activities = [
          ...checkIns.map((entry) => ({
            _id: entry._id,
            type: 'checkin',
            description: `Completed check-in for ${entry.patient?.firstName || 'Unknown'} ${entry.patient?.lastName || 'patient'}`.trim(),
            timestamp: entry.actualTime || entry.createdAt
          })),
          ...resolvedAlerts.map((entry) => ({
            _id: entry._id,
            type: 'alert',
            description: `Resolved ${entry.severity || ''} alert for ${entry.patient?.firstName || 'Unknown'} ${entry.patient?.lastName || 'patient'}`.trim(),
            timestamp: entry.resolution?.resolvedAt || entry.updatedAt || entry.createdAt
          }))
        ]
          .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
          .slice(0, limit);
      }

      res.json({
        success: true,
        data: {
          activities
        }
      });
    } catch (error) {
      logger.error('Get user activity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user activity'
      });
    }
  }
);

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 */
router.put('/password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.user._id).select('+password');
      
      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash and save new password
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      // Create audit log
      await AuditLog.create({
        action: 'PASSWORD_CHANGED',
        actor: {
          userId: user._id,
          email: user.email,
          role: user.role
        },
        details: {
          message: 'Password changed'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }
  }
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email',
  [body('token').notEmpty().withMessage('Verification token required')],
  async (req, res) => {
    try {
      const { token } = req.body;
      
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Email verification failed'
      });
    }
  }
);

/**
 * @route   GET /api/auth/verify-token
 * @desc    Verify if access token is valid
 * @access  Private
 */
router.get('/verify-token', authenticate, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions
      }
    }
  });
});

function mapAuditActionToType(action = '') {
  const normalized = action.toLowerCase();

  if (normalized.includes('checkin')) {
    return 'checkin';
  }

  if (normalized.includes('alert')) {
    return 'alert';
  }

  if (normalized.includes('patient')) {
    return 'patient';
  }

  if (normalized.includes('schedule')) {
    return 'schedule';
  }

  return 'activity';
}

function formatAuditAction(action = '') {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default router;

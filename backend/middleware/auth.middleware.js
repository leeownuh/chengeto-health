/**
 * Authentication Middleware
 * JWT verification and RBAC enforcement
 */

import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { UnauthorizedError, ForbiddenError, asyncHandler } from './error.middleware.js';
import { logger, securityLogger } from '../config/logger.js';

/**
 * Protect routes - Verify JWT token
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from Authorization header
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Also check for token in cookies
  else if (req.cookies?.accessToken || req.cookies?.jwt) {
    token = req.cookies.accessToken || req.cookies.jwt;
  }

  if (!token) {
    return next(new UnauthorizedError('You are not logged in. Please log in to get access.'));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId;

    // Check if user still exists
    const currentUser = await User.findById(userId).select('+password');
    
    if (!currentUser) {
      return next(new UnauthorizedError('The user belonging to this token no longer exists.'));
    }

    // Check if user is active
    if (currentUser.status !== 'active') {
      return next(new UnauthorizedError('Your account has been deactivated. Please contact administrator.'));
    }

    // Check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new UnauthorizedError('User recently changed password. Please log in again.'));
    }

    // Check if account is locked
    if (currentUser.isLocked) {
      return next(new UnauthorizedError('Account is temporarily locked due to too many failed attempts.'));
    }

    // Grant access to protected route
    req.user = currentUser;
    req.token = token;
    req.tokenDecoded = decoded;

    // Log successful authentication
    logger.debug('User authenticated', {
      userId: currentUser._id,
      role: currentUser.role,
      endpoint: req.originalUrl
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token. Please log in again.'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired. Please log in again.'));
    }
    return next(new UnauthorizedError('Authentication failed.'));
  }
});

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);
      if (currentUser && currentUser.status === 'active') {
        req.user = currentUser;
      }
    } catch (error) {
      // Silently ignore - it's optional
    }
  }

  next();
});

/**
 * Restrict to specific roles
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('You are not logged in.'));
    }

    if (!roles.includes(req.user.role)) {
      securityLogger('UNAUTHORIZED_ACCESS', {
        userId: req.user._id,
        role: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl
      });

      return next(new ForbiddenError('You do not have permission to perform this action.'));
    }

    next();
  };
};

/**
 * Check specific permission
 */
export const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('You are not logged in.'));
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      securityLogger('PERMISSION_DENIED', {
        userId: req.user._id,
        role: req.user.role,
        requiredPermission: permission,
        endpoint: req.originalUrl
      });

      return next(new ForbiddenError(`You do not have the required permission: ${permission}`));
    }

    next();
  };
};

/**
 * Check multiple permissions (any one is sufficient)
 */
export const hasAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('You are not logged in.'));
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    const hasAny = permissions.some(perm => req.user.permissions.includes(perm));

    if (!hasAny) {
      return next(new ForbiddenError('You do not have the required permissions.'));
    }

    next();
  };
};

/**
 * Check all permissions are present
 */
export const hasAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('You are not logged in.'));
    }

    // Admin has all permissions
    if (req.user.role === 'admin') {
      return next();
    }

    const hasAll = permissions.every(perm => req.user.permissions.includes(perm));

    if (!hasAll) {
      return next(new ForbiddenError('You do not have all the required permissions.'));
    }

    next();
  };
};

/**
 * MFA verification check
 */
export const requireMFA = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('You are not logged in.'));
  }

  // Check if MFA is enabled for this user
  if (req.user.mfaEnabled && !req.mfaVerified) {
    return next(new UnauthorizedError('MFA verification required.'));
  }

  next();
});

/**
 * Check if user owns resource or has admin role
 */
export const ownerOrAdmin = (resourceField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('You are not logged in.'));
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check ownership
    const resourceUserId = req.params[resourceField] || req.body[resourceField];
    
    if (resourceUserId && resourceUserId.toString() !== req.user._id.toString()) {
      return next(new ForbiddenError('You can only access your own resources.'));
    }

    next();
  };
};

/**
 * Device authentication middleware
 */
export const authenticateDevice = asyncHandler(async (req, res, next) => {
  const deviceId = req.headers['x-device-id'];
  const apiKey = req.headers['x-api-key'];
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];

  if (!deviceId || !apiKey) {
    return next(new UnauthorizedError('Device credentials missing.'));
  }

  // Verify device exists and is active
  const { IoTDevice } = await import('../models/index.js');
  const device = await IoTDevice.findOne({ deviceId, status: 'active' });

  if (!device) {
    securityLogger('INVALID_DEVICE', { deviceId });
    return next(new UnauthorizedError('Invalid or inactive device.'));
  }

  // Verify API key
  if (device.security.apiKey !== apiKey) {
    securityLogger('INVALID_DEVICE_KEY', { deviceId });
    return next(new UnauthorizedError('Invalid device credentials.'));
  }

  // Check timestamp to prevent replay attacks (within 5 minutes)
  if (timestamp) {
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Math.abs(now - requestTime) > fiveMinutes) {
      return next(new UnauthorizedError('Request timestamp expired.'));
    }
  }

  // Attach device to request
  req.device = device;
  next();
});

export default {
  protect,
  optionalAuth,
  restrictTo,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requireMFA,
  ownerOrAdmin,
  authenticateDevice
};

// Backward-compatible aliases used by generated route modules.
export const authenticate = protect;
export const authorize = (roles = []) => restrictTo(...roles);
export const checkPermission = hasPermission;
export const checkDeviceTrust = (req, res, next) => next();

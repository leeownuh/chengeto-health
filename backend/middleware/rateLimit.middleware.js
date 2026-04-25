/**
 * Rate Limiting Middleware
 * Prevents brute force and DoS attacks
 */

import rateLimit from 'express-rate-limit';
import { logger } from '../config/logger.js';

const LOCAL_HOST_PATTERN = /(^|:\/\/)(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i;

const normalizeIp = (ip = '') => ip.replace(/^::ffff:/, '');

const isLocalRequest = (req) => {
  const ip = normalizeIp(req.ip || '');
  const host = req.get('host') || '';
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';

  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    LOCAL_HOST_PATTERN.test(host) ||
    LOCAL_HOST_PATTERN.test(origin) ||
    LOCAL_HOST_PATTERN.test(referer)
  );
};

// General API rate limiter
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  skip: isLocalRequest,
  message: {
    status: 'error',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      status: 'error',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    });
  }
});

// Strict rate limiter for authentication routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  skip: isLocalRequest,
  message: {
    status: 'error',
    errorCode: 'TOO_MANY_ATTEMPTS',
    message: 'Too many login attempts, please try again after 15 minutes.'
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email
    });
    res.status(429).json({
      status: 'error',
      errorCode: 'TOO_MANY_ATTEMPTS',
      message: 'Too many login attempts, please try again after 15 minutes.'
    });
  }
});

// IoT device rate limiter
export const iotRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // IoT devices can send more frequent updates
  keyGenerator: (req) => {
    return req.headers['x-device-id'] || req.ip;
  },
  handler: (req, res) => {
    logger.warn('IoT rate limit exceeded', {
      deviceId: req.headers['x-device-id'],
      ip: req.ip
    });
    res.status(429).json({
      status: 'error',
      errorCode: 'DEVICE_RATE_LIMIT',
      message: 'Device sending too many requests.'
    });
  }
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  skip: isLocalRequest,
  message: {
    status: 'error',
    errorCode: 'TOO_MANY_RESETS',
    message: 'Too many password reset attempts, please try again later.'
  }
});

// API key creation limiter
export const apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 API key operations per hour
  skip: isLocalRequest,
  message: {
    status: 'error',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many API key operations.'
  }
});

export default {
  rateLimiter,
  authRateLimiter,
  iotRateLimiter,
  passwordResetLimiter,
  apiKeyLimiter
};

// Backward-compatible aliases used by route modules.
export const authLimiter = authRateLimiter;
export const sensitiveLimiter = authRateLimiter;

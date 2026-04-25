/**
 * Middleware Index
 */

export * from './auth.middleware.js';
export * from './error.middleware.js';
export * from './rateLimit.middleware.js';

import { protect, optionalAuth, restrictTo, hasPermission, hasAnyPermission, hasAllPermissions, requireMFA, ownerOrAdmin, authenticateDevice } from './auth.middleware.js';
import { APIError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError, RateLimitError, notFoundHandler, globalErrorHandler, asyncHandler } from './error.middleware.js';
import { rateLimiter, authRateLimiter, iotRateLimiter, passwordResetLimiter, apiKeyLimiter } from './rateLimit.middleware.js';

export default {
  // Auth
  protect,
  optionalAuth,
  restrictTo,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requireMFA,
  ownerOrAdmin,
  authenticateDevice,
  
  // Error
  APIError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  RateLimitError,
  notFoundHandler,
  globalErrorHandler,
  asyncHandler,
  
  // Rate Limiting
  rateLimiter,
  authRateLimiter,
  iotRateLimiter,
  passwordResetLimiter,
  apiKeyLimiter
};
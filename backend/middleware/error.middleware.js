/**
 * Error Handling Middleware
 * Global error handler and 404 handler
 */

import { logger } from '../config/logger.js';

/**
 * Custom API Error class
 */
export class APIError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Specific error classes
 */
export class NotFoundError extends APIError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends APIError {
  constructor(message = 'Forbidden - Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends APIError {
  constructor(errors = []) {
    super('Validation failed', 400, 'VALIDATION_ERROR', errors);
  }
}

export class ConflictError extends APIError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends APIError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Not found handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

/**
 * Global error handler
 */
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // Log error
  if (err.statusCode >= 500) {
    logger.error('Server Error:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      user: req.user?.id
    });
  } else {
    logger.warn('Client Error:', {
      message: err.message,
      statusCode: err.statusCode,
      url: req.originalUrl
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for ${field}. Please use another value.`;
    return res.status(400).json({
      status: 'fail',
      errorCode: 'DUPLICATE_KEY',
      message,
      field
    });
  }

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      status: 'fail',
      errorCode: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      errorCode: 'INVALID_TOKEN',
      message: 'Invalid token. Please log in again.'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      errorCode: 'TOKEN_EXPIRED',
      message: 'Token expired. Please log in again.'
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'fail',
      errorCode: 'INVALID_ID',
      message: `Invalid ${err.path}: ${err.value}`
    });
  }

  // Operational error - safe to send to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      errorCode: err.errorCode,
      message: err.message,
      details: err.details
    });
  }

  // Programming error - don't leak details
  return res.status(500).json({
    status: 'error',
    errorCode: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
};

/**
 * Async handler wrapper
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Catch 404 for API routes
 */
export const apiNotFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    errorCode: 'NOT_FOUND',
    message: `API endpoint ${req.method} ${req.originalUrl} not found`
  });
};

export default {
  APIError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  RateLimitError,
  notFoundHandler,
  globalErrorHandler,
  asyncHandler
};
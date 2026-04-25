/**
 * Winston Logger Configuration
 * Structured logging with multiple transports
 */

import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const meta = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '';
    return `[${timestamp}] ${level}: ${message} ${meta}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'chengeto-health' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      handleExceptions: true,
      handleRejections: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for errors only
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 5242880,
      maxFiles: 5
    }),
    
    // File transport for audit logs
    new winston.transports.File({
      filename: join(logsDir, 'audit.log'),
      level: 'info',
      format: customFormat,
      maxsize: 5242880,
      maxFiles: 10
    })
  ],
  exitOnError: false
});

// Morgan stream for HTTP request logging
export const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Security audit logger
export const auditLogger = (action, details) => {
  logger.info('AUDIT', {
    type: 'AUDIT',
    action,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Security event logger
export const securityLogger = (event, details) => {
  logger.warn('SECURITY', {
    type: 'SECURITY',
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

// Performance logger
export const performanceLogger = (operation, duration, details = {}) => {
  logger.debug('PERFORMANCE', {
    type: 'PERFORMANCE',
    operation,
    durationMs: duration,
    ...details
  });
};

export default logger;

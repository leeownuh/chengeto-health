/**
 * Audit Log Model
 * Immutable audit trail for compliance and security
 */

import mongoose, { Schema } from 'mongoose';

// Audit action types
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  PASSWORD_CHANGE: 'password_change',
  MFA_ENABLED: 'mfa_enabled',
  MFA_DISABLED: 'mfa_disabled',
  
  // User Management
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_SUSPEND: 'user_suspend',
  USER_ACTIVATE: 'user_activate',
  ROLE_CHANGE: 'role_change',
  
  // Patient Management
  PATIENT_CREATE: 'patient_create',
  PATIENT_UPDATE: 'patient_update',
  PATIENT_DELETE: 'patient_delete',
  PATIENT_VIEW: 'patient_view',
  
  // Check-in Actions
  CHECKIN_CREATE: 'checkin_create',
  CHECKIN_UPDATE: 'checkin_update',
  CHECKIN_VERIFY: 'checkin_verify',
  CHECKIN_MISS: 'checkin_miss',
  
  // Alert Actions
  ALERT_TRIGGER: 'alert_trigger',
  ALERT_ACKNOWLEDGE: 'alert_acknowledge',
  ALERT_ESCALATE: 'alert_escalate',
  ALERT_RESOLVE: 'alert_resolve',
  
  // Device Actions
  DEVICE_REGISTER: 'device_register',
  DEVICE_PAIR: 'device_pair',
  DEVICE_UNPAIR: 'device_unpair',
  DEVICE_OFFLINE: 'device_offline',
  
  // Blockchain Actions
  BLOCKCHAIN_WRITE: 'blockchain_write',
  BLOCKCHAIN_VERIFY: 'blockchain_verify',
  
  // Data Access
  DATA_EXPORT: 'data_export',
  DATA_ACCESS: 'data_access',
  
  // System Actions
  CONFIG_CHANGE: 'config_change',
  SCHEDULE_CHANGE: 'schedule_change',
  
  // Security Events
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
};

// Audit result
export const AUDIT_RESULT = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  PARTIAL: 'partial'
};

const auditLogSchema = new Schema({
  // Log ID
  logId: {
    type: String,
    unique: true
  },
  
  // Timestamp (immutable)
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  
  // Action Information
  action: {
    type: String,
    enum: Object.values(AUDIT_ACTIONS),
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['authentication', 'user_management', 'patient_management', 'checkin', 'alert', 'device', 'blockchain', 'data_access', 'system', 'security'],
    required: true
  },
  result: {
    type: String,
    enum: Object.values(AUDIT_RESULT),
    required: true
  },
  
  // Actor Information
  actor: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    role: String,
    deviceId: String
  },
  
  // Target Information
  target: {
    type: {
      type: String,
      enum: ['user', 'patient', 'checkin', 'alert', 'device', 'schedule', 'system', 'other']
    },
    id: Schema.Types.ObjectId,
    model: String,
    description: String
  },
  
  // Request Details
  request: {
    method: String,
    endpoint: String,
    userAgent: String,
    ipAddress: {
      type: String,
      required: true
    },
    sourcePort: Number
  },
  
  // Changes Made (for updates)
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    diff: Schema.Types.Mixed
  },
  
  // Additional Details
  details: Schema.Types.Mixed,
  
  // Error Information (for failures)
  error: {
    code: String,
    message: String,
    stack: String
  },
  
  // Session Information
  session: {
    sessionId: String,
    jwtId: String,
    deviceType: String,
    browser: String,
    os: String
  },
  
  // Location Information
  location: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number
  },
  
  // Blockchain Reference
  blockchain: {
    recorded: { type: Boolean, default: false },
    transactionHash: String,
    blockNumber: Number
  },
  
  // Retention
  retentionPeriod: {
    type: Number,
    default: 2555 // 7 years in days
  }
}, {
  timestamps: false,
  collection: 'audit_logs'
});

// Indexes
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ 'actor.userId': 1, timestamp: -1 });
auditLogSchema.index({ 'target.id': 1, timestamp: -1 });
auditLogSchema.index({ 'request.ipAddress': 1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ result: 1 });

// Compound indexes for common queries
auditLogSchema.index({ action: 1, 'actor.userId': 1, timestamp: -1 });
auditLogSchema.index({ category: 1, result: 1, timestamp: -1 });

// Static method to generate log ID
auditLogSchema.statics.generateLogId = async function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AUD-${year}${month}${day}-${random}`;
};

// Static method to log audit event
auditLogSchema.statics.log = async function(data) {
  const log = new this(data);
  log.logId = await this.generateLogId();
  return log.save();
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const { limit = 50, skip = 0, startDate, endDate } = options;
  
  const query = { 'actor.userId': userId };
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to get security events
auditLogSchema.statics.getSecurityEvents = async function(options = {}) {
  const { limit = 100, startDate, endDate } = options;
  
  const query = { category: 'security' };
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = startDate;
    if (endDate) query.timestamp.$lte = endDate;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  if (!this.logId) {
    this.logId = `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Make collection immutable (no updates or deletes)
auditLogSchema.pre('findOneAndUpdate', function(next) {
  const error = new Error('Audit logs cannot be modified');
  error.status = 403;
  next(error);
});

auditLogSchema.pre('deleteOne', function(next) {
  const error = new Error('Audit logs cannot be deleted');
  error.status = 403;
  next(error);
});

auditLogSchema.pre('deleteMany', function(next) {
  const error = new Error('Audit logs cannot be deleted');
  error.status = 403;
  next(error);
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
/**
 * Alert Model
 * Handles emergency alerts with escalation system
 */

import mongoose, { Schema } from 'mongoose';

// Alert types enum
export const ALERT_TYPES = {
  PANIC: 'panic',
  FALL_DETECTED: 'fall_detected',
  INACTIVITY: 'inactivity',
  VITAL_SIGN: 'vital_sign',
  MISSED_CHECKIN: 'missed_checkin',
  DEVICE_OFFLINE: 'device_offline',
  MEDICATION_MISSED: 'medication_missed',
  LOW_BATTERY: 'low_battery'
};

// Alert severity levels
export const ALERT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Escalation levels
export const ESCALATION_LEVELS = {
  LEVEL_0: 0, // Initial - No escalation
  LEVEL_1: 1, // Caregiver (0-5 min)
  LEVEL_2: 2, // CHW (5-15 min)
  LEVEL_3: 3  // Clinician/Admin (15+ min)
};

// Alert status
export const ALERT_STATUS = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  FALSE_ALARM: 'false_alarm',
  CLOSED: 'closed'
};

const alertSchema = new Schema({
  // Alert Identification
  alertId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Patient Reference
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required'],
    index: true
  },
  
  // Alert Type and Severity
  type: {
    type: String,
    enum: Object.values(ALERT_TYPES),
    required: [true, 'Alert type is required']
  },
  severity: {
    type: String,
    enum: Object.values(ALERT_SEVERITY),
    default: ALERT_SEVERITY.MEDIUM
  },
  
  // Alert Details
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  
  // Source Information
  source: {
    type: {
      type: String,
      enum: ['manual', 'sensor', 'system', 'schedule']
    },
    deviceId: String,
    sensorType: String,
    triggerValue: Schema.Types.Mixed
  },
  
  // Location at time of alert
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String
  },
  
  // Vital Signs at Alert Time
  vitalSnapshot: {
    heartRate: Number,
    bloodPressure: {
      systolic: Number,
      diastolic: Number
    },
    oxygenSaturation: Number,
    temperature: Number,
    lastMotion: Date
  },
  
  // Status and Acknowledgement
  status: {
    type: String,
    enum: Object.values(ALERT_STATUS),
    default: ALERT_STATUS.PENDING
  },
  
  // Escalation Tracking
  escalation: {
    currentLevel: {
      type: Number,
      default: ESCALATION_LEVELS.LEVEL_0
    },
    history: [{
      level: Number,
      escalatedAt: Date,
      escalatedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      role: String,
      reason: String,
      notificationSent: Boolean,
      channels: [String] // push, sms, ussd
    }],
    nextEscalationAt: Date
  },
  
  // Acknowledgements
  acknowledgements: [{
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: String,
    acknowledgedAt: {
      type: Date,
      default: Date.now
    },
    responseTime: Number, // seconds from alert creation
    notes: String,
    actionTaken: String,
    location: {
      latitude: Number,
      longitude: Number
    }
  }],
  
  // Resolution
  resolution: {
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolutionType: {
      type: String,
      enum: ['resolved', 'false_alarm', 'transferred', 'no_action_needed']
    },
    resolutionNotes: String,
    followUpRequired: Boolean,
    followUpDate: Date,
    outcome: String
  },
  
  // Notification Tracking
  notifications: [{
    channel: {
      type: String,
      enum: ['push', 'sms', 'ussd', 'email', 'in_app']
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    recipientPhone: String,
    sentAt: Date,
    deliveredAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    },
    failureReason: String,
    messageId: String
  }],
  
  // Related Entities
  relatedCheckin: {
    type: Schema.Types.ObjectId,
    ref: 'CheckIn'
  },
  relatedAlerts: [{
    type: Schema.Types.ObjectId,
    ref: 'Alert'
  }],
  
  // Blockchain Record
  blockchainRecord: {
    transactionHash: String,
    blockNumber: Number,
    recordedAt: Date,
    dataHash: String
  },
  
  // Audit Trail
  auditLog: [{
    action: String,
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { type: Date, default: Date.now },
    details: Schema.Types.Mixed
  }],
  
  // Suppression (for alert fatigue management)
  suppressed: {
    isSuppressed: { type: Boolean, default: false },
    suppressedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    suppressedUntil: Date
  },
  
  // Priority Score (calculated)
  priorityScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
alertSchema.index({ patient: 1, createdAt: -1 });
alertSchema.index({ status: 1 });
alertSchema.index({ type: 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ 'escalation.currentLevel': 1 });
alertSchema.index({ 'escalation.nextEscalationAt': 1 });
alertSchema.index({ createdAt: -1 });

// Compound indexes for efficient queries
alertSchema.index({ patient: 1, status: 1, createdAt: -1 });
alertSchema.index({ status: 1, severity: 1, createdAt: -1 });

// Virtual for response time
alertSchema.virtual('totalResponseTime').get(function() {
  if (!this.resolution?.resolvedAt) return null;
  return Math.floor((this.resolution.resolvedAt - this.createdAt) / 1000);
});

// Virtual for time since creation
alertSchema.virtual('timeSinceCreation').get(function() {
  return Math.floor((Date.now() - this.createdAt) / 1000);
});

// Static method to generate alert ID
alertSchema.statics.generateAlertId = async function() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(year, date.getMonth(), date.getDate()),
      $lt: new Date(year, date.getMonth(), date.getDate() + 1)
    }
  });
  return `ALT-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
};

// Method to acknowledge alert
alertSchema.methods.acknowledge = async function(userId, role, notes = '', actionTaken = '') {
  const responseTime = Math.floor((Date.now() - this.createdAt) / 1000);
  
  this.acknowledgements.push({
    acknowledgedBy: userId,
    role,
    acknowledgedAt: new Date(),
    responseTime,
    notes,
    actionTaken
  });
  
  // Update status
  if (this.status === ALERT_STATUS.PENDING) {
    this.status = ALERT_STATUS.ACKNOWLEDGED;
  }
  
  // Add to audit log
  this.auditLog.push({
    action: 'acknowledged',
    actor: userId,
    timestamp: new Date(),
    details: { notes, actionTaken }
  });
  
  return this.save();
};

// Method to escalate alert
alertSchema.methods.escalate = async function(level, escalatedTo, reason = '') {
  const now = new Date();
  
  this.escalation.currentLevel = level;
  this.escalation.history.push({
    level,
    escalatedAt: now,
    escalatedTo,
    reason,
    notificationSent: false,
    channels: []
  });
  
  this.status = ALERT_STATUS.ESCALATED;
  
  // Calculate next escalation time if not at max level
  if (level < ESCALATION_LEVELS.LEVEL_3) {
    const timeoutMinutes = level === ESCALATION_LEVELS.LEVEL_1 ? 5 : 10;
    this.escalation.nextEscalationAt = new Date(now.getTime() + timeoutMinutes * 60000);
  }
  
  // Add to audit log
  this.auditLog.push({
    action: 'escalated',
    timestamp: now,
    details: { level, reason }
  });
  
  return this.save();
};

// Method to resolve alert
alertSchema.methods.resolve = async function(userId, resolutionType, notes = '') {
  const now = new Date();
  
  this.resolution = {
    resolvedBy: userId,
    resolvedAt: now,
    resolutionType,
    resolutionNotes: notes
  };
  
  this.status = ALERT_STATUS.RESOLVED;
  
  // Add to audit log
  this.auditLog.push({
    action: 'resolved',
    actor: userId,
    timestamp: now,
    details: { resolutionType, notes }
  });
  
  return this.save();
};

// Method to calculate priority score
alertSchema.methods.calculatePriorityScore = function() {
  let score = 0;
  
  // Severity weight
  const severityWeights = {
    [ALERT_SEVERITY.CRITICAL]: 40,
    [ALERT_SEVERITY.HIGH]: 30,
    [ALERT_SEVERITY.MEDIUM]: 20,
    [ALERT_SEVERITY.LOW]: 10
  };
  score += severityWeights[this.severity] || 0;
  
  // Type weight
  const typeWeights = {
    [ALERT_TYPES.PANIC]: 30,
    [ALERT_TYPES.FALL_DETECTED]: 25,
    [ALERT_TYPES.VITAL_SIGN]: 20,
    [ALERT_TYPES.INACTIVITY]: 15,
    [ALERT_TYPES.MISSED_CHECKIN]: 10,
    [ALERT_TYPES.DEVICE_OFFLINE]: 5
  };
  score += typeWeights[this.type] || 0;
  
  // Time factor (alerts pending longer get higher priority)
  const createdAtMs = this.createdAt ? new Date(this.createdAt).getTime() : Date.now();
  const minutesPending = Math.floor((Date.now() - createdAtMs) / 60000);
  score += Math.min(minutesPending, 30);
  
  // Escalation level factor
  score += this.escalation.currentLevel * 5;
  
  this.priorityScore = score;
  return score;
};

// Generate required IDs before validation so new alerts can pass schema checks.
alertSchema.pre('validate', function(next) {
  if (this.isNew && !this.alertId) {
    this.constructor.generateAlertId()
      .then((id) => {
        this.alertId = id;
        next();
      })
      .catch(next);
    return;
  }

  next();
});

// Pre-save middleware
alertSchema.pre('save', function(next) {
  this.calculatePriorityScore();
  next();
});

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;

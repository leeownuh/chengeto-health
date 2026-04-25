/**
 * Care Schedule Model
 * Manages care routines, check-in windows, and medication reminders
 */

import mongoose, { Schema } from 'mongoose';

// Schedule status
export const SCHEDULE_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
  CANCELLED: 'cancelled'
};

// Day of week enum
export const DAYS_OF_WEEK = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday'
};

const checkinWindowSchema = new Schema({
  name: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true
  },
  startTime: {
    type: String, // HH:mm format
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  endTime: {
    type: String,
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  },
  gracePeriod: {
    type: Number, // minutes
    default: 15
  },
  required: {
    type: Boolean,
    default: true
  },
  days: [{
    type: String,
    enum: Object.values(DAYS_OF_WEEK)
  }],
  assignedCaregiver: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

const medicationReminderSchema = new Schema({
  medication: {
    type: String,
    required: true
  },
  dosage: String,
  unit: String,
  time: {
    type: String, // HH:mm format
    required: true
  },
  withFood: {
    type: Boolean,
    default: false
  },
  instructions: String,
  active: {
    type: Boolean,
    default: true
  },
  adherenceRule: {
    type: String,
    enum: ['required', 'optional', 'as_needed'],
    default: 'required'
  },
  refillDueDate: Date,
  refillWindowDays: {
    type: Number,
    default: 7
  },
  sideEffectPrompts: [String],
  confirmationSource: {
    type: String,
    enum: ['caregiver', 'patient', 'family', 'device', 'system', 'unknown'],
    default: 'caregiver'
  },
  lastConfirmedAt: Date,
  lastConfirmationStatus: {
    type: String,
    enum: ['taken', 'missed', 'partial', 'not_due']
  },
  lastConfirmationSource: {
    type: String,
    enum: ['caregiver', 'patient', 'family', 'device', 'system', 'unknown']
  },
  days: [{
    type: String,
    enum: Object.values(DAYS_OF_WEEK)
  }],
  startDate: Date,
  endDate: Date
});

const weeklyActivitySchema = new Schema({
  type: {
    type: String,
    enum: ['checkup', 'medication_review', 'vital_check', 'physical_therapy', 'social_visit'],
    required: true
  },
  day: {
    type: String,
    enum: Object.values(DAYS_OF_WEEK),
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: Number, // minutes
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  active: {
    type: Boolean,
    default: true
  }
});

const vitalThresholdSchema = new Schema({
  vitalType: {
    type: String,
    enum: ['heartRate', 'bloodPressure', 'oxygenSaturation', 'temperature', 'bloodGlucose'],
    required: true
  },
  min: Number,
  max: Number,
  unit: String,
  alertLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  actions: [String]
});

const careScheduleSchema = new Schema({
  // Schedule Identification
  scheduleId: {
    type: String,
    unique: true
  },
  title: String,
  description: String,
  scheduledFor: Date,
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  recurrence: Schema.Types.Mixed,
  
  // Patient Reference
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required'],
    index: true
  },
  
  // Schedule Status
  status: {
    type: String,
    enum: Object.values(SCHEDULE_STATUS),
    default: SCHEDULE_STATUS.ACTIVE
  },
  
  // Schedule Period
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  
  // Check-in Windows
  checkinWindows: [checkinWindowSchema],
  
  // Medication Reminders
  medicationReminders: [medicationReminderSchema],
  
  // Weekly Activities
  weeklyActivities: [weeklyActivitySchema],
  
  // Vital Thresholds
  vitalThresholds: [vitalThresholdSchema],
  
  // Inactivity Monitoring
  inactivityMonitoring: {
    enabled: {
      type: Boolean,
      default: true
    },
    thresholdHours: {
      type: Number,
      default: 4
    },
    wakingHoursOnly: {
      type: Boolean,
      default: true
    },
    wakingHoursStart: {
      type: Number,
      default: 6 // 6 AM
    },
    wakingHoursEnd: {
      type: Number,
      default: 22 // 10 PM
    }
  },
  
  // Fall Detection Settings
  fallDetection: {
    enabled: {
      type: Boolean,
      default: true
    },
    sensitivity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    autoAlert: {
      type: Boolean,
      default: true
    },
    acknowledgementTimeout: {
      type: Number,
      default: 60 // seconds
    }
  },
  
  // Panic Button Settings
  panicButton: {
    enabled: {
      type: Boolean,
      default: true
    },
    autoCall: {
      type: Boolean,
      default: false
    },
    primaryContact: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Escalation Rules
  escalationRules: {
    level1: {
      timeoutMinutes: { type: Number, default: 5 },
      notify: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      channels: [{ type: String, enum: ['push', 'sms', 'ussd', 'call'] }]
    },
    level2: {
      timeoutMinutes: { type: Number, default: 10 },
      notify: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      channels: [{ type: String, enum: ['push', 'sms', 'ussd', 'call'] }]
    },
    level3: {
      timeoutMinutes: { type: Number, default: 15 },
      notify: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      channels: [{ type: String, enum: ['push', 'sms', 'ussd', 'call'] }]
    }
  },
  
  // Notification Preferences
  notificationPreferences: {
    caregiver: {
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      ussd: { type: Boolean, default: false },
      quietHoursStart: String, // HH:mm
      quietHoursEnd: String
    },
    family: {
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      emergencyOnly: { type: Boolean, default: true }
    },
    patient: {
      voiceReminders: { type: Boolean, default: true },
      reminderVolume: { type: Number, min: 0, max: 100, default: 70 }
    }
  },
  
  // Special Instructions
  specialInstructions: [{
    type: { type: String },
    instruction: String,
    active: { type: Boolean, default: true }
  }],
  
  // Compliance Tracking
  compliance: {
    targetCheckinRate: { type: Number, default: 90 }, // percentage
    targetMedicationRate: { type: Number, default: 95 }
  },
  
  // History
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    version: Number,
    schedule: Schema.Types.Mixed,
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: Date,
    reason: String
  }],
  
  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
careScheduleSchema.index({ patient: 1, status: 1 });
careScheduleSchema.index({ status: 1 });
careScheduleSchema.index({ effectiveDate: 1 });
careScheduleSchema.index({ createdAt: -1 });

// Static method to generate schedule ID
careScheduleSchema.statics.generateScheduleId = async function() {
  const count = await this.countDocuments();
  const year = new Date().getFullYear();
  return `SCH-${year}-${String(count + 1).padStart(5, '0')}`;
};

// Method to get active check-in windows for today
careScheduleSchema.methods.getTodaysCheckinWindows = function() {
  const today = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = dayNames[today.getDay()];
  
  return this.checkinWindows.filter(window => {
    if (!window.days || window.days.length === 0) return true;
    return window.days.includes(todayName);
  });
};

// Method to get upcoming medication reminders
careScheduleSchema.methods.getUpcomingMedications = function(withinMinutes = 60) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const futureTime = new Date(now.getTime() + withinMinutes * 60000);
  const futureTimeString = `${String(futureTime.getHours()).padStart(2, '0')}:${String(futureTime.getMinutes()).padStart(2, '0')}`;
  
  return this.medicationReminders.filter(med => {
    if (!med.active) return false;
    return med.time >= currentTime && med.time <= futureTimeString;
  });
};

// Method to add version history
careScheduleSchema.methods.addVersionHistory = function(userId, reason) {
  this.previousVersions.push({
    version: this.version,
    schedule: this.toObject(),
    changedBy: userId,
    changedAt: new Date(),
    reason
  });
  this.version++;
};

// Pre-save middleware
careScheduleSchema.pre('save', function(next) {
  if (this.isNew && !this.scheduleId) {
    this.constructor.generateScheduleId().then(id => {
      this.scheduleId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

const CareSchedule = mongoose.model('CareSchedule', careScheduleSchema);

export default CareSchedule;

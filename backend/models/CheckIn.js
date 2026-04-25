/**
 * CheckIn Model
 * Wellness check-ins with BLE/NFC proximity verification
 */

import mongoose, { Schema } from 'mongoose';
import {
  ASSISTIVE_DEVICES,
  BALANCE_LEVELS,
  FRAILTY_LEVELS,
  GAIT_LEVELS,
  MOBILITY_LEVELS,
  WALKING_DIFFICULTY_LEVELS
} from '../utils/functionalStatus.js';

// Check-in status enum
export const CHECKIN_STATUS = {
  COMPLETED: 'completed',
  MISSED: 'missed',
  LATE: 'late',
  PENDING: 'pending',
  CANCELLED: 'cancelled'
};

// Check-in type enum
export const CHECKIN_TYPE = {
  SCHEDULED: 'scheduled',
  UNSCHEDULED: 'unscheduled',
  EMERGENCY: 'emergency',
  FOLLOW_UP: 'follow_up'
};

// Wellness status enum
export const WELLNESS_STATUS = {
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  CRITICAL: 'critical'
};

const checkinSchema = new Schema({
  // Check-in Identification
  checkinId: {
    type: String,
    unique: true
  },
  
  // Patient Reference
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required'],
    index: true
  },
  
  // Caregiver Reference
  caregiver: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Caregiver reference is required'],
    index: true
  },
  
  // Check-in Details
  type: {
    type: String,
    enum: Object.values(CHECKIN_TYPE),
    default: CHECKIN_TYPE.SCHEDULED
  },
  verificationMethod: {
    type: String
  },
  scheduledWindow: {
    name: { type: String, enum: ['morning', 'afternoon', 'evening'] },
    startTime: String, // HH:mm
    endTime: String
  },
  scheduledTime: Date,
  actualTime: Date,
  location: Schema.Types.Mixed,
  
  // Status
  status: {
    type: String,
    enum: Object.values(CHECKIN_STATUS),
    default: CHECKIN_STATUS.PENDING
  },
  
  // Proximity Verification
  proximityVerification: {
    method: {
      type: String,
      enum: ['ble', 'nfc', 'manual_pin', 'manual_override'],
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    deviceIds: [String],
    signalStrength: Number, // RSSI for BLE
    distance: Number, // estimated distance in meters
    verificationToken: String,
    gpsCoordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    }
  },
  
  // Wellness Observations
  wellness: {
    overallStatus: {
      type: String,
      enum: Object.values(WELLNESS_STATUS)
    },
    mobility: {
      type: String,
      enum: ['normal', 'limited', 'bedridden', 'needs_assistance']
    },
    mood: {
      type: String,
      enum: ['happy', 'neutral', 'sad', 'anxious', 'agitated']
    },
    appearance: {
      type: String,
      enum: ['normal', 'concerning', 'poor']
    },
    consciousness: {
      type: String,
      enum: ['alert', 'drowsy', 'confused', 'unresponsive']
    },
    pain: {
      present: Boolean,
      level: { type: Number, min: 0, max: 10 },
      location: String,
      description: String
    }
  },
  wellnessAssessment: Schema.Types.Mixed,
  
  // Vital Signs Recorded
  vitals: {
    heartRate: {
      value: Number,
      unit: { type: String, default: 'bpm' },
      abnormal: Boolean
    },
    bloodPressure: {
      systolic: Number,
      diastolic: Number,
      unit: { type: String, default: 'mmHg' },
      abnormal: Boolean
    },
    temperature: {
      value: Number,
      unit: { type: String, default: '°C' },
      abnormal: Boolean
    },
    oxygenSaturation: {
      value: Number,
      unit: { type: String, default: '%' },
      abnormal: Boolean
    },
    respiratoryRate: {
      value: Number,
      unit: { type: String, default: 'breaths/min' },
      abnormal: Boolean
    },
    bloodGlucose: {
      value: Number,
      unit: { type: String, default: 'mg/dL' },
      abnormal: Boolean
    },
    weight: {
      value: Number,
      unit: { type: String, default: 'kg' },
      abnormal: Boolean
    },
    cardiacRhythm: {
      irregular: Boolean,
      source: {
        type: String,
        enum: ['manual', 'ppg', 'ecg']
      },
      abnormal: Boolean
    }
  },
  
  // Medication Adherence
  medication: {
    adherence: {
      type: String,
      enum: ['taken', 'partial', 'missed', 'not_applicable']
    },
    dueTodayCount: {
      type: Number,
      default: 0
    },
    takenCount: {
      type: Number,
      default: 0
    },
    missedCount: {
      type: Number,
      default: 0
    },
    notes: String,
    refillConcern: {
      type: Boolean,
      default: false
    },
    sideEffects: [String],
    medications: [{
      reminderId: String,
      name: String,
      dosage: String,
      taken: Boolean,
      time: String,
      dueTime: String,
      dueToday: Boolean,
      status: {
        type: String,
        enum: ['taken', 'missed', 'partial', 'not_due'],
        default: 'not_due'
      },
      notes: String,
      missedReason: String,
      sideEffects: [String],
      refillConcern: {
        type: Boolean,
        default: false
      },
      refillNeededSoon: {
        type: Boolean,
        default: false
      },
      confirmationSource: {
        type: String,
        enum: ['caregiver', 'patient', 'family', 'device', 'system', 'unknown'],
        default: 'caregiver'
      }
    }],
    missedReason: String
  },
  
  // Meals and Nutrition
  nutrition: {
    mealsToday: [{
      type: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
      consumed: Boolean,
      notes: String
    }],
    appetite: {
      type: String,
      enum: ['normal', 'increased', 'decreased', 'no_appetite']
    },
    hydration: {
      type: String,
      enum: ['adequate', 'low', 'concerning']
    }
  },
  
  // Activities
  activities: {
    performed: [{
      activity: String,
      duration: Number, // minutes
      notes: String
    }],
    mobilityAid: {
      type: String,
      enum: ['none', 'cane', 'walker', 'wheelchair', 'bedridden']
    },
    outdoorTime: Number // minutes
  },

  // Functional decline and fall-risk assessment
  functionalStatus: {
    changedSinceLastVisit: {
      type: Boolean,
      default: false
    },
    changeNotes: String,
    mobility: {
      type: String,
      enum: MOBILITY_LEVELS
    },
    gait: {
      type: String,
      enum: GAIT_LEVELS
    },
    balance: {
      type: String,
      enum: BALANCE_LEVELS
    },
    assistiveDevice: {
      type: String,
      enum: ASSISTIVE_DEVICES
    },
    frailty: {
      type: String,
      enum: FRAILTY_LEVELS
    },
    walkingDifficulty: {
      type: String,
      enum: WALKING_DIFFICULTY_LEVELS
    },
    visionConcern: {
      type: Boolean,
      default: false
    },
    hearingConcern: {
      type: Boolean,
      default: false
    },
    continenceConcern: {
      type: Boolean,
      default: false
    },
    confusionChange: {
      type: Boolean,
      default: false
    },
    appetiteConcern: {
      type: Boolean,
      default: false
    },
    weightConcern: {
      type: Boolean,
      default: false
    },
    homeSafetyConcern: {
      type: Boolean,
      default: false
    },
    recentFall: {
      type: Boolean,
      default: false
    },
    nearFall: {
      type: Boolean,
      default: false
    },
    fallInjury: {
      type: Boolean,
      default: false
    },
    fearOfFalling: {
      type: Boolean,
      default: false
    },
    frailtySigns: [String],
    caregiverObservations: [String]
  },
  
  // Notes and Observations
  notes: {
    caregiver: String,
    patient: String,
    concerns: [String],
    highlights: [String],
    handoffs: [{
      note: String,
      targetRole: {
        type: String,
        enum: ['caregiver', 'chw', 'clinician', 'admin', 'family']
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
      },
      status: {
        type: String,
        enum: ['pending', 'acknowledged'],
        default: 'pending'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    }]
  },
  
  // Duration
  duration: {
    type: Number, // in minutes
    default: 0
  },
  
  // Follow-up
  followUp: {
    required: Boolean,
    reason: String,
    scheduledFor: Date,
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'] }
  },
  
  // Attachments
  attachments: [{
    type: { type: String, enum: ['image', 'audio', 'document'] },
    url: String,
    description: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Offline Sync
  offlineSync: {
    createdOffline: { type: Boolean, default: false },
    syncedAt: Date,
    deviceId: String
  },
  
  // Blockchain Record
  blockchainRecord: {
    transactionHash: String,
    blockNumber: Number,
    recordedAt: Date,
    dataHash: String
  },
  blockchainHash: String,
  
  // Audit Trail
  auditLog: [{
    action: String,
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { type: Date, default: Date.now },
    details: Schema.Types.Mixed
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
checkinSchema.index({ patient: 1, createdAt: -1 });
checkinSchema.index({ caregiver: 1, createdAt: -1 });
checkinSchema.index({ status: 1 });
checkinSchema.index({ scheduledTime: 1 });
checkinSchema.index({ 'proximityVerification.verified': 1 });
checkinSchema.index({ createdAt: -1 });

// Compound indexes
checkinSchema.index({ patient: 1, status: 1, createdAt: -1 });
checkinSchema.index({ patient: 1, scheduledTime: 1 });

// Virtual for duration since scheduled
checkinSchema.virtual('latenessMinutes').get(function() {
  if (!this.scheduledTime || !this.actualTime) return null;
  const diff = Math.floor((this.actualTime - this.scheduledTime) / 60000);
  return diff > 0 ? diff : 0;
});

// Static method to generate check-in ID
checkinSchema.statics.generateCheckinId = async function() {
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
  return `CHK-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
};

// Method to mark as completed
checkinSchema.methods.complete = async function(caregiverId, data) {
  this.status = CHECKIN_STATUS.COMPLETED;
  this.actualTime = new Date();
  this.caregiver = caregiverId;
  
  // Update all provided data
  Object.assign(this, data);
  
  // Add to audit log
  this.auditLog.push({
    action: 'completed',
    actor: caregiverId,
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to mark as missed
checkinSchema.methods.markMissed = async function(reason = '') {
  this.status = CHECKIN_STATUS.MISSED;
  
  this.auditLog.push({
    action: 'marked_missed',
    timestamp: new Date(),
    details: { reason }
  });
  
  return this.save();
};

// Method to verify proximity
checkinSchema.methods.verifyProximity = function(method, data) {
  this.proximityVerification = {
    method,
    verified: true,
    verifiedAt: new Date(),
    ...data
  };
  
  this.auditLog.push({
    action: 'proximity_verified',
    timestamp: new Date(),
    details: { method }
  });
  
  return this.save();
};

// Pre-save middleware
checkinSchema.pre('save', function(next) {
  if (this.isNew && !this.checkinId) {
    this.constructor.generateCheckinId().then(id => {
      this.checkinId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

const CheckIn = mongoose.model('CheckIn', checkinSchema);

export default CheckIn;

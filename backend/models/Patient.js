/**
 * Patient Model
 * Elderly patients being monitored by CHENGETO system
 */

import mongoose, { Schema } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';
import { ELDERLY_NCD_TYPES } from '../config/elderlyNcdProfiles.js';
import {
  ASSISTIVE_DEVICES,
  BALANCE_LEVELS,
  CONTINENCE_LEVELS,
  FRAILTY_LEVELS,
  GAIT_LEVELS,
  HEARING_LEVELS,
  HOME_SAFETY_LEVELS,
  MOBILITY_LEVELS,
  VISION_LEVELS,
  WEIGHT_LOSS_RISK_LEVELS
} from '../utils/functionalStatus.js';

// Patient status enum
export const PATIENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  HOSPITALIZED: 'hospitalized',
  DECEASED: 'deceased',
  TRANSFERRED: 'transferred'
};

// Risk level enum
export const RISK_LEVEL = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const carePlanGoalSchema = new Schema(
  {
    title: String,
    targetDate: Date,
    status: {
      type: String,
      enum: ['active', 'completed', 'on_hold'],
      default: 'active'
    },
    notes: String
  },
  { _id: false }
);

const carePlanSchema = new Schema(
  {
    goals: {
      type: [carePlanGoalSchema],
      default: []
    },
    riskProfile: {
      summary: String,
      fallRisk: {
        type: String,
        enum: Object.values(RISK_LEVEL),
        default: RISK_LEVEL.MODERATE
      },
      medicationRisk: {
        type: String,
        enum: Object.values(RISK_LEVEL),
        default: RISK_LEVEL.MODERATE
      },
      cognitiveRisk: {
        type: String,
        enum: Object.values(RISK_LEVEL),
        default: RISK_LEVEL.MODERATE
      },
      socialRisk: {
        type: String,
        enum: Object.values(RISK_LEVEL),
        default: RISK_LEVEL.MODERATE
      },
      caregiverInstructions: String
    },
    visitCadence: {
      frequency: {
        type: String,
        enum: ['twice-daily', 'daily', 'alternate', 'weekly', 'custom'],
        default: 'daily'
      },
      preferredWindow: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'flexible'],
        default: 'morning'
      },
      preferredDays: [
        {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }
      ],
      notes: String
    },
    escalationPreferences: {
      primaryResponderRole: {
        type: String,
        enum: ['caregiver', 'chw', 'clinician'],
        default: 'caregiver'
      },
      notifyFamily: {
        type: Boolean,
        default: true
      },
      notifyClinicianOnHighRisk: {
        type: Boolean,
        default: true
      },
      maxResponseMinutes: {
        type: Number,
        min: 5,
        max: 1440,
        default: 30
      }
    },
    consentSettings: {
      familyAccessLevel: {
        type: String,
        enum: ['full', 'limited', 'emergency_only'],
        default: 'limited'
      },
      familyUpdates: {
        type: Boolean,
        default: true
      },
      emergencySharing: {
        type: Boolean,
        default: true
      },
      dataCollection: {
        type: Boolean,
        default: true
      }
    },
    review: {
      lastReviewedAt: Date,
      nextReviewDate: Date,
      notes: String
    }
  },
  { _id: false }
);

const functionalBaselineSchema = new Schema(
  {
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
    vision: {
      type: String,
      enum: VISION_LEVELS
    },
    hearing: {
      type: String,
      enum: HEARING_LEVELS
    },
    continence: {
      type: String,
      enum: CONTINENCE_LEVELS
    },
    weightLossRisk: {
      type: String,
      enum: WEIGHT_LOSS_RISK_LEVELS
    },
    frailty: {
      type: String,
      enum: FRAILTY_LEVELS
    },
    homeSafety: {
      type: String,
      enum: HOME_SAFETY_LEVELS
    },
    recentFalls: {
      count: {
        type: Number,
        default: 0
      },
      lastFallAt: Date,
      injuryFromLastFall: {
        type: Boolean,
        default: false
      }
    },
    notes: String,
    lastReviewedAt: Date
  },
  { _id: false }
);

const patientSchema = new Schema({
  // Patient ID
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Encrypted Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    get: decrypt,
    set: encrypt
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    get: decrypt,
    set: encrypt
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  nationalId: {
    type: String,
    sparse: true,
    get: decrypt,
    set: encrypt
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  phone: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  
  // Address (encrypted for privacy)
  address: {
    village: { type: String, get: decrypt, set: encrypt },
    ward: { type: String, get: decrypt, set: encrypt },
    district: { type: String, get: decrypt, set: encrypt },
    province: { type: String, get: decrypt, set: encrypt },
    country: { type: String, default: 'Zimbabwe' },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Medical Information (encrypted)
  medicalSummary: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  medicalConditions: [{
    condition: String,
    diagnosedDate: Date,
    status: { type: String, enum: ['active', 'resolved', 'chronic'] }
  }],
  allergies: [{
    allergen: String,
    severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
    reaction: String
  }],
  currentMedications: [{
    name: String,
    dosage: String,
    frequency: String,
    startDate: Date,
    prescribedBy: String,
    instructions: String,
    refillDueDate: Date,
    refillWindowDays: { type: Number, default: 7 },
    adherenceRule: {
      type: String,
      enum: ['required', 'optional', 'as_needed'],
      default: 'required'
    },
    sideEffectPrompts: [String],
    confirmationSource: {
      type: String,
      enum: ['caregiver', 'patient', 'family', 'device', 'system', 'unknown'],
      default: 'caregiver'
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'stopped'],
      default: 'active'
    }
  }],
  
  // NCD Conditions (specific tracking)
  ncdConditions: [{
    type: {
      type: String,
      enum: ELDERLY_NCD_TYPES
    },
    diagnosedYear: Number,
    severity: { type: String, enum: ['controlled', 'uncontrolled', 'critical'] },
    lastReviewDate: Date
  }],
  
  // Vital Sign Thresholds
  vitalThresholds: {
    heartRate: {
      min: { type: Number, default: 50 },
      max: { type: Number, default: 120 }
    },
    bloodPressure: {
      systolicMin: { type: Number, default: 90 },
      systolicMax: { type: Number, default: 140 },
      diastolicMin: { type: Number, default: 60 },
      diastolicMax: { type: Number, default: 90 }
    },
    oxygenSaturation: {
      min: { type: Number, default: 90 }
    },
    temperature: {
      min: { type: Number, default: 36.0 },
      max: { type: Number, default: 38.0 }
    },
    respiratoryRate: {
      min: { type: Number, default: 12 },
      max: { type: Number, default: 24 }
    },
    bloodGlucose: {
      min: { type: Number, default: 70 },
      max: { type: Number, default: 180 }
    },
    weight: {
      min: { type: Number, default: 35 },
      max: { type: Number, default: 150 }
    }
  },
  
  // Activity Thresholds
  activityThresholds: {
    inactivityHours: { type: Number, default: 4 },
    wakingHoursStart: { type: Number, default: 6 },
    wakingHoursEnd: { type: Number, default: 22 },
    expectedDailySteps: { type: Number, default: 1000 }
  },
  
  // Assigned Care Team
  primaryCaregiver: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Primary caregiver is required']
  },
  backupCaregivers: [{
    caregiver: { type: Schema.Types.ObjectId, ref: 'User' },
    priority: { type: Number, default: 2 }
  }],
  assignedCHW: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned CHW is required']
  },
  assignedClinician: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Emergency Contacts
  emergencyContacts: [{
    name: { type: String, required: true },
    relationship: String,
    phone: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    priority: { type: Number, default: 1 }
  }],
  
  // Family Members (for remote access)
  familyMembers: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    relationship: { type: String, enum: ['child', 'spouse', 'sibling', 'relative', 'friend'] },
    accessLevel: { type: String, enum: ['full', 'limited', 'emergency_only'], default: 'limited' },
    approvedAt: Date
  }],
  
  // IoT Device Assignment
  iotDevice: {
    deviceId: { type: String, sparse: true },
    paired: { type: Boolean, default: false },
    pairedAt: Date,
    lastSeen: Date,
    firmwareVersion: String,
    batteryLevel: Number,
    status: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'offline' }
  },
  
  // Care Schedule
  careSchedule: {
    checkinWindows: [{
      name: { type: String, enum: ['morning', 'afternoon', 'evening'] },
      startTime: String, // HH:mm format
      endTime: String,
      gracePeriod: { type: Number, default: 15 }, // minutes
      required: { type: Boolean, default: true }
    }],
    medicationReminders: [{
      medication: String,
      dosage: String,
      time: String,
      withFood: Boolean,
      active: { type: Boolean, default: true },
      instructions: String,
      refillDueDate: Date,
      refillWindowDays: { type: Number, default: 7 },
      adherenceRule: {
        type: String,
        enum: ['required', 'optional', 'as_needed'],
        default: 'required'
      },
      sideEffectPrompts: [String],
      confirmationSource: {
        type: String,
        enum: ['caregiver', 'patient', 'family', 'device', 'system', 'unknown'],
        default: 'caregiver'
      }
    }],
    weeklyCheckups: [{
      day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
      time: String,
      type: { type: String, enum: ['phone', 'visit', 'video'] }
    }]
  },
  
  // Status and Risk Assessment
  status: {
    type: String,
    enum: Object.values(PATIENT_STATUS),
    default: PATIENT_STATUS.ACTIVE
  },
  riskLevel: {
    type: String,
    enum: Object.values(RISK_LEVEL),
    default: RISK_LEVEL.MODERATE
  },
  riskFactors: [{
    factor: String,
    weight: Number
  }],

  // Personalized care plan
  carePlan: {
    type: carePlanSchema,
    default: () => ({})
  },
  functionalBaseline: {
    type: functionalBaselineSchema,
    default: () => ({})
  },
  
  // Compliance Tracking
  compliance: {
    checkinAdherence: { type: Number, default: 0 }, // percentage
    medicationAdherence: { type: Number, default: 0 },
    missedCheckins: { type: Number, default: 0 },
    lastCheckin: Date,
    consecutiveMissedCheckins: { type: Number, default: 0 }
  },
  
  // Blockchain Reference
  blockchainProfile: {
    recordHash: String,
    createdAt: Date,
    lastUpdated: Date
  },
  
  // Consent and Privacy
  consent: {
    dataCollection: { type: Boolean, default: false },
    familyAccess: { type: Boolean, default: false },
    emergencyDataSharing: { type: Boolean, default: false },
    consentDate: Date,
    consentedBy: String, // Patient or legal guardian name
    consentVersion: String
  },
  
  // Notes
  notes: [{
    content: String,
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false }
  }],
  
  // Metadata
  enrolledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Indexes
patientSchema.index({ status: 1 });
patientSchema.index({ riskLevel: 1 });
patientSchema.index({ primaryCaregiver: 1 });
patientSchema.index({ assignedCHW: 1 });
patientSchema.index({ 'address.coordinates': '2dsphere' });
patientSchema.index({ createdAt: -1 });

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Static method to generate patient ID
patientSchema.statics.generatePatientId = async function() {
  const count = await this.countDocuments();
  const year = new Date().getFullYear();
  return `CHG-${year}-${String(count + 1).padStart(5, '0')}`;
};

// Method to check if patient is high risk
patientSchema.methods.isHighRisk = function() {
  return this.riskLevel === RISK_LEVEL.HIGH || this.riskLevel === RISK_LEVEL.CRITICAL;
};

// Method to update compliance metrics
patientSchema.methods.updateCompliance = async function(checkinCompleted) {
  if (checkinCompleted) {
    this.compliance.lastCheckin = new Date();
    this.compliance.consecutiveMissedCheckins = 0;
  }
  
  // Calculate adherence (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // This would need to query check-in records
  // Simplified version here
  
  await this.save();
};

patientSchema.methods.setDefaultThresholds = function() {
  this.vitalThresholds = {
    heartRate: {
      min: this.vitalThresholds?.heartRate?.min ?? 50,
      max: this.vitalThresholds?.heartRate?.max ?? 120
    },
    bloodPressure: {
      systolicMin: this.vitalThresholds?.bloodPressure?.systolicMin ?? 90,
      systolicMax: this.vitalThresholds?.bloodPressure?.systolicMax ?? 140,
      diastolicMin: this.vitalThresholds?.bloodPressure?.diastolicMin ?? 60,
      diastolicMax: this.vitalThresholds?.bloodPressure?.diastolicMax ?? 90
    },
    oxygenSaturation: {
      min: this.vitalThresholds?.oxygenSaturation?.min ?? 90
    },
    temperature: {
      min: this.vitalThresholds?.temperature?.min ?? 36.0,
      max: this.vitalThresholds?.temperature?.max ?? 38.0
    },
    respiratoryRate: {
      min: this.vitalThresholds?.respiratoryRate?.min ?? 12,
      max: this.vitalThresholds?.respiratoryRate?.max ?? 24
    },
    bloodGlucose: {
      min: this.vitalThresholds?.bloodGlucose?.min ?? 70,
      max: this.vitalThresholds?.bloodGlucose?.max ?? 180
    },
    weight: {
      min: this.vitalThresholds?.weight?.min ?? 35,
      max: this.vitalThresholds?.weight?.max ?? 150
    }
  };
};

// Pre-save middleware
patientSchema.pre('save', function(next) {
  if (this.isNew && !this.patientId) {
    this.constructor.generatePatientId().then(id => {
      this.patientId = id;
      next();
    }).catch(next);
  } else {
    next();
  }
});

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;

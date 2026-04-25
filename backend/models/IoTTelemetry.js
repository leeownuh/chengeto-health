/**
 * IoT Telemetry Model
 * Stores sensor data from IoT devices
 */

import crypto from 'crypto';
import mongoose, { Schema } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

// Telemetry status
export const TELEMETRY_STATUS = {
  NORMAL: 'normal',
  ABNORMAL: 'abnormal',
  CRITICAL: 'critical',
  ERROR: 'error'
};

// Device status
export const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  LOW_BATTERY: 'low_battery',
  MAINTENANCE: 'maintenance'
};

const iotTelemetrySchema = new Schema({
  // Device Identification
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    index: true
  },
  
  // Patient Reference
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    index: true
  },
  
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  type: {
    type: String,
    default: 'vitals'
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  // Heart Rate Data
  heartRate: {
    value: {
      type: Number,
      min: 30,
      max: 250
    },
    unit: { type: String, default: 'bpm' },
    status: {
      type: String,
      enum: Object.values(TELEMETRY_STATUS)
    },
    confidence: Number, // 0-100
    source: {
      type: String,
      enum: ['ppg', 'ecg', 'spo2_sensor', 'manual']
    }
  },
  
  // Blood Pressure
  bloodPressure: {
    systolic: {
      value: Number,
      status: String
    },
    diastolic: {
      value: Number,
      status: String
    },
    unit: { type: String, default: 'mmHg' },
    measuredAt: Date
  },
  
  // Oxygen Saturation
  oxygenSaturation: {
    value: {
      type: Number,
      min: 50,
      max: 100
    },
    unit: { type: String, default: '%' },
    status: String
  },
  
  // Temperature
  temperature: {
    value: Number,
    unit: { type: String, default: '°C' },
    location: {
      type: String,
      enum: ['forehead', 'ear', 'axillary', 'wrist']
    },
    status: String
  },

  // Respiratory Rate
  respiratoryRate: {
    value: Number,
    unit: { type: String, default: 'breaths/min' },
    status: String
  },

  // Blood Glucose
  bloodGlucose: {
    value: Number,
    unit: { type: String, default: 'mg/dL' },
    context: {
      type: String,
      enum: ['fasting', 'before_meal', 'after_meal', 'bedtime', 'random']
    },
    status: String
  },

  // Weight
  weight: {
    value: Number,
    unit: { type: String, default: 'kg' },
    status: String
  },

  // Rhythm Summary
  cardiacRhythm: {
    irregular: Boolean,
    summary: String,
    source: {
      type: String,
      enum: ['ppg', 'ecg', 'manual']
    },
    status: String
  },
  
  // Motion and Activity
  motion: {
    detected: Boolean,
    type: {
      type: String,
      enum: ['walking', 'sitting', 'standing', 'lying', 'falling', 'unknown']
    },
    intensity: {
      type: String,
      enum: ['none', 'low', 'medium', 'high']
    },
    duration: Number, // seconds
    accelerometer: {
      x: Number,
      y: Number,
      z: Number
    },
    gyroscope: {
      x: Number,
      y: Number,
      z: Number
    }
  },
  
  // Fall Detection
  fall: {
    detected: Boolean,
    confidence: Number,
    impactForce: Number, // g-force
    fallType: {
      type: String,
      enum: ['forward', 'backward', 'lateral', 'unknown']
    },
    recoveryDetected: Boolean,
    location: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Inactivity Tracking
  inactivity: {
    duration: Number, // minutes
    lastMotionTime: Date,
    threshold: Number, // configured threshold in minutes
    alertTriggered: Boolean
  },
  
  // Steps and Activity Counters
  activity: {
    steps: Number,
    distance: Number, // meters
    calories: Number,
    activeMinutes: Number,
    sedentaryMinutes: Number
  },
  
  // Sleep Tracking
  sleep: {
    state: {
      type: String,
      enum: ['awake', 'light', 'deep', 'rem', 'unknown']
    },
    duration: Number, // minutes
    quality: Number, // 0-100
    interruptions: Number
  },
  
  // Device Status
  deviceStatus: {
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100
    },
    charging: Boolean,
    signalStrength: Number, // RSSI
    firmwareVersion: String,
    lastSync: Date,
    status: {
      type: String,
      enum: Object.values(DEVICE_STATUS)
    },
    errors: [{
      code: String,
      message: String,
      timestamp: Date
    }]
  },
  
  // Location
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    altitude: Number,
    indoor: Boolean,
    zone: String // home, hospital, outdoors, etc.
  },
  
  // BLE/NFC Pairing Data
  pairing: {
    nearbyDevices: [{
      deviceId: String,
      deviceType: String,
      signalStrength: Number,
      distance: Number,
      lastSeen: Date
    }],
    activePairing: {
      paired: Boolean,
      pairedWith: String, // deviceId
      pairedAt: Date,
      proximity: Number // meters
    }
  },
  
  // Panic Button
  panic: {
    triggered: Boolean,
    triggeredAt: Date,
    type: {
      type: String,
      enum: ['manual', 'automatic', 'test']
    },
    cancelled: Boolean,
    cancelledAt: Date
  },
  
  // Data Quality
  quality: {
    signalQuality: Number, // 0-100
    artifactDetected: Boolean,
    artifactType: String,
    calibrationRequired: Boolean
  },
  
  // Raw Data (encrypted for storage)
  rawData: {
    type: String,
    get: decrypt,
    set: encrypt
  },
  
  // Processing Status
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: Date,
  
  // Alert Generated
  alertGenerated: {
    type: Boolean,
    default: false
  },
  alertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert'
  },
  
  // Blockchain Hash
  dataHash: String
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Indexes
iotTelemetrySchema.index({ deviceId: 1, timestamp: -1 });
iotTelemetrySchema.index({ patient: 1, timestamp: -1 });
iotTelemetrySchema.index({ 'heartRate.status': 1 });
iotTelemetrySchema.index({ 'fall.detected': 1 });
iotTelemetrySchema.index({ 'panic.triggered': 1 });
iotTelemetrySchema.index({ timestamp: -1 });

// TTL index - automatically delete documents after 90 days
iotTelemetrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Virtual for formatted timestamp
iotTelemetrySchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Static method to get latest telemetry
iotTelemetrySchema.statics.getLatestForPatient = async function(patientId) {
  return this.findOne({ patient: patientId })
    .sort({ timestamp: -1 })
    .lean();
};

// Static method to get telemetry history
iotTelemetrySchema.statics.getHistoryForPatient = async function(patientId, hours = 24) {
  const since = new Date(Date.now() - hours * 3600000);
  return this.find({
    patient: patientId,
    timestamp: { $gte: since }
  }).sort({ timestamp: 1 }).lean();
};

// Method to check if values are abnormal
iotTelemetrySchema.methods.checkAbnormalValues = function(thresholds) {
  const abnormal = {};
  const safeThresholds = {
    heartRate: thresholds?.heartRate ?? { min: 50, max: 120 },
    oxygenSaturation: thresholds?.oxygenSaturation ?? { min: 90 },
    temperature: thresholds?.temperature ?? { min: 36, max: 38 },
    respiratoryRate: thresholds?.respiratoryRate ?? { min: 12, max: 24 },
    bloodGlucose: thresholds?.bloodGlucose ?? { min: 70, max: 180 },
    weight: thresholds?.weight ?? { min: 35, max: 150 }
  };
  
  if (this.heartRate?.value) {
    if (
      this.heartRate.value < safeThresholds.heartRate.min ||
      this.heartRate.value > safeThresholds.heartRate.max
    ) {
      abnormal.heartRate = true;
      this.heartRate.status = TELEMETRY_STATUS.ABNORMAL;
    }
  }
  
  if (this.oxygenSaturation?.value) {
    if (this.oxygenSaturation.value < safeThresholds.oxygenSaturation.min) {
      abnormal.oxygenSaturation = true;
      this.oxygenSaturation.status = TELEMETRY_STATUS.ABNORMAL;
    }
  }

  if (this.temperature?.value) {
    if (
      this.temperature.value < safeThresholds.temperature.min ||
      this.temperature.value > safeThresholds.temperature.max
    ) {
      abnormal.temperature = true;
      this.temperature.status = TELEMETRY_STATUS.ABNORMAL;
    }
  }

  if (this.respiratoryRate?.value) {
    if (
      this.respiratoryRate.value < safeThresholds.respiratoryRate.min ||
      this.respiratoryRate.value > safeThresholds.respiratoryRate.max
    ) {
      abnormal.respiratoryRate = true;
      this.respiratoryRate.status = TELEMETRY_STATUS.ABNORMAL;
    }
  }

  if (this.bloodGlucose?.value) {
    if (
      this.bloodGlucose.value < safeThresholds.bloodGlucose.min ||
      this.bloodGlucose.value > safeThresholds.bloodGlucose.max
    ) {
      abnormal.bloodGlucose = true;
      this.bloodGlucose.status = TELEMETRY_STATUS.ABNORMAL;
    }
  }

  if (this.weight?.value) {
    if (this.weight.value < safeThresholds.weight.min || this.weight.value > safeThresholds.weight.max) {
      abnormal.weight = true;
      this.weight.status = TELEMETRY_STATUS.ABNORMAL;
    }
  }
  
  return abnormal;
};

// Pre-save middleware to generate data hash
iotTelemetrySchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate hash for blockchain anchoring
    const dataString = JSON.stringify({
      deviceId: this.deviceId,
      patient: this.patient,
      timestamp: this.timestamp,
      heartRate: this.heartRate,
      bloodPressure: this.bloodPressure,
      oxygenSaturation: this.oxygenSaturation,
      temperature: this.temperature,
      respiratoryRate: this.respiratoryRate,
      bloodGlucose: this.bloodGlucose,
      weight: this.weight,
      cardiacRhythm: this.cardiacRhythm,
      motion: this.motion,
      fall: this.fall
    });
    this.dataHash = crypto.createHash('sha256').update(dataString).digest('hex');
  }
  next();
});

const IoTTelemetry = mongoose.model('IoTTelemetry', iotTelemetrySchema);

export default IoTTelemetry;

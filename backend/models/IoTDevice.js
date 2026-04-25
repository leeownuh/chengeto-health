/**
 * IoT Device Model
 * Device registration, provisioning, and management
 */

import mongoose, { Schema } from 'mongoose';
import { hashData, generateToken } from '../utils/encryption.js';

// Device status
export const DEVICE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PAIRED: 'paired',
  UNPAIRED: 'unpaired',
  MAINTENANCE: 'maintenance',
  DECOMMISSIONED: 'decommissioned'
};

// Device types
export const DEVICE_TYPES = {
  PATIENT_MONITOR: 'patient_monitor',
  CAREGIVER_DEVICE: 'caregiver_device',
  FALL_DETECTOR: 'fall_detector',
  VITAL_MONITOR: 'vital_monitor',
  MOTION_SENSOR: 'motion_sensor',
  PANIC_BUTTON: 'panic_button'
};

// Device capabilities
export const DEVICE_CAPABILITIES = {
  HEART_RATE: 'heart_rate',
  MOTION: 'motion',
  FALL_DETECTION: 'fall_detection',
  LOCATION: 'location',
  PANIC_BUTTON: 'panic_button',
  BLE: 'ble',
  NFC: 'nfc',
  TEMPERATURE: 'temperature',
  OXYGEN_SATURATION: 'oxygen_saturation',
  BLOOD_PRESSURE: 'blood_pressure',
  RESPIRATORY_RATE: 'respiratory_rate',
  BLOOD_GLUCOSE: 'blood_glucose',
  WEIGHT: 'weight',
  RHYTHM_ALERT: 'rhythm_alert'
};

const iotDeviceSchema = new Schema({
  // Device Identification
  deviceId: {
    type: String,
    unique: true,
    required: true
  },
  serialNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Device Type and Model
  deviceType: {
    type: String,
    enum: Object.values(DEVICE_TYPES),
    required: true
  },
  model: String,
  manufacturer: String,
  firmwareVersion: String,
  hardwareRevision: String,
  
  // Capabilities
  capabilities: [{
    type: String,
    enum: Object.values(DEVICE_CAPABILITIES)
  }],
  
  // Owner and Assignment
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedPatient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient'
  },
  assignedCaregiver: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Status
  status: {
    type: String,
    enum: Object.values(DEVICE_STATUS),
    default: DEVICE_STATUS.INACTIVE
  },
  
  // Pairing Information
  pairing: {
    isPaired: { type: Boolean, default: false },
    pairedWith: { // For caregiver devices, this is the patient device
      type: Schema.Types.ObjectId,
      ref: 'IoTDevice'
    },
    pairedAt: Date,
    pairingCode: String,
    pairingExpiresAt: Date
  },
  
  // Device Identity and Security
  security: {
    certificate: String, // X.509 certificate
    certificateFingerprint: String,
    apiKey: {
      type: String,
      select: false
    },
    apiSecret: {
      type: String,
      select: false
    },
    lastKeyRotation: Date
  },
  
  // Network Configuration
  network: {
    macAddress: String,
    bleAddress: String,
    nfcId: String,
    supportedProtocols: [{
      type: String,
      enum: ['mqtt', 'http', 'ble', 'nfc', 'lora', 'wifi']
    }]
  },
  
  // Connection Status
  connection: {
    online: { type: Boolean, default: false },
    lastOnline: Date,
    lastOffline: Date,
    connectionType: String, // wifi, cellular, ble, etc.
    signalStrength: Number,
    ipAddress: String,
    mqttClientId: String
  },
  
  // Battery and Power
  power: {
    batteryLevel: { type: Number, min: 0, max: 100 },
    batteryStatus: {
      type: String,
      enum: ['charging', 'discharging', 'full', 'low', 'critical']
    },
    lastCharged: Date,
    estimatedBatteryLife: Number // hours
  },
  
  // Sensor Configuration
  sensors: {
    heartRate: {
      enabled: { type: Boolean, default: true },
      samplingRate: Number, // Hz
      sensitivity: String
    },
    motion: {
      enabled: { type: Boolean, default: true },
      sensitivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
    },
    fallDetection: {
      enabled: { type: Boolean, default: true },
      sensitivity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
      threshold: Number
    }
  },
  
  // Alert Configuration
  alerts: {
    lowBatteryThreshold: { type: Number, default: 20 },
    offlineAlertThreshold: { type: Number, default: 30 }, // minutes
    vitalAlertEnabled: { type: Boolean, default: true },
    fallAlertEnabled: { type: Boolean, default: true },
    inactivityAlertEnabled: { type: Boolean, default: true }
  },
  
  // Location
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    lastUpdated: Date,
    geofencingEnabled: { type: Boolean, default: false },
    safeZones: [{
      name: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      radius: Number // meters
    }]
  },
  
  // Maintenance
  maintenance: {
    lastMaintenance: Date,
    nextMaintenance: Date,
    maintenanceHistory: [{
      date: Date,
      type: String,
      description: String,
      performedBy: String
    }],
    calibrationRequired: { type: Boolean, default: false },
    firmwareUpdateAvailable: { type: Boolean, default: false }
  },
  
  // Telemetry Summary
  telemetrySummary: {
    lastTelemetry: Date,
    totalDataPoints: { type: Number, default: 0 },
    alertsGenerated: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 } // percentage
  },
  
  // Blockchain Reference
  blockchain: {
    registered: { type: Boolean, default: false },
    transactionHash: String,
    registrationDate: Date
  },
  
  // Metadata
  provisionedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  provisionedAt: Date,
  activatedAt: Date,
  decommissionedAt: Date,
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
iotDeviceSchema.index({ status: 1 });
iotDeviceSchema.index({ deviceType: 1 });
iotDeviceSchema.index({ assignedPatient: 1 });
iotDeviceSchema.index({ owner: 1 });
iotDeviceSchema.index({ 'connection.online': 1 });

// Virtual for device age
iotDeviceSchema.virtual('deviceAgeDays').get(function() {
  if (!this.provisionedAt) return 0;
  return Math.floor((Date.now() - this.provisionedAt) / (1000 * 60 * 60 * 24));
});

// Static method to generate device ID
iotDeviceSchema.statics.generateDeviceId = function() {
  const prefix = 'DEV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Static method to generate pairing code
iotDeviceSchema.statics.generatePairingCode = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Method to provision device
iotDeviceSchema.methods.provision = async function(provisionedBy) {
  if (!this.deviceId) {
    this.deviceId = this.constructor.generateDeviceId();
  }
  
  // Generate API credentials
  this.security.apiKey = generateToken(16);
  this.security.apiSecret = generateToken(32);
  
  this.status = DEVICE_STATUS.INACTIVE;
  this.provisionedBy = provisionedBy;
  this.provisionedAt = new Date();
  
  return this.save();
};

// Method to activate device
iotDeviceSchema.methods.activate = async function() {
  this.status = DEVICE_STATUS.ACTIVE;
  this.activatedAt = new Date();
  this.connection.online = true;
  this.connection.lastOnline = new Date();
  
  return this.save();
};

// Method to pair devices
iotDeviceSchema.methods.pairWith = async function(otherDeviceId) {
  this.pairing.isPaired = true;
  this.pairing.pairedWith = otherDeviceId;
  this.pairing.pairedAt = new Date();
  this.status = DEVICE_STATUS.PAIRED;
  
  // Clear pairing code
  this.pairing.pairingCode = undefined;
  this.pairing.pairingExpiresAt = undefined;
  
  return this.save();
};

// Method to generate pairing code
iotDeviceSchema.methods.generateNewPairingCode = function() {
  this.pairing.pairingCode = this.constructor.generatePairingCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Valid for 30 minutes
  this.pairing.pairingExpiresAt = expiresAt;
  return this.save();
};

// Method to update connection status
iotDeviceSchema.methods.updateConnection = function(online, metadata = {}) {
  this.connection.online = online;
  
  if (online) {
    this.connection.lastOnline = new Date();
  } else {
    this.connection.lastOffline = new Date();
  }
  
  Object.assign(this.connection, metadata);
  return this.save();
};

// Method to update battery status
iotDeviceSchema.methods.updateBattery = function(level, status) {
  this.power.batteryLevel = level;
  this.power.batteryStatus = status;
  
  if (status === 'full' || status === 'charging') {
    this.power.lastCharged = new Date();
  }
  
  return this.save();
};

// Method to check if device needs attention
iotDeviceSchema.methods.needsAttention = function() {
  const issues = [];
  
  if (this.power.batteryLevel < 20) {
    issues.push('low_battery');
  }
  
  if (this.status === DEVICE_STATUS.MAINTENANCE) {
    issues.push('maintenance_mode');
  }
  
  if (this.maintenance?.calibrationRequired) {
    issues.push('calibration_required');
  }
  
  if (this.maintenance?.firmwareUpdateAvailable) {
    issues.push('firmware_update_available');
  }
  
  const offlineMinutes = this.connection.lastOnline 
    ? Math.floor((Date.now() - this.connection.lastOnline) / 60000)
    : null;
  
  if (offlineMinutes && offlineMinutes > 30) {
    issues.push('offline_extended');
  }
  
  return issues;
};

// Pre-save middleware
iotDeviceSchema.pre('save', function(next) {
  if (this.isNew && !this.deviceId) {
    this.deviceId = this.constructor.generateDeviceId();
  }
  next();
});

const IoTDevice = mongoose.model('IoTDevice', iotDeviceSchema);

export default IoTDevice;

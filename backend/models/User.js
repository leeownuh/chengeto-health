/**
 * User Model
 * Supports RBAC roles: admin, chw, caregiver, patient, family, clinician, auditor
 */

import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// User roles enum
export const USER_ROLES = {
  ADMIN: 'admin',
  CHW: 'chw',
  CAREGIVER: 'caregiver',
  PATIENT: 'patient',
  FAMILY: 'family',
  CLINICIAN: 'clinician',
  AUDITOR: 'auditor'
};

// User status enum
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending'
};

const trustedDeviceSchema = new Schema(
  {
    fingerprint: String,
    name: String,
    type: String,
    platform: String,
    browser: String,
    ipAddress: String,
    addedAt: Date,
    lastUsed: Date
  },
  { _id: false }
);

const userSchema = new Schema({
  // Basic Information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Profile Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say']
  },
  address: {
    street: String,
    city: String,
    province: String,
    country: { type: String, default: 'Zimbabwe' },
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  profileImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [1000, 'Bio cannot exceed 1000 characters']
  },
  specialization: {
    type: String,
    trim: true,
    maxlength: [120, 'Specialization cannot exceed 120 characters']
  },
  qualification: {
    type: String,
    trim: true,
    maxlength: [120, 'Qualification cannot exceed 120 characters']
  },
  language: {
    type: String,
    enum: ['en', 'sn', 'nd'], // English, Shona, Ndebele
    default: 'en'
  },
  preferences: {
    type: Schema.Types.Mixed,
    default: {}
  },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    required: [true, 'Role is required']
  },
  permissions: [{
    type: String,
    enum: [
      'read:patients', 'write:patients', 'delete:patients',
      'read:caregivers', 'write:caregivers', 'delete:caregivers',
      'read:alerts', 'write:alerts', 'acknowledge:alerts', 'escalate:alerts',
      'read:checkins', 'write:checkins', 'verify:checkins',
      'read:devices', 'write:devices', 'provision:devices',
      'read:blockchain', 'write:blockchain',
      'read:audit', 'export:audit',
      'manage:users', 'manage:schedules', 'manage:system',
      'access:admin', 'access:reports'
    ]
  }],
  
  // Status and Verification
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.PENDING
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Authentication
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: {
    type: String,
    select: false
  },
  mfaBackupCodes: [{
    code: String,
    usedAt: Date
  }],
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  pendingMfaSecret: {
    type: String,
    select: false
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  requiresPasswordReset: {
    type: Boolean,
    default: false
  },
  
  // Device and Session Info
  deviceId: {
    type: String,
    sparse: true
  },
  deviceToken: {
    type: String, // For push notifications
    select: false
  },
  lastLogin: {
    timestamp: Date,
    ipAddress: String,
    userAgent: String
  },
  trustedDevices: {
    type: [trustedDeviceSchema],
    default: []
  },
  refreshTokens: [{
    token: { type: String, select: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    userAgent: String,
    ipAddress: String
  }],
  
  // Role-specific fields
  // For caregivers
  assignedPatients: [{
    type: Schema.Types.ObjectId,
    ref: 'Patient'
  }],
  isPrimaryCaregiver: {
    type: Boolean,
    default: false
  },
  certificationNumber: String,
  specializations: [String],
  
  // For CHW
  healthFacility: {
    type: Schema.Types.ObjectId,
    ref: 'HealthFacility'
  },
  ward: String,
  district: String,
  
  // For family members
  linkedPatients: [{
    patient: { type: Schema.Types.ObjectId, ref: 'Patient' },
    relationship: { type: String, enum: ['child', 'spouse', 'sibling', 'relative', 'friend'] },
    accessLevel: { type: String, enum: ['full', 'limited', 'emergency_only'], default: 'limited' }
  }],
  
  // For patients
  emergencyContacts: [{
    name: { type: String, required: true },
    relationship: String,
    phone: { type: String, required: true },
    priority: { type: Number, default: 1 }
  }],
  medicalConditions: [String],
  allergies: [String],
  
  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'address.coordinates': '2dsphere' });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('assignedFacility')
  .get(function() {
    return this.healthFacility;
  })
  .set(function(value) {
    this.healthFacility = value;
  });

// Virtual for account locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set default permissions based on role
userSchema.pre('save', function(next) {
  if (this.isNew && this.permissions.length === 0) {
    this.permissions = getDefaultPermissions(this.role);
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if password was changed after token issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to generate password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 3600000; // 1 hour
  
  return resetToken;
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  // Otherwise we're incrementing
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock the account if at max attempts and it's not locked already
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 3600000 }; // 1 hour lock
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

userSchema.methods.setPermissions = function() {
  this.permissions = getDefaultPermissions(this.role);
  return this.permissions;
};

// Helper function to get default permissions for role
function getDefaultPermissions(role) {
  const rolePermissions = {
    admin: [
      'read:patients', 'write:patients', 'delete:patients',
      'read:caregivers', 'write:caregivers', 'delete:caregivers',
      'read:alerts', 'write:alerts', 'acknowledge:alerts', 'escalate:alerts',
      'read:checkins', 'write:checkins', 'verify:checkins',
      'read:devices', 'write:devices', 'provision:devices',
      'read:blockchain', 'write:blockchain',
      'read:audit', 'export:audit',
      'manage:users', 'manage:schedules', 'manage:system',
      'access:admin', 'access:reports'
    ],
    chw: [
      'read:patients', 'write:patients',
      'read:caregivers',
      'read:alerts', 'acknowledge:alerts', 'escalate:alerts',
      'read:checkins', 'write:checkins', 'verify:checkins',
      'read:devices',
      'access:reports'
    ],
    caregiver: [
      'read:patients',
      'read:alerts', 'acknowledge:alerts',
      'read:checkins', 'write:checkins',
      'read:devices'
    ],
    patient: [
      'read:alerts',
      'read:checkins'
    ],
    family: [
      'read:alerts',
      'read:checkins'
    ],
    clinician: [
      'read:patients', 'write:patients',
      'read:alerts', 'acknowledge:alerts', 'escalate:alerts',
      'read:checkins',
      'read:devices',
      'access:reports'
    ],
    auditor: [
      'read:patients',
      'read:caregivers',
      'read:alerts',
      'read:checkins',
      'read:devices',
      'read:blockchain',
      'read:audit', 'export:audit'
    ]
  };
  
  return rolePermissions[role] || [];
}

const User = mongoose.model('User', userSchema);

export default User;

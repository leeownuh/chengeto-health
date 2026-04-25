/**
 * CHENGETO Health - IoT Telemetry Routes
 * Handles device data ingestion, real-time vitals, and device management
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { body, param, query, validationResult } from 'express-validator';
import IoTTelemetry from '../models/IoTTelemetry.js';
import IoTDevice from '../models/IoTDevice.js';
import Patient from '../models/Patient.js';
import Alert from '../models/Alert.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize, authenticateDevice } from '../middleware/auth.middleware.js';
import { triggerAlertEscalation } from '../services/escalation.service.js';
import logger from '../config/logger.js';

const router = express.Router();

function mapMotionType(activity) {
  switch (activity) {
    case 'stationary':
      return 'sitting';
    case 'fall_detected':
      return 'falling';
    case 'running':
      return 'walking';
    default:
      return activity ?? 'unknown';
  }
}

function buildTelemetryVitals(vitals = {}) {
  return {
    heartRate:
      vitals.heartRate !== undefined
        ? {
            value: Number(vitals.heartRate),
            unit: 'bpm',
            status: 'normal',
            source: vitals.heartRateSource ?? 'ppg'
          }
        : undefined,
    bloodPressure:
      vitals.bloodPressure?.systolic || vitals.bloodPressure?.diastolic
        ? {
            systolic:
              vitals.bloodPressure?.systolic !== undefined
                ? { value: Number(vitals.bloodPressure.systolic), status: 'normal' }
                : undefined,
            diastolic:
              vitals.bloodPressure?.diastolic !== undefined
                ? { value: Number(vitals.bloodPressure.diastolic), status: 'normal' }
                : undefined,
            unit: 'mmHg',
            measuredAt: new Date()
          }
        : undefined,
    oxygenSaturation:
      vitals.oxygenSaturation !== undefined
        ? { value: Number(vitals.oxygenSaturation), unit: '%', status: 'normal' }
        : undefined,
    temperature:
      vitals.temperature !== undefined
        ? { value: Number(vitals.temperature), unit: 'C', status: 'normal', location: 'wrist' }
        : undefined,
    respiratoryRate:
      vitals.respiratoryRate !== undefined
        ? { value: Number(vitals.respiratoryRate), unit: 'breaths/min', status: 'normal' }
        : undefined,
    bloodGlucose:
      vitals.bloodGlucose !== undefined || vitals.glucoseLevel !== undefined
        ? {
            value: Number(vitals.bloodGlucose ?? vitals.glucoseLevel),
            unit: 'mg/dL',
            context: vitals.mealContext ?? 'random',
            status: 'normal'
          }
        : undefined,
    weight:
      vitals.weight !== undefined
        ? { value: Number(vitals.weight), unit: vitals.weightUnit ?? 'kg', status: 'normal' }
        : undefined,
    cardiacRhythm:
      typeof vitals.rhythmIrregularity === 'boolean'
        ? {
            irregular: vitals.rhythmIrregularity,
            source: vitals.rhythmSource ?? 'ppg',
            summary: vitals.rhythmSummary ?? '',
            status: vitals.rhythmIrregularity ? 'abnormal' : 'normal'
          }
        : undefined
  };
}

function buildFallPayload(motion = {}) {
  if (!motion.fallDetected && !motion.impactForce && motion.activity !== 'fall_detected') {
    return undefined;
  }

  return {
    detected: Boolean(motion.fallDetected || motion.activity === 'fall_detected'),
    confidence: motion.fallConfidence,
    impactForce: motion.impactForce,
    fallType: 'unknown',
    recoveryDetected: false
  };
}

function buildRealtimeVitals(telemetry) {
  return {
    heartRate: telemetry?.heartRate?.value ?? null,
    systolic: telemetry?.bloodPressure?.systolic?.value ?? null,
    diastolic: telemetry?.bloodPressure?.diastolic?.value ?? null,
    oxygenSaturation: telemetry?.oxygenSaturation?.value ?? null,
    temperature: telemetry?.temperature?.value ?? null,
    respiratoryRate: telemetry?.respiratoryRate?.value ?? null,
    bloodGlucose: telemetry?.bloodGlucose?.value ?? null,
    weight: telemetry?.weight?.value ?? null,
    rhythmIrregularity: telemetry?.cardiacRhythm?.irregular ?? null
  };
}

/**
 * @route   POST /api/iot/telemetry
 * @desc    Receive telemetry data from IoT devices
 * @access  Private (Device authenticated)
 */
router.post('/telemetry',
  // Support both device and user authentication
  async (req, res, next) => {
    // Check for device auth header
    const deviceAuth = req.headers['x-device-id'] && req.headers['x-device-secret'];
    if (deviceAuth) {
      return authenticateDevice(req, res, next);
    }
    // Fall back to user auth
    return authenticate(req, res, next);
  },
  [
    body('deviceId').trim().notEmpty().withMessage('Device ID required'),
    body('patientId').optional().isMongoId(),
    body('vitals').optional().isObject(),
    body('vitals.heartRate').optional().isInt({ min: 30, max: 220 }),
    body('vitals.bloodPressure').optional().isObject(),
    body('vitals.bloodPressure.systolic').optional().isInt({ min: 60, max: 250 }),
    body('vitals.bloodPressure.diastolic').optional().isInt({ min: 40, max: 150 }),
    body('vitals.oxygenSaturation').optional().isInt({ min: 50, max: 100 }),
    body('vitals.temperature').optional().isFloat({ min: 30, max: 45 }),
    body('vitals.respiratoryRate').optional().isFloat({ min: 4, max: 60 }),
    body('vitals.bloodGlucose').optional().isFloat({ min: 20, max: 600 }),
    body('vitals.glucoseLevel').optional().isFloat({ min: 20, max: 600 }),
    body('vitals.weight').optional().isFloat({ min: 10, max: 300 }),
    body('vitals.rhythmIrregularity').optional().isBoolean(),
    body('motion').optional().isObject(),
    body('motion.accelerometer').optional().isObject(),
    body('motion.activity').optional().isIn([
      'stationary',
      'walking',
      'running',
      'fall_detected',
      'sitting',
      'standing',
      'lying',
      'falling',
      'unknown'
    ]),
    body('motion.fallDetected').optional().isBoolean(),
    body('motion.impactForce').optional().isFloat(),
    body('deviceStatus').optional().isObject(),
    body('location').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        deviceId,
        patientId,
        vitals,
        motion,
        deviceStatus,
        location,
        timestamp
      } = req.body;

      // Find device
      const device = await IoTDevice.findOne({ deviceId }).populate('assignedPatient');
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not registered'
        });
      }

      // Verify device is active
      if (device.status !== 'assigned' && device.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Device not active'
        });
      }

      // Determine patient
      const telemetryPatientId = patientId || device.assignedPatient?._id;
      
      if (!telemetryPatientId) {
        return res.status(400).json({
          success: false,
          message: 'No patient associated with this device'
        });
      }

      // Create telemetry record
      const telemetry = new IoTTelemetry({
        patient: telemetryPatientId,
        deviceId: device.deviceId,
        ...buildTelemetryVitals(vitals),
        motion: motion ? {
          accelerometer: motion.accelerometer,
          gyroscope: motion.gyroscope,
          type: mapMotionType(motion.activity),
          intensity: motion.intensity ?? 'low',
          duration: motion.duration
        } : undefined,
        fall: buildFallPayload(motion),
        deviceStatus: deviceStatus ? {
          batteryLevel: deviceStatus.batteryLevel,
          signalStrength: deviceStatus.signalStrength,
          charging: deviceStatus.charging,
          firmwareVersion: deviceStatus.firmwareVersion,
          lastSync: new Date()
        } : undefined,
        location: location || device.lastKnownLocation,
        timestamp: timestamp ? new Date(timestamp) : new Date()
      });

      await telemetry.save();

      // Update device last seen
      device.lastSeen = new Date();
      device.lastKnownLocation = location || device.lastKnownLocation;
      if (deviceStatus) {
        device.batteryLevel = deviceStatus.batteryLevel;
        device.signalStrength = deviceStatus.signalStrength;
      }
      await device.save();

      // Check for alerts
      const patient = await Patient.findById(telemetryPatientId);
      if (patient) {
        await checkAndTriggerAlerts(telemetry, patient, device);
      }

      // Emit real-time update via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`patient:${telemetryPatientId}`).emit('telemetry:update', {
          patientId: telemetryPatientId,
          deviceId: device.deviceId,
          vitals: buildRealtimeVitals(telemetry),
          motion: telemetry.motion
            ? {
                activity: telemetry.motion.type,
                fallDetected: telemetry.fall?.detected ?? false
              }
            : null,
          timestamp: telemetry.timestamp
        });
      }

      res.json({
        success: true,
        message: 'Telemetry received',
        data: {
          telemetryId: telemetry._id,
          timestamp: telemetry.timestamp
        }
      });

    } catch (error) {
      logger.error('Telemetry ingestion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process telemetry'
      });
    }
  }
);

/**
 * @route   POST /api/iot/telemetry/batch
 * @desc    Receive batch telemetry data from IoT devices
 * @access  Private (Device authenticated)
 */
router.post('/telemetry/batch',
  authenticateDevice,
  [
    body('deviceId').trim().notEmpty(),
    body('records').isArray({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const { deviceId, records } = req.body;

      const device = await IoTDevice.findOne({ deviceId }).populate('assignedPatient');
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not registered'
        });
      }

      const patientId = device.assignedPatient?._id;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: 'No patient associated with this device'
        });
      }

      // Process batch records
      const telemetryRecords = records.map((record) => ({
        patient: patientId,
        deviceId: device.deviceId,
        ...buildTelemetryVitals(record.vitals),
        motion: record.motion
          ? {
              accelerometer: record.motion.accelerometer,
              gyroscope: record.motion.gyroscope,
              type: mapMotionType(record.motion.activity),
              intensity: record.motion.intensity ?? 'low',
              duration: record.motion.duration
            }
          : undefined,
        fall: buildFallPayload(record.motion),
        deviceStatus: record.deviceStatus
          ? {
              batteryLevel: record.deviceStatus.batteryLevel,
              signalStrength: record.deviceStatus.signalStrength,
              charging: record.deviceStatus.charging,
              firmwareVersion: record.deviceStatus.firmwareVersion,
              lastSync: new Date()
            }
          : undefined,
        location: record.location,
        timestamp: new Date(record.timestamp)
      }));

      await IoTTelemetry.insertMany(telemetryRecords);

      // Update device last seen
      device.lastSeen = new Date();
      await device.save();

      res.json({
        success: true,
        message: `Batch of ${records.length} telemetry records received`,
        data: {
          recordsProcessed: records.length
        }
      });

    } catch (error) {
      logger.error('Batch telemetry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process batch telemetry'
      });
    }
  }
);

/**
 * @route   GET /api/iot/telemetry/:patientId
 * @desc    Get telemetry history for a patient
 * @access  Private
 */
router.get('/telemetry/:patientId',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('patientId').isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 })
  ],
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { startDate, endDate, limit = 100, type } = req.query;

      const query = { patient: patientId };

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      } else {
        // Default to last 24 hours
        query.timestamp = {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        };
      }

      const telemetry = await IoTTelemetry.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();

      res.json({
        success: true,
        data: {
          patientId,
          count: telemetry.length,
          telemetry
        }
      });

    } catch (error) {
      logger.error('Get telemetry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve telemetry'
      });
    }
  }
);

/**
 * @route   GET /api/iot/telemetry/:patientId/latest
 * @desc    Get latest telemetry for a patient
 * @access  Private
 */
router.get('/telemetry/:patientId/latest',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family']),
  [param('patientId').isMongoId()],
  async (req, res) => {
    try {
      const { patientId } = req.params;

      const latestTelemetry = await IoTTelemetry.findOne({
        patient: patientId
      })
        .sort({ timestamp: -1 })
        .lean();

      if (!latestTelemetry) {
        return res.json({
          success: true,
          data: null,
          message: 'No telemetry data found'
        });
      }

      res.json({
        success: true,
        data: latestTelemetry
      });

    } catch (error) {
      logger.error('Get latest telemetry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve latest telemetry'
      });
    }
  }
);

/**
 * @route   POST /api/iot/alert/fall
 * @desc    Receive fall detection alert from device
 * @access  Private (Device authenticated)
 */
router.post('/alert/fall',
  authenticateDevice,
  [
    body('deviceId').trim().notEmpty(),
    body('impactForce').optional().isFloat(),
    body('fallConfidence').optional().isInt({ min: 0, max: 100 }),
    body('location').optional().isObject(),
    body('accelerometerData').optional().isObject()
  ],
  async (req, res) => {
    try {
      const {
        deviceId,
        impactForce,
        fallConfidence,
        location,
        accelerometerData
      } = req.body;

      const device = await IoTDevice.findOne({ deviceId }).populate('assignedPatient');
      
      if (!device || !device.assignedPatient) {
        return res.status(404).json({
          success: false,
          message: 'Device or patient not found'
        });
      }

      const patient = device.assignedPatient;

      // Create fall alert
      const alert = new Alert({
        patient: patient._id,
        type: 'fall',
        severity: fallConfidence >= 80 ? 'critical' : 'high',
        source: 'iot_device',
        device: device._id,
        description: `Fall detected by ${device.deviceId}. Impact force: ${impactForce}g. Confidence: ${fallConfidence}%`,
        location: location || device.lastKnownLocation,
        vitalData: {
          impactForce,
          fallConfidence,
          accelerometerData
        },
        status: 'active',
        assignedCaregivers: patient.assignedCaregivers
      });

      await alert.save();

      // Create audit log
      await AuditLog.create({
        action: 'FALL_DETECTED',
        actor: {
          userId: device._id,
          type: 'device'
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `Fall detected for patient ${patient.firstName} ${patient.lastName}`,
          impactForce,
          fallConfidence,
          deviceId
        }
      });

      // Emit real-time alert
      const io = req.app.get('io');
      if (io) {
        io.to('role:admin').emit('alert:new', {
          id: alert._id,
          type: 'fall',
          severity: alert.severity,
          patient: {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`
          }
        });

        // Notify caregivers
        patient.assignedCaregivers.forEach(cgId => {
          io.to(`user:${cgId}`).emit('alert:new', alert);
        });
      }

      // Start escalation
      triggerAlertEscalation(alert._id).catch(err => 
        logger.error('Escalation error:', err)
      );

      res.status(201).json({
        success: true,
        message: 'Fall alert created',
        data: {
          alertId: alert._id,
          severity: alert.severity
        }
      });

    } catch (error) {
      logger.error('Fall alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process fall alert'
      });
    }
  }
);

/**
 * @route   POST /api/iot/alert/panic
 * @desc    Receive panic button alert from device
 * @access  Private (Device authenticated)
 */
router.post('/alert/panic',
  authenticateDevice,
  [
    body('deviceId').trim().notEmpty(),
    body('location').optional().isObject()
  ],
  async (req, res) => {
    try {
      const { deviceId, location } = req.body;

      const device = await IoTDevice.findOne({ deviceId }).populate('assignedPatient');
      
      if (!device || !device.assignedPatient) {
        return res.status(404).json({
          success: false,
          message: 'Device or patient not found'
        });
      }

      const patient = device.assignedPatient;

      // Create panic alert
      const alert = new Alert({
        patient: patient._id,
        type: 'panic',
        severity: 'critical',
        source: 'iot_device',
        device: device._id,
        description: `Panic button activated by ${patient.firstName} ${patient.lastName}`,
        location: location || device.lastKnownLocation,
        status: 'active',
        assignedCaregivers: patient.assignedCaregivers
      });

      await alert.save();

      // Create audit log
      await AuditLog.create({
        action: 'PANIC_ALERT',
        actor: {
          userId: device._id,
          type: 'device'
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `Panic button activated for patient ${patient.firstName} ${patient.lastName}`,
          deviceId,
          location
        }
      });

      // Emit real-time alert
      const io = req.app.get('io');
      if (io) {
        io.to('role:admin').emit('alert:new', {
          id: alert._id,
          type: 'panic',
          severity: 'critical',
          patient: {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`
          },
          message: '🚨 PANIC ALERT - Immediate response required!'
        });

        patient.assignedCaregivers.forEach(cgId => {
          io.to(`user:${cgId}`).emit('alert:panic', alert);
        });
      }

      // Start escalation immediately
      triggerAlertEscalation(alert._id).catch(err => 
        logger.error('Escalation error:', err)
      );

      res.status(201).json({
        success: true,
        message: 'Panic alert created',
        data: {
          alertId: alert._id
        }
      });

    } catch (error) {
      logger.error('Panic alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process panic alert'
      });
    }
  }
);

/**
 * @route   GET /api/iot/devices
 * @desc    List all IoT devices
 * @access  Private (admin)
 */
router.get('/devices',
  authenticate,
  authorize(['admin', 'chw']),
  [
    query('status').optional().isIn(['available', 'assigned', 'inactive', 'maintenance']),
    query('type').optional().isIn(['elderly_wearable', 'caregiver_device', 'home_hub', 'sensor'])
  ],
  async (req, res) => {
    try {
      const { status, type, page = 1, limit = 20 } = req.query;

      const query = {};
      if (status) query.status = status;
      if (type) query.deviceType = type;

      const skip = (page - 1) * limit;

      const [devices, total] = await Promise.all([
        IoTDevice.find(query)
          .populate('assignedPatient', 'firstName lastName status')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        IoTDevice.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          devices,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total
          }
        }
      });

    } catch (error) {
      logger.error('Get devices error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve devices'
      });
    }
  }
);

/**
 * @route   POST /api/iot/devices
 * @desc    Register a new IoT device
 * @access  Private (admin)
 */
router.post('/devices',
  authenticate,
  authorize(['admin']),
  [
    body('deviceId').trim().notEmpty().withMessage('Device ID required'),
    body('deviceType').isIn(['elderly_wearable', 'caregiver_device', 'home_hub', 'sensor'])
      .withMessage('Valid device type required'),
    body('model').optional().trim(),
    body('firmwareVersion').optional().trim()
  ],
  async (req, res) => {
    try {
      const { deviceId, deviceType, model, firmwareVersion, nfcTagId } = req.body;

      // Check if device already exists
      const existingDevice = await IoTDevice.findOne({ deviceId });
      if (existingDevice) {
        return res.status(409).json({
          success: false,
          message: 'Device ID already registered'
        });
      }

      const deviceSecret = crypto.randomBytes(32).toString('hex');

      const device = new IoTDevice({
        deviceId,
        deviceType,
        model,
        firmwareVersion,
        nfcTagId,
        status: 'available',
        deviceSecret: await bcrypt.hash(deviceSecret, 10),
        provisioning: {
          provisionedAt: new Date(),
          provisionedBy: req.user._id
        }
      });

      await device.save();

      // Create audit log
      await AuditLog.create({
        action: 'DEVICE_REGISTERED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'IoTDevice',
          id: device._id
        },
        details: {
          message: `Device registered: ${deviceId}`,
          deviceType,
          model
        }
      });

      res.status(201).json({
        success: true,
        message: 'Device registered successfully',
        data: {
          device: {
            id: device._id,
            deviceId: device.deviceId,
            deviceType: device.deviceType,
            status: device.status
          },
          deviceSecret // Only shown once!
        }
      });

    } catch (error) {
      logger.error('Register device error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to register device'
      });
    }
  }
);

/**
 * @route   GET /api/iot/devices/:id
 * @desc    Get device details
 * @access  Private (admin, chw)
 */
router.get('/devices/:id',
  authenticate,
  authorize(['admin', 'chw']),
  [param('id').isMongoId()],
  async (req, res) => {
    try {
      const device = await IoTDevice.findById(req.params.id)
        .populate('assignedPatient', 'firstName lastName status')
        .lean();

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      // Remove sensitive data
      delete device.deviceSecret;

      res.json({
        success: true,
        data: device
      });

    } catch (error) {
      logger.error('Get device error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve device'
      });
    }
  }
);

/**
 * @route   PUT /api/iot/devices/:id/status
 * @desc    Update device status
 * @access  Private (admin)
 */
router.put('/devices/:id/status',
  authenticate,
  authorize(['admin']),
  [
    param('id').isMongoId(),
    body('status').isIn(['available', 'assigned', 'inactive', 'maintenance']),
    body('reason').optional().trim()
  ],
  async (req, res) => {
    try {
      const { status, reason } = req.body;

      const device = await IoTDevice.findById(req.params.id);
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      device.status = status;
      if (status === 'maintenance') {
        device.maintenanceNotes = reason;
      }

      await device.save();

      res.json({
        success: true,
        message: 'Device status updated',
        data: device
      });

    } catch (error) {
      logger.error('Update device status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update device status'
      });
    }
  }
);

/**
 * @route   GET /api/iot/stats
 * @desc    Get IoT system statistics
 * @access  Private (admin)
 */
router.get('/stats',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const stats = await Promise.all([
        IoTDevice.countDocuments({ status: 'assigned' }),
        IoTDevice.countDocuments({ status: 'available' }),
        IoTDevice.countDocuments({ status: 'inactive' }),
        IoTDevice.countDocuments({ batteryLevel: { $lt: 20 } }),
        IoTTelemetry.countDocuments({
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);

      res.json({
        success: true,
        data: {
          devicesAssigned: stats[0],
          devicesAvailable: stats[1],
          devicesInactive: stats[2],
          devicesLowBattery: stats[3],
          telemetryRecords24h: stats[4]
        }
      });

    } catch (error) {
      logger.error('Get IoT stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve IoT statistics'
      });
    }
  }
);

// Helper function to check for alerts
async function checkAndTriggerAlerts(telemetry, patient, device) {
  const alerts = [];
  const thresholds = patient.vitalThresholds || {};

  // Check heart rate
  if (telemetry.heartRate?.value) {
    const hr = telemetry.heartRate.value;
    const hrThreshold = thresholds.heartRate || { min: 50, max: 120 };
    
    if (hr < hrThreshold.min || hr > hrThreshold.max) {
      alerts.push({
        type: 'vital_anomaly',
        severity: hr < 40 || hr > 150 ? 'critical' : 'high',
        description: `Abnormal heart rate: ${hr} bpm (normal: ${hrThreshold.min}-${hrThreshold.max})`,
        vitalType: 'heartRate',
        value: hr
      });
    }
  }

  // Check oxygen saturation
  if (telemetry.oxygenSaturation?.value) {
    const spo2 = telemetry.oxygenSaturation.value;
    const spo2Threshold = thresholds.oxygenSaturation || { min: 90 };
    
    if (spo2 < spo2Threshold.min) {
      alerts.push({
        type: 'vital_anomaly',
        severity: spo2 < 85 ? 'critical' : 'high',
        description: `Low oxygen saturation: ${spo2}% (minimum: ${spo2Threshold.min}%)`,
        vitalType: 'oxygenSaturation',
        value: spo2
      });
    }
  }

  if (telemetry.respiratoryRate?.value) {
    const respiratoryRate = telemetry.respiratoryRate.value;
    const rrThreshold = thresholds.respiratoryRate || { min: 12, max: 24 };

    if (respiratoryRate < rrThreshold.min || respiratoryRate > rrThreshold.max) {
      alerts.push({
        type: 'vital_anomaly',
        severity: respiratoryRate > 30 || respiratoryRate < 8 ? 'critical' : 'high',
        description:
          `Abnormal respiratory rate: ${respiratoryRate} breaths/min ` +
          `(normal: ${rrThreshold.min}-${rrThreshold.max})`,
        vitalType: 'respiratoryRate',
        value: respiratoryRate
      });
    }
  }

  if (telemetry.bloodGlucose?.value) {
    const bloodGlucose = telemetry.bloodGlucose.value;
    const glucoseThreshold = thresholds.bloodGlucose || { min: 70, max: 180 };

    if (bloodGlucose < glucoseThreshold.min || bloodGlucose > glucoseThreshold.max) {
      alerts.push({
        type: 'vital_anomaly',
        severity: bloodGlucose < 54 || bloodGlucose > 250 ? 'critical' : 'high',
        description:
          `Abnormal blood glucose: ${bloodGlucose} mg/dL ` +
          `(target: ${glucoseThreshold.min}-${glucoseThreshold.max})`,
        vitalType: 'bloodGlucose',
        value: bloodGlucose
      });
    }
  }

  // Check for fall
  if (telemetry.fall?.detected) {
    alerts.push({
      type: 'fall',
      severity: 'critical',
      description: `Fall detected with ${telemetry.fall.confidence ?? 0}% confidence`,
      impactForce: telemetry.fall.impactForce
    });
  }

  // Create alerts
  for (const alertData of alerts) {
    try {
      const alert = new Alert({
        patient: patient._id,
        type: alertData.type,
        severity: alertData.severity,
        source: 'iot_device',
        device: device._id,
        description: alertData.description,
        vitalData: alertData.vitalType ? {
          type: alertData.vitalType,
          value: alertData.value
        } : undefined,
        status: 'active',
        assignedCaregivers: patient.assignedCaregivers
      });

      await alert.save();
      
      triggerAlertEscalation(alert._id).catch(err => 
        logger.error('Escalation error:', err)
      );
    } catch (err) {
      logger.error('Failed to create alert:', err);
    }
  }

  return alerts;
}

export default router;

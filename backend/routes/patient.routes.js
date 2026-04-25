/**
 * CHENGETO Health - Patient Management Routes
 * Handles patient CRUD, vital thresholds, and IoT device assignments
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Alert from '../models/Alert.js';
import CheckIn from '../models/CheckIn.js';
import IoTDevice from '../models/IoTDevice.js';
import IoTTelemetry from '../models/IoTTelemetry.js';
import CareSchedule from '../models/CareSchedule.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';
import { authenticate, authorize, checkPermission } from '../middleware/auth.middleware.js';
import { encryptField, decryptField } from '../utils/encryption.js';
import { buildCarePlanPayload, buildCarePlanResponse } from '../utils/carePlan.js';
import { buildFunctionalBaselinePayload } from '../utils/functionalStatus.js';
import { buildMedicationSnapshot } from '../utils/medication.js';
import { buildRiskProfileForPatient, buildRiskProfilesForPatients } from '../services/riskScoring.service.js';
import { buildPatientAccessMatch } from './compat.utils.js';
import logger from '../config/logger.js';

const router = express.Router();

async function createPatientAuditLogSafe(req, action, patientId, details = {}, changes = undefined) {
  try {
    await AuditLog.log({
      action,
      category: 'patient_management',
      result: AUDIT_RESULT.SUCCESS,
      actor: {
        userId: req.user?._id,
        email: req.user?.email,
        role: req.user?.role
      },
      target: {
        type: 'patient',
        id: patientId,
        model: 'Patient'
      },
      request: {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      },
      changes,
      details
    });
  } catch (error) {
    logger.warn('Patient audit log creation failed', {
      action,
      patientId,
      error: error.message
    });
  }
}

/**
 * @route   GET /api/patients
 * @desc    Get all patients with filtering and pagination
 * @access  Private (admin, chw, clinician, caregiver)
 */
router.get('/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['active', 'inactive', 'critical']),
    query('facility').optional().isMongoId(),
    query('search').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        page = 1,
        limit = 20,
        status,
        facility,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query = {};

      // Role-based filtering
      if (req.user.role === 'caregiver') {
        // Caregivers can only see their assigned patients
        query.assignedCaregivers = req.user._id;
      } else if (req.user.role === 'chw') {
        // CHWs see patients in their facility
        query.facility = req.user.assignedFacility;
      }

      if (status) query.status = status;
      if (facility) query.facility = facility;

      // Search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { nationalId: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [patients, total] = await Promise.all([
        Patient.find(query)
          .populate('assignedCaregivers', 'firstName lastName phone email')
          .populate('primaryCaregiver', 'firstName lastName phone')
          .populate('facility', 'name address')
          .populate('assignedDevices', 'deviceId deviceType status')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Patient.countDocuments(query)
      ]);

      const riskProfiles = await buildRiskProfilesForPatients(patients);

      // Decrypt sensitive fields for display
      const decryptedPatients = patients.map(patient => ({
        ...patient,
        riskStratification: riskProfiles.get(String(patient._id)) || null
      }));

      res.json({
        success: true,
        data: {
          patients: decryptedPatients,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            perPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patients'
      });
    }
  }
);

/**
 * @route   GET /api/patients/:id
 * @desc    Get a single patient by ID
 * @access  Private (admin, chw, clinician, assigned caregiver, family)
 */
router.get('/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  [param('id').isMongoId().withMessage('Valid patient ID required')],
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id)
        .populate('assignedCaregivers', 'firstName lastName phone email')
        .populate('primaryCaregiver', 'firstName lastName phone')
        .populate('facility', 'name address contactInfo')
        .populate('assignedDevices', 'deviceId deviceType status lastSeen')
        .populate('medicalHistory.clinician', 'firstName lastName specialty')
        .lean();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Authorization check
      if (req.user.role === 'caregiver') {
        const isAssigned = patient.assignedCaregivers.some(
          cg => cg._id.toString() === req.user._id.toString()
        );
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to view this patient'
          });
        }
      } else if (req.user.role === 'family') {
        // Check if family member is linked to patient
        const familyLink = await User.findOne({
          _id: req.user._id,
          linkedPatients: patient._id
        });
        if (!familyLink) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to view this patient'
          });
        }
        // Family members see limited data
        delete patient.medicalHistory;
        delete patient.insuranceInfo;
      }

      patient.riskStratification = await buildRiskProfileForPatient(patient);

      res.json({
        success: true,
        data: patient
      });

    } catch (error) {
      logger.error('Get patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient'
      });
    }
  }
);

/**
 * @route   POST /api/patients
 * @desc    Create a new patient
 * @access  Private (admin, chw, clinician)
 */
router.post('/',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  [
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth required'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender required'),
    body('nationalId').optional().trim(),
    body('phone').optional().isMobilePhone(),
    body('address').optional().isObject(),
    body('village').optional().trim(),
    body('district').optional().trim(),
    body('province').optional().trim(),
    body('emergencyContact').isObject().withMessage('Emergency contact required'),
    body('emergencyContact.name').notEmpty(),
    body('emergencyContact.phone').isMobilePhone(),
    body('emergencyContact.relationship').notEmpty(),
    body('ncdConditions').optional().isArray(),
    body('allergies').optional().isArray(),
    body('bloodType').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']),
    body('facility').isMongoId().withMessage('Facility ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const patientData = req.body;
      const carePlan = buildCarePlanPayload(patientData.carePlan, {}, patientData.checkInFrequency);

      // Check for duplicate national ID
      if (patientData.nationalId) {
        const existing = await Patient.findOne({ nationalId: patientData.nationalId });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Patient with this national ID already exists'
          });
        }
      }

      // Create patient
      const patient = new Patient({
        ...patientData,
        carePlan,
        functionalBaseline: buildFunctionalBaselinePayload(patientData.functionalBaseline),
        consent: {
          ...patientData.consent,
          dataCollection: carePlan.consentSettings.dataCollection,
          familyAccess: carePlan.consentSettings.familyUpdates,
          emergencyDataSharing: carePlan.consentSettings.emergencySharing
        },
        createdBy: req.user._id,
        status: 'active'
      });

      // Set default vital thresholds based on NCD conditions
      patient.setDefaultThresholds();
      
      await patient.save();

      // Create initial care schedule
      await CareSchedule.create({
        patient: patient._id,
        checkInSchedule: {
          frequency: 'daily',
          preferredTimes: ['08:00', '14:00', '18:00'],
          windowMinutes: 60
        },
        createdBy: req.user._id
      });

      // Create audit log
      await createPatientAuditLogSafe(req, AUDIT_ACTIONS.PATIENT_CREATE, patient._id, {
        message: `Patient created: ${patient.firstName} ${patient.lastName}`,
        patientInfo: {
          nationalId: patient.nationalId,
          facility: patient.facility
        }
      });

      logger.info(`Patient created: ${patient._id} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Patient created successfully',
        data: patient
      });

    } catch (error) {
      logger.error('Create patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create patient',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * @route   GET /api/patients/:id/care-plan
 * @desc    Get structured care-plan data for a patient
 * @access  Private (admin, chw, clinician, caregiver, family)
 */
router.get('/:id/care-plan',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  [param('id').isMongoId().withMessage('Valid patient ID required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const patient = await Patient.findOne({
        _id: req.params.id,
        ...buildPatientAccessMatch(req.user)
      })
        .populate('primaryCaregiver', 'firstName lastName email phone role')
        .populate('assignedCHW', 'firstName lastName email phone role')
        .populate('assignedClinician', 'firstName lastName email phone role')
        .populate('familyMembers.user', 'firstName lastName email phone role')
        .lean({ virtuals: true, getters: true });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      const carePlan = buildCarePlanResponse(patient);

      res.json({
        success: true,
        data: carePlan,
        ...carePlan
      });
    } catch (error) {
      logger.error('Get patient care plan error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient care plan'
      });
    }
  }
);

/**
 * @route   PUT /api/patients/:id/care-plan
 * @desc    Update structured care-plan data for a patient
 * @access  Private (admin, chw, clinician)
 */
router.put('/:id/care-plan',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  [
    param('id').isMongoId().withMessage('Valid patient ID required'),
    body('carePlan').optional().isObject().withMessage('Care plan must be an object')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const patient = await Patient.findById(req.params.id);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      patient.carePlan = buildCarePlanPayload(
        req.body.carePlan ?? req.body,
        patient.carePlan ?? {},
        req.body.checkInFrequency
      );
      patient.consent = {
        ...patient.consent,
        dataCollection: patient.carePlan.consentSettings.dataCollection,
        familyAccess: patient.carePlan.consentSettings.familyUpdates,
        emergencyDataSharing: patient.carePlan.consentSettings.emergencySharing
      };
      patient.lastUpdatedBy = req.user._id;
      await patient.save();

      await createPatientAuditLogSafe(req, AUDIT_ACTIONS.PATIENT_UPDATE, patient._id, {
        message: 'Patient care plan updated'
      }, {
        after: {
          carePlan: patient.carePlan,
          consent: patient.consent
        }
      });

      const refreshedPatient = await Patient.findById(req.params.id)
        .populate('primaryCaregiver', 'firstName lastName email phone role')
        .populate('assignedCHW', 'firstName lastName email phone role')
        .populate('assignedClinician', 'firstName lastName email phone role')
        .populate('familyMembers.user', 'firstName lastName email phone role')
        .lean({ virtuals: true, getters: true });

      const carePlan = buildCarePlanResponse(refreshedPatient);

      res.json({
        success: true,
        message: 'Patient care plan updated successfully',
        data: carePlan,
        ...carePlan
      });
    } catch (error) {
      logger.error('Update patient care plan error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update patient care plan'
      });
    }
  }
);

/**
 * @route   GET /api/patients/:id/medications
 * @desc    Get structured medication adherence data for a patient
 * @access  Private (admin, chw, clinician, caregiver, family)
 */
router.get('/:id/medications',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  [param('id').isMongoId().withMessage('Valid patient ID required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const patient = await Patient.findOne({
        _id: req.params.id,
        ...buildPatientAccessMatch(req.user)
      }).lean({ virtuals: true, getters: true });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      const [schedule, recentCheckIns] = await Promise.all([
        CareSchedule.findOne({
          patient: patient._id,
          status: 'active'
        })
          .sort({ updatedAt: -1 })
          .lean(),
        CheckIn.find({
          patient: patient._id,
          status: 'completed'
        })
          .sort({ actualTime: -1, createdAt: -1 })
          .limit(40)
          .lean()
      ]);

      const medicationSnapshot = buildMedicationSnapshot(patient, schedule, recentCheckIns);

      res.json({
        success: true,
        data: medicationSnapshot,
        ...medicationSnapshot
      });
    } catch (error) {
      logger.error('Get patient medications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient medications'
      });
    }
  }
);

/**
 * @route   PUT /api/patients/:id
 * @desc    Update patient information
 * @access  Private (admin, chw, clinician)
 */
router.put('/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  [param('id').isMongoId()],
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Fields allowed for update
      const allowedUpdates = [
        'firstName', 'lastName', 'phone', 'address', 'village', 'district', 'province',
        'emergencyContact', 'ncdConditions', 'allergies', 'bloodType', 'medications',
        'medicalHistory', 'insuranceInfo', 'preferences', 'vitalThresholds'
      ];

      const updates = {};
      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      // Apply updates
      Object.assign(patient, updates);
      if (req.body.carePlan !== undefined || req.body.checkInFrequency !== undefined) {
        patient.carePlan = buildCarePlanPayload(
          req.body.carePlan ?? {},
          patient.carePlan ?? {},
          req.body.checkInFrequency
        );
        patient.consent = {
          ...patient.consent,
          dataCollection: patient.carePlan.consentSettings.dataCollection,
          familyAccess: patient.carePlan.consentSettings.familyUpdates,
          emergencyDataSharing: patient.carePlan.consentSettings.emergencySharing
        };
      }
      if (req.body.functionalBaseline !== undefined) {
        patient.functionalBaseline = buildFunctionalBaselinePayload(
          req.body.functionalBaseline,
          patient.functionalBaseline ?? {}
        );
      }
      await patient.save();

      // Create audit log
      await createPatientAuditLogSafe(req, AUDIT_ACTIONS.PATIENT_UPDATE, patient._id, {
        message: 'Patient information updated',
        updatedFields: Object.keys(updates)
      }, {
        after: updates
      });

      res.json({
        success: true,
        message: 'Patient updated successfully',
        data: patient
      });

    } catch (error) {
      logger.error('Update patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update patient'
      });
    }
  }
);

/**
 * @route   PUT /api/patients/:id/caregivers
 * @desc    Assign or update caregivers for a patient
 * @access  Private (admin, chw)
 */
router.put('/:id/caregivers',
  authenticate,
  authorize(['admin', 'chw']),
  [
    param('id').isMongoId(),
    body('caregivers').isArray({ min: 1 }).withMessage('At least one caregiver required'),
    body('primaryCaregiver').optional().isMongoId()
  ],
  async (req, res) => {
    try {
      const { caregivers, primaryCaregiver } = req.body;

      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Validate caregivers exist and have correct role
      const caregiverUsers = await User.find({
        _id: { $in: caregivers },
        role: 'caregiver',
        isActive: true
      });

      if (caregiverUsers.length !== caregivers.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more invalid caregiver IDs'
        });
      }

      // Update caregivers
      patient.assignedCaregivers = caregivers;
      
      if (primaryCaregiver && caregivers.includes(primaryCaregiver)) {
        patient.primaryCaregiver = primaryCaregiver;
      } else if (caregivers.length > 0) {
        patient.primaryCaregiver = caregivers[0];
      }

      await patient.save();

      // Create audit log
      await AuditLog.create({
        action: 'CAREGIVERS_ASSIGNED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Patient',
          id: patient._id
        },
        details: {
          message: 'Caregivers assigned to patient',
          assignedCaregivers: caregivers,
          primaryCaregiver: patient.primaryCaregiver
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Notify caregivers via socket
      const io = req.app.get('io');
      if (io) {
        caregivers.forEach(cgId => {
          io.to(`user:${cgId}`).emit('patient:assigned', {
            patientId: patient._id,
            patientName: `${patient.firstName} ${patient.lastName}`
          });
        });
      }

      res.json({
        success: true,
        message: 'Caregivers assigned successfully',
        data: {
          assignedCaregivers: patient.assignedCaregivers,
          primaryCaregiver: patient.primaryCaregiver
        }
      });

    } catch (error) {
      logger.error('Assign caregivers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign caregivers'
      });
    }
  }
);

/**
 * @route   PUT /api/patients/:id/devices
 * @desc    Assign IoT device to patient
 * @access  Private (admin)
 */
router.put('/:id/devices',
  authenticate,
  authorize(['admin']),
  [
    param('id').isMongoId(),
    body('deviceId').isMongoId().withMessage('Valid device ID required')
  ],
  async (req, res) => {
    try {
      const { deviceId } = req.body;

      const [patient, device] = await Promise.all([
        Patient.findById(req.params.id),
        IoTDevice.findById(deviceId)
      ]);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      if (device.status !== 'available') {
        return res.status(400).json({
          success: false,
          message: 'Device is not available for assignment'
        });
      }

      // Assign device to patient
      if (!patient.assignedDevices.includes(deviceId)) {
        patient.assignedDevices.push(deviceId);
      }

      // Update device status
      device.assignedPatient = patient._id;
      device.status = 'assigned';
      device.assignedAt = new Date();

      await Promise.all([patient.save(), device.save()]);

      // Create audit log
      await AuditLog.create({
        action: 'DEVICE_ASSIGNED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Patient',
          id: patient._id
        },
        details: {
          message: `Device ${device.deviceId} assigned to patient`,
          deviceId: device._id,
          deviceType: device.deviceType
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Device assigned successfully',
        data: {
          patient: patient._id,
          device: {
            id: device._id,
            deviceId: device.deviceId,
            deviceType: device.deviceType
          }
        }
      });

    } catch (error) {
      logger.error('Assign device error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign device'
      });
    }
  }
);

/**
 * @route   PUT /api/patients/:id/thresholds
 * @desc    Update patient vital thresholds
 * @access  Private (admin, clinician)
 */
router.put('/:id/thresholds',
  authenticate,
  authorize(['admin', 'clinician']),
  [
    param('id').isMongoId(),
    body('vitalThresholds').isObject()
  ],
  async (req, res) => {
    try {
      const { vitalThresholds } = req.body;

      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Validate threshold values
      const { heartRate, bloodPressure, oxygenSaturation, temperature } = vitalThresholds;

      if (heartRate) {
        if (heartRate.min < 30 || heartRate.max > 220) {
          return res.status(400).json({
            success: false,
            message: 'Invalid heart rate threshold range'
          });
        }
      }

      // Update thresholds
      patient.vitalThresholds = {
        ...patient.vitalThresholds,
        ...vitalThresholds
      };

      await patient.save();

      // Create audit log
      await AuditLog.create({
        action: 'VITAL_THRESHOLDS_UPDATED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Patient',
          id: patient._id
        },
        details: {
          message: 'Vital thresholds updated',
          newThresholds: vitalThresholds
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Vital thresholds updated successfully',
        data: patient.vitalThresholds
      });

    } catch (error) {
      logger.error('Update thresholds error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update thresholds'
      });
    }
  }
);

/**
 * @route   GET /api/patients/:id/vitals
 * @desc    Get patient vital history
 * @access  Private (admin, chw, clinician, assigned caregiver)
 */
router.get('/:id/vitals',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('type').optional().isIn(['heartRate', 'bloodPressure', 'oxygenSaturation', 'temperature', 'motion'])
  ],
  async (req, res) => {
    try {
      const { startDate, endDate, type } = req.query;
      
      // Default to last 7 days if no dates provided
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Build aggregation pipeline for vital data
      const matchStage = {
        patient: patient._id,
        timestamp: { $gte: start, $lte: end }
      };

      let vitalData = await IoTTelemetry.find(matchStage)
        .sort({ timestamp: 1 })
        .lean();

      // Filter by type if specified
      if (type) {
        vitalData = vitalData.map(record => ({
          timestamp: record.timestamp,
          [type]: record.vitals[type]
        }));
      }

      res.json({
        success: true,
        data: {
          patient: patient._id,
          dateRange: { start, end },
          vitals: vitalData
        }
      });

    } catch (error) {
      logger.error('Get vitals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve vitals'
      });
    }
  }
);

/**
 * @route   PUT /api/patients/:id/status
 * @desc    Update patient status
 * @access  Private (admin)
 */
router.put('/:id/status',
  authenticate,
  authorize(['admin']),
  [
    param('id').isMongoId(),
    body('status').isIn(['active', 'inactive', 'critical']).withMessage('Valid status required'),
    body('reason').optional().trim()
  ],
  async (req, res) => {
    try {
      const { status, reason } = req.body;

      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      const previousStatus = patient.status;
      patient.status = status;
      await patient.save();

      // Create audit log
      await AuditLog.create({
        action: 'PATIENT_STATUS_CHANGED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Patient',
          id: patient._id
        },
        details: {
          message: `Patient status changed from ${previousStatus} to ${status}`,
          previousStatus,
          newStatus: status,
          reason
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Patient status updated',
        data: {
          previousStatus,
          newStatus: status
        }
      });

    } catch (error) {
      logger.error('Update status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update status'
      });
    }
  }
);

/**
 * @route   DELETE /api/patients/:id
 * @desc    Archive/soft delete a patient
 * @access  Private (admin only)
 */
router.delete('/:id',
  authenticate,
  authorize(['admin']),
  [param('id').isMongoId()],
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Soft delete - archive the patient
      patient.status = 'archived';
      patient.archivedAt = new Date();
      patient.archivedBy = req.user._id;
      await patient.save();

      // Deactivate associated devices
      await IoTDevice.updateMany(
        { assignedPatient: patient._id },
        { status: 'available', assignedPatient: null }
      );

      // Create audit log
      await AuditLog.create({
        action: 'PATIENT_ARCHIVED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Patient',
          id: patient._id
        },
        details: {
          message: `Patient archived: ${patient.firstName} ${patient.lastName}`
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Patient archived successfully'
      });

    } catch (error) {
      logger.error('Archive patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to archive patient'
      });
    }
  }
);

/**
 * @route   GET /api/patients/:id/summary
 * @desc    Get patient dashboard summary
 * @access  Private (admin, chw, clinician, assigned caregiver, family)
 */
router.get('/:id/summary',
  authenticate,
  [
    param('id').isMongoId()
  ],
  async (req, res) => {
    try {
      const patient = await Patient.findById(req.params.id)
        .populate('assignedCaregivers', 'firstName lastName phone')
        .populate('primaryCaregiver', 'firstName lastName phone')
        .lean();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      const recentCheckIns = await CheckIn.find({ patient: patient._id })
        .sort({ timestamp: -1 })
        .limit(5)
        .populate('caregiver', 'firstName lastName')
        .lean();

      const activeAlerts = await Alert.find({
        patient: patient._id,
        status: { $in: ['active', 'acknowledged'] }
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const latestVitals = await IoTTelemetry.findOne({ patient: patient._id })
        .sort({ timestamp: -1 })
        .lean();

      // Get care schedule
      const careSchedule = await CareSchedule.findOne({ patient: patient._id }).lean();

      // Calculate compliance score
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const totalCheckIns = await CheckIn.countDocuments({
        patient: patient._id,
        timestamp: { $gte: thirtyDaysAgo }
      });
      
      const scheduledCheckIns = careSchedule ? 
        Math.floor(30 * careSchedule.checkInSchedule.preferredTimes.length) : 0;
      
      const complianceScore = scheduledCheckIns > 0 ?
        Math.round((totalCheckIns / scheduledCheckIns) * 100) : 0;

      res.json({
        success: true,
        data: {
          patient: {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            status: patient.status,
            age: calculateAge(patient.dateOfBirth),
            gender: patient.gender
          },
          primaryCaregiver: patient.primaryCaregiver,
          latestVitals: latestVitals?.vitals || null,
          recentCheckIns,
          activeAlerts,
          careSchedule: careSchedule ? {
            nextCheckIn: careSchedule.nextCheckIn,
            frequency: careSchedule.checkInSchedule.frequency
          } : null,
          complianceScore: Math.min(complianceScore, 100),
          medicalSummary: {
            conditions: patient.ncdConditions,
            allergies: patient.allergies,
            bloodType: patient.bloodType
          }
        }
      });

    } catch (error) {
      logger.error('Get patient summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient summary'
      });
    }
  }
);

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default router;

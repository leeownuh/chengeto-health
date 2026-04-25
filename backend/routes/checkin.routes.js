/**
 * CHENGETO Health - Check-In Routes
 * Handles caregiver check-ins with BLE/NFC verification
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import CheckIn from '../models/CheckIn.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import CareSchedule from '../models/CareSchedule.js';
import IoTDevice from '../models/IoTDevice.js';
import AuditLog from '../models/AuditLog.js';
import Alert from '../models/Alert.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { recordCareEvent } from '../services/blockchain.service.js';
import {
  buildFunctionalAssessmentPayload
} from '../utils/functionalStatus.js';
import {
  applyMedicationCheckInToSchedule,
  buildMedicationCatalog,
  calculateRecordedMedicationAdherence,
  normalizeMedicationCheckInPayload
} from '../utils/medication.js';
import logger from '../config/logger.js';

const router = express.Router();
const ACTIVE_MEDICATION_ALERT_STATUSES = ['pending', 'acknowledged', 'escalated'];

function buildHandoffEntries(input, userId, timestamp = new Date()) {
  if (!input || typeof input !== 'object') {
    return [];
  }

  const note = String(input.note || '').trim();
  if (!note) {
    return [];
  }

  return [
    {
      note,
      targetRole: ['caregiver', 'chw', 'clinician', 'admin', 'family'].includes(input.targetRole)
        ? input.targetRole
        : 'clinician',
      priority: ['low', 'medium', 'high', 'urgent'].includes(input.priority)
        ? input.priority
        : 'medium',
      status: 'pending',
      createdAt: timestamp,
      createdBy: userId
    }
  ];
}

function normalizeMood(value) {
  switch (value) {
    case 'normal':
      return 'neutral';
    case 'depressed':
      return 'sad';
    default:
      return value || 'neutral';
  }
}

function normalizeMobility(value) {
  switch (value) {
    case 'independent':
      return 'normal';
    case 'assisted':
      return 'needs_assistance';
    case 'wheelchair':
      return 'limited';
    case 'bedbound':
      return 'bedridden';
    default:
      return value || 'normal';
  }
}

async function updateMedicationAdherenceForPatient(patientId) {
  const recentCheckIns = await CheckIn.find({
    patient: patientId,
    status: 'completed',
    $or: [
      { 'medication.medications.0': { $exists: true } },
      { 'medication.dueTodayCount': { $gt: 0 } }
    ]
  })
    .sort({ actualTime: -1, createdAt: -1 })
    .limit(40)
    .lean();

  const adherence = calculateRecordedMedicationAdherence(recentCheckIns, 0);

  await Patient.updateOne(
    { _id: patientId },
    {
      $set: {
        'compliance.medicationAdherence': adherence
      }
    }
  );

  return adherence;
}

async function createMedicationAlertIfNeeded({
  patient,
  checkIn,
  title,
  message,
  severity = 'medium',
  triggerValue = {}
}) {
  const existing = await Alert.findOne({
    patient: patient._id,
    type: 'medication_missed',
    status: { $in: ACTIVE_MEDICATION_ALERT_STATUSES },
    title
  }).lean();

  if (existing) {
    return existing;
  }

  return Alert.create({
    patient: patient._id,
    type: 'medication_missed',
    severity,
    title,
    message,
    source: {
      type: 'manual',
      sensorType: 'medication_adherence',
      triggerValue
    },
    relatedCheckin: checkIn._id
  });
}

async function createMedicationAlertsForCheckIn({ patient, checkIn, medicationPayload }) {
  const missedEntries = (medicationPayload.medications || []).filter((entry) => entry.status === 'missed');
  const refillConcernEntries = (medicationPayload.medications || []).filter(
    (entry) => entry.refillConcern || entry.refillNeededSoon
  );

  if (missedEntries.length > 0) {
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const priorCheckIns = await CheckIn.find({
      patient: patient._id,
      _id: { $ne: checkIn._id },
      status: 'completed',
      $or: [
        { actualTime: { $gte: sevenDaysAgo } },
        { createdAt: { $gte: sevenDaysAgo } }
      ],
      'medication.missedCount': { $gt: 0 }
    })
      .select('medication')
      .lean();

    const priorMissCountByName = new Map();
    priorCheckIns.forEach((entry) => {
      (entry.medication?.medications || []).forEach((medication) => {
        if (medication?.status !== 'missed' || !medication?.name) {
          return;
        }

        const key = String(medication.name).trim().toLowerCase();
        priorMissCountByName.set(key, (priorMissCountByName.get(key) || 0) + 1);
      });
    });

    for (const medication of missedEntries) {
      const key = String(medication.name || '').trim().toLowerCase();
      const priorMisses = priorMissCountByName.get(key) || 0;
      if ((priorMisses + 1) < 2) {
        continue;
      }

      await createMedicationAlertIfNeeded({
        patient,
        checkIn,
        severity: priorMisses >= 2 ? 'high' : 'medium',
        title: `Repeated missed medication: ${medication.name}`,
        message: `${medication.name} has been missed multiple times in the last 7 days.`,
        triggerValue: {
          medication: medication.name,
          missedDosesLast7Days: priorMisses + 1,
          missedReason: medication.missedReason || medicationPayload.missedReason || undefined
        }
      });
    }
  }

  if (medicationPayload.refillConcern || refillConcernEntries.length > 0) {
    const medications = Array.from(
      new Set(refillConcernEntries.map((entry) => entry.name).filter(Boolean))
    );

    await createMedicationAlertIfNeeded({
      patient,
      checkIn,
      severity: 'medium',
      title: 'Medication refill risk',
      message:
        medications.length > 0
          ? `Refill follow-up needed for ${medications.join(', ')}.`
          : 'Medication refill follow-up is needed.',
      triggerValue: {
        medications
      }
    });
  }
}

async function createFunctionalAlertsForCheckIn({ patient, checkIn, functionalAssessment }) {
  if (!functionalAssessment?.recentFall) {
    return;
  }

  const title = functionalAssessment.fallInjury
    ? 'Recent fall with possible injury reported'
    : 'Recent fall reported during check-in';

  const existing = await Alert.findOne({
    patient: patient._id,
    type: 'fall_detected',
    status: { $in: ACTIVE_MEDICATION_ALERT_STATUSES },
    title
  }).lean();

  if (existing) {
    return existing;
  }

  return Alert.create({
    patient: patient._id,
    type: 'fall_detected',
    severity: functionalAssessment.fallInjury ? 'high' : 'medium',
    title,
    message: functionalAssessment.changeNotes || 'Caregiver reported a recent fall during a manual check-in.',
    source: {
      type: 'manual',
      sensorType: 'functional_assessment',
      triggerValue: {
        recentFall: true,
        nearFall: Boolean(functionalAssessment.nearFall),
        fallInjury: Boolean(functionalAssessment.fallInjury),
        fearOfFalling: Boolean(functionalAssessment.fearOfFalling)
      }
    },
    relatedCheckin: checkIn._id
  });
}

/**
 * @route   GET /api/checkins
 * @desc    Get check-ins with filtering
 * @access  Private (admin, chw, clinician, caregiver)
 */
router.get('/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  [
    query('patientId').optional().isMongoId(),
    query('caregiverId').optional().isMongoId(),
    query('status').optional().isIn(['completed', 'missed', 'in_progress', 'cancelled']),
    query('verificationMethod').optional().isIn(['nfc', 'ble', 'manual', 'qr_code']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const {
        patientId,
        caregiverId,
        status,
        verificationMethod,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      const query = {};

      // Role-based filtering
      if (req.user.role === 'caregiver') {
        query.caregiver = req.user._id;
      } else if (req.user.role === 'chw') {
        const patients = await Patient.find({ facility: req.user.assignedFacility }).select('_id');
        query.patient = { $in: patients.map(p => p._id) };
      }

      if (patientId) query.patient = patientId;
      if (caregiverId) query.caregiver = caregiverId;
      if (status) query.status = status;
      if (verificationMethod) query.verificationMethod = verificationMethod;

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [checkIns, total] = await Promise.all([
        CheckIn.find(query)
          .populate('patient', 'firstName lastName status')
          .populate('caregiver', 'firstName lastName role')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        CheckIn.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          checkIns,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            perPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get check-ins error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve check-ins'
      });
    }
  }
);

/**
 * @route   GET /api/checkins/:id
 * @desc    Get a single check-in by ID
 * @access  Private
 */
router.get('/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  [param('id').isMongoId()],
  async (req, res) => {
    try {
      const checkIn = await CheckIn.findById(req.params.id)
        .populate('patient', 'firstName lastName status address')
        .populate('caregiver', 'firstName lastName role phone')
        .lean();

      if (!checkIn) {
        return res.status(404).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      res.json({
        success: true,
        data: checkIn
      });

    } catch (error) {
      logger.error('Get check-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve check-in'
      });
    }
  }
);

/**
 * @route   POST /api/checkins/manual
 * @desc    Record a completed manual check-in in one step
 * @access  Private (admin, chw, caregiver, clinician)
 */
router.post('/manual',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    body('patientId').isMongoId().withMessage('Valid patient ID required'),
    body('method').optional().isIn(['manual_override', 'ble', 'nfc']),
    body('notes').optional().trim(),
    body('location').optional().isObject(),
    body('wellnessScore').optional().isFloat({ min: 1, max: 10 }),
    body('observations').optional().isArray(),
    body('functionalAssessment').optional().isObject(),
    body('handoff').optional().isObject(),
    body('vitalReadings').optional().isObject(),
    body('vitals').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const patient = await Patient.findById(req.body.patientId);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      const now = new Date();
      const score = Number.parseFloat(req.body.wellnessScore) || 5;
      const vitalsSource = req.body.vitalReadings || req.body.vitals || {};
      const method = req.body.method || 'manual_override';
      const activeSchedule = await CareSchedule.findOne({
        patient: patient._id,
        status: 'active'
      }).sort({ updatedAt: -1 });
      const handoffEntries = buildHandoffEntries(req.body.handoff, req.user._id, now);
      const medicationCatalog = buildMedicationCatalog(patient, activeSchedule, now);
      const medicationPayload = normalizeMedicationCheckInPayload(
        req.body.medications || {},
        medicationCatalog,
        now
      );
      const functionalAssessment = buildFunctionalAssessmentPayload(
        {
          ...(req.body.functionalAssessment || {}),
          mobility: req.body.functionalAssessment?.mobility ?? req.body.mobility
        },
        patient.functionalBaseline ?? {}
      );

      const checkIn = await CheckIn.create({
        patient: patient._id,
        caregiver: req.user._id,
        type: 'scheduled',
        verificationMethod: method,
        scheduledTime: now,
        actualTime: now,
        status: 'completed',
        location: req.body.location
          ? {
              latitude: req.body.location.latitude ?? req.body.location.lat,
              longitude: req.body.location.longitude ?? req.body.location.lng,
              accuracy: req.body.location.accuracy
            }
          : undefined,
        proximityVerification: {
          method,
          verified: true,
          verifiedAt: now,
          gpsCoordinates: req.body.location
            ? {
                latitude: req.body.location.latitude ?? req.body.location.lat,
                longitude: req.body.location.longitude ?? req.body.location.lng,
                accuracy: req.body.location.accuracy
              }
            : undefined
        },
        wellness: {
          overallStatus: score >= 8 ? 'good' : score >= 5 ? 'fair' : 'poor',
          mobility: normalizeMobility(req.body.mobility),
          mood: normalizeMood(req.body.mood),
          appearance: 'normal',
          consciousness: 'alert',
          pain: {
            present: false,
            level: 0
          }
        },
        wellnessAssessment: {
          overallScore: Math.round(score * 10),
          notes: req.body.notes || ''
        },
        vitals: {
          heartRate: vitalsSource.heartRate ? { value: Number(vitalsSource.heartRate), abnormal: false } : undefined,
          bloodPressure:
            vitalsSource.systolic || vitalsSource.diastolic
              ? {
                  systolic: vitalsSource.systolic ? Number(vitalsSource.systolic) : undefined,
                  diastolic: vitalsSource.diastolic ? Number(vitalsSource.diastolic) : undefined,
                  abnormal: false
                }
              : undefined,
          temperature: vitalsSource.temperature ? { value: Number(vitalsSource.temperature), abnormal: false } : undefined,
          oxygenSaturation:
            vitalsSource.spo2 || vitalsSource.oxygenSaturation
              ? { value: Number(vitalsSource.spo2 ?? vitalsSource.oxygenSaturation), abnormal: false }
              : undefined,
          respiratoryRate:
            vitalsSource.respiratoryRate
              ? { value: Number(vitalsSource.respiratoryRate), abnormal: false }
              : undefined,
          bloodGlucose:
            vitalsSource.bloodGlucose
              ? { value: Number(vitalsSource.bloodGlucose), abnormal: false }
              : undefined,
          weight: vitalsSource.weight ? { value: Number(vitalsSource.weight), abnormal: false } : undefined,
          cardiacRhythm:
            typeof vitalsSource.rhythmIrregularity === 'boolean'
              ? {
                  irregular: vitalsSource.rhythmIrregularity,
                  source: 'manual',
                  abnormal: vitalsSource.rhythmIrregularity
                }
              : undefined
        },
        medication: {
          ...medicationPayload
        },
        functionalStatus: functionalAssessment,
        notes: {
          caregiver: req.body.notes || '',
          concerns: Array.isArray(req.body.observations) ? req.body.observations : [],
          highlights: [],
          handoffs: handoffEntries
        },
        duration: Number(req.body.duration) || 0,
        followUp: handoffEntries.length > 0
          ? {
              required: true,
              reason: handoffEntries[0].note,
              priority: handoffEntries[0].priority
            }
          : undefined
      });

      try {
        const blockchainResult = await recordCareEvent({
          eventType: 'CHECKIN_COMPLETED',
          patientId: patient._id.toString(),
          actorId: req.user._id.toString(),
          metadata: {
            checkInId: checkIn._id.toString(),
            verificationMethod: method,
            source: 'manual',
            wellnessScore: score,
            notes: req.body.notes || ''
          }
        });

        checkIn.blockchainRecord = {
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          recordedAt: blockchainResult.recordedAt,
          dataHash: blockchainResult.dataHash
        };
        checkIn.blockchainHash = blockchainResult.transactionHash;
        await checkIn.save();
      } catch (bcError) {
        logger.warn('Manual check-in blockchain record failed:', bcError.message);
      }

      if (activeSchedule) {
        applyMedicationCheckInToSchedule(activeSchedule, medicationPayload, now);
        activeSchedule.lastModifiedBy = req.user._id;
        await activeSchedule.save();
      }

      const medicationAdherence = await updateMedicationAdherenceForPatient(patient._id);
      await createMedicationAlertsForCheckIn({
        patient,
        checkIn,
        medicationPayload
      });
      await createFunctionalAlertsForCheckIn({
        patient,
        checkIn,
        functionalAssessment
      });

      await Patient.updateOne(
        { _id: patient._id },
        {
          $set: {
            'compliance.lastCheckin': now,
            'compliance.consecutiveMissedCheckins': 0,
            'compliance.medicationAdherence': medicationAdherence
          }
        }
      );

      res.status(201).json({
        success: true,
        message: 'Check-in recorded successfully',
        data: checkIn
      });
    } catch (error) {
      logger.error('Manual check-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record manual check-in'
      });
    }
  }
);

/**
 * @route   POST /api/checkins/initiate
 * @desc    Initiate a check-in (BLE proximity detection)
 * @access  Private (caregiver, system)
 */
router.post('/initiate',
  authenticate,
  authorize(['admin', 'caregiver', 'system']),
  [
    body('patientId').isMongoId().withMessage('Valid patient ID required'),
    body('caregiverDeviceId').optional().isMongoId(),
    body('patientDeviceId').optional().isMongoId(),
    body('bleSignal').optional().isObject(),
    body('bleSignal.rssi').optional().isInt({ min: -100, max: 0 }),
    body('location').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        patientId,
        caregiverDeviceId,
        patientDeviceId,
        bleSignal,
        location
      } = req.body;

      // Verify patient and caregiver assignment
      const patient = await Patient.findById(patientId)
        .populate('assignedCaregivers', '_id');

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Verify caregiver is assigned to this patient
      const isAssigned = patient.assignedCaregivers.some(
        cg => cg._id.toString() === req.user._id.toString()
      );

      if (!isAssigned && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to check-in with this patient'
        });
      }

      // Check for existing in-progress check-in
      const existingCheckIn = await CheckIn.findOne({
        patient: patientId,
        caregiver: req.user._id,
        status: 'in_progress'
      });

      if (existingCheckIn) {
        return res.json({
          success: true,
          message: 'Check-in already in progress',
          data: existingCheckIn
        });
      }

      // Validate BLE proximity if provided
      let proximityVerified = false;
      if (bleSignal && bleSignal.rssi) {
        // RSSI threshold for proximity (typically -70 dBm or better for 1-2 meters)
        proximityVerified = bleSignal.rssi >= -70;
      }

      // Create check-in
      const checkIn = new CheckIn({
        patient: patientId,
        caregiver: req.user._id,
        status: 'in_progress',
        checkInTime: new Date(),
        verification: {
          ble: bleSignal ? {
            rssi: bleSignal.rssi,
            deviceId: patientDeviceId,
            timestamp: new Date(),
            proximityVerified
          } : null
        },
        location: location || patient.location,
        caregiverDevice: caregiverDeviceId,
        patientDevice: patientDeviceId
      });

      await checkIn.save();

      // Create audit log
      await AuditLog.create({
        action: 'CHECKIN_INITIATED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'CheckIn',
          id: checkIn._id
        },
        details: {
          message: `Check-in initiated for patient ${patient.firstName} ${patient.lastName}`,
          patientId,
          bleProximity: proximityVerified
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Check-in initiated',
        data: {
          checkInId: checkIn._id,
          status: checkIn.status,
          proximityVerified,
          requiresNfcVerification: !proximityVerified
        }
      });

    } catch (error) {
      logger.error('Initiate check-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate check-in'
      });
    }
  }
);

/**
 * @route   POST /api/checkins/:id/verify-nfc
 * @desc    Complete check-in with NFC tap verification
 * @access  Private (caregiver)
 */
router.post('/:id/verify-nfc',
  authenticate,
  authorize(['admin', 'caregiver']),
  [
    param('id').isMongoId(),
    body('nfcTagId').trim().notEmpty().withMessage('NFC tag ID required'),
    body('deviceSignature').optional().trim()
  ],
  async (req, res) => {
    try {
      const { nfcTagId, deviceSignature } = req.body;

      const checkIn = await CheckIn.findById(req.params.id)
        .populate('patient', 'firstName lastName assignedDevices');

      if (!checkIn) {
        return res.status(404).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      if (checkIn.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Check-in is not in progress'
        });
      }

      // Verify NFC tag belongs to patient
      const patientDevice = await IoTDevice.findOne({
        _id: { $in: checkIn.patient.assignedDevices },
        nfcTagId: nfcTagId,
        status: 'assigned'
      });

      if (!patientDevice) {
        return res.status(400).json({
          success: false,
          message: 'Invalid NFC tag - not associated with this patient'
        });
      }

      // Calculate verification timestamp
      const verificationTime = Date.now() - checkIn.checkInTime.getTime();

      // Update check-in with NFC verification
      checkIn.verification.nfc = {
        tagId: nfcTagId,
        timestamp: new Date(),
        deviceSignature,
        verified: true
      };
      checkIn.verificationMethod = 'nfc';
      checkIn.verification.verificationTime = verificationTime;

      await checkIn.save();

      // Create audit log
      await AuditLog.create({
        action: 'NFC_VERIFICATION',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'CheckIn',
          id: checkIn._id
        },
        details: {
          message: 'NFC verification completed',
          nfcTagId,
          verificationTime
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'NFC verification successful',
        data: {
          checkInId: checkIn._id,
          verification: checkIn.verification,
          requiresWellnessReport: true
        }
      });

    } catch (error) {
      logger.error('NFC verification error:', error);
      res.status(500).json({
        success: false,
        message: 'NFC verification failed'
      });
    }
  }
);

/**
 * @route   POST /api/checkins/:id/complete
 * @desc    Complete a check-in with wellness observations
 * @access  Private (caregiver)
 */
router.post('/:id/complete',
  authenticate,
  authorize(['admin', 'caregiver']),
  [
    param('id').isMongoId(),
    body('wellnessObservations').isObject().withMessage('Wellness observations required'),
    body('wellnessObservations.generalWellbeing').isIn(['good', 'fair', 'poor']),
    body('wellnessObservations.mobility').optional().isIn(['independent', 'assisted', 'bedbound']),
    body('wellnessObservations.mood').optional().isIn(['happy', 'neutral', 'sad', 'anxious']),
    body('wellnessObservations.appetite').optional().isIn(['good', 'fair', 'poor']),
    body('wellnessObservations.medicationTaken').optional().isBoolean(),
    body('vitalsRecorded').optional().isObject(),
    body('notes').optional().trim(),
    body('photos').optional().isArray(),
    body('tasksCompleted').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        wellnessObservations,
        vitalsRecorded,
        notes,
        photos,
        tasksCompleted
      } = req.body;

      const checkIn = await CheckIn.findById(req.params.id)
        .populate('patient', 'firstName lastName');

      if (!checkIn) {
        return res.status(404).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      if (checkIn.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Check-in is not in progress'
        });
      }

      // Calculate total check-in duration
      const checkInDuration = Date.now() - checkIn.checkInTime.getTime();

      // Complete the check-in
      checkIn.status = 'completed';
      checkIn.checkOutTime = new Date();
      checkIn.duration = checkInDuration;
      checkIn.wellnessObservations = {
        ...wellnessObservations,
        recordedAt: new Date()
      };
      
      if (vitalsRecorded) {
        checkIn.vitalsRecorded = vitalsRecorded;
      }
      
      if (notes) {
        checkIn.notes = notes;
      }
      
      if (photos) {
        checkIn.photos = photos;
      }
      
      if (tasksCompleted) {
        checkIn.tasksCompleted = tasksCompleted;
      }

      // Calculate overall wellness score
      checkIn.wellnessScore = calculateWellnessScore(wellnessObservations);

      await checkIn.save();

      // Update care schedule
      if (checkIn.schedule) {
        await CareSchedule.findByIdAndUpdate(checkIn.schedule._id, {
          lastCheckIn: {
            timestamp: checkIn.checkInTime,
            caregiver: checkIn.caregiver,
            status: 'completed'
          }
        });
      }

      // Record on blockchain
      try {
        const blockchainResult = await recordCareEvent({
          eventType: 'CHECKIN_COMPLETED',
          patientId: checkIn.patient._id.toString(),
          actorId: req.user._id.toString(),
          metadata: {
            checkInId: checkIn._id.toString(),
            verificationMethod: checkIn.verificationMethod,
            wellnessScore: checkIn.wellnessScore,
            duration: checkInDuration
          }
        });
        checkIn.blockchainRecord = {
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          recordedAt: blockchainResult.recordedAt,
          dataHash: blockchainResult.dataHash
        };
        checkIn.blockchainHash = blockchainResult.transactionHash;
        await checkIn.save();
      } catch (bcError) {
        logger.warn('Blockchain record failed:', bcError.message);
      }

      // Create audit log
      await AuditLog.create({
        action: 'CHECKIN_COMPLETED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'CheckIn',
          id: checkIn._id
        },
        details: {
          message: `Check-in completed for ${checkIn.patient.firstName} ${checkIn.patient.lastName}`,
          wellnessScore: checkIn.wellnessScore,
          duration: checkInDuration,
          verificationMethod: checkIn.verificationMethod
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Notify via socket
      const io = req.app.get('io');
      if (io) {
        io.to('role:admin').emit('checkin:completed', {
          id: checkIn._id,
          patient: checkIn.patient,
          caregiver: {
            id: req.user._id,
            name: `${req.user.firstName} ${req.user.lastName}`
          },
          wellnessScore: checkIn.wellnessScore
        });
      }

      res.json({
        success: true,
        message: 'Check-in completed successfully',
        data: {
          checkInId: checkIn._id,
          status: checkIn.status,
          wellnessScore: checkIn.wellnessScore,
          duration: checkInDuration,
          blockchainReference: checkIn.blockchainRecord
        }
      });

    } catch (error) {
      logger.error('Complete check-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete check-in'
      });
    }
  }
);

/**
 * @route   POST /api/checkins/:id/cancel
 * @desc    Cancel an in-progress check-in
 * @access  Private (caregiver)
 */
router.post('/:id/cancel',
  authenticate,
  authorize(['admin', 'caregiver']),
  [
    param('id').isMongoId(),
    body('reason').trim().notEmpty().withMessage('Cancellation reason required')
  ],
  async (req, res) => {
    try {
      const { reason } = req.body;

      const checkIn = await CheckIn.findById(req.params.id);

      if (!checkIn) {
        return res.status(404).json({
          success: false,
          message: 'Check-in not found'
        });
      }

      if (checkIn.status !== 'in_progress') {
        return res.status(400).json({
          success: false,
          message: 'Can only cancel in-progress check-ins'
        });
      }

      checkIn.status = 'cancelled';
      checkIn.cancellationReason = reason;
      checkIn.cancelledAt = new Date();
      checkIn.cancelledBy = req.user._id;

      await checkIn.save();

      // Create audit log
      await AuditLog.create({
        action: 'CHECKIN_CANCELLED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'CheckIn',
          id: checkIn._id
        },
        details: {
          message: 'Check-in cancelled',
          reason
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.json({
        success: true,
        message: 'Check-in cancelled'
      });

    } catch (error) {
      logger.error('Cancel check-in error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel check-in'
      });
    }
  }
);

/**
 * @route   GET /api/checkins/schedule/today
 * @desc    Get today's check-in schedule for caregiver
 * @access  Private (caregiver)
 */
router.get('/schedule/today',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get schedules for patients assigned to this caregiver
      let patientQuery = {};
      if (req.user.role === 'caregiver') {
        patientQuery = { assignedCaregivers: req.user._id };
      }

      const patients = await Patient.find(patientQuery)
        .select('_id firstName lastName')
        .lean();

      const patientIds = patients.map(p => p._id);

      // Get care schedules
      const schedules = await CareSchedule.find({
        patient: { $in: patientIds },
        isActive: true
      }).lean();

      // Get today's check-ins
      const todayCheckIns = await CheckIn.find({
        patient: { $in: patientIds },
        timestamp: { $gte: today, $lt: tomorrow }
      }).lean();

      // Build schedule response
      const scheduleItems = [];
      
      for (const schedule of schedules) {
        const patient = patients.find(p => p._id.toString() === schedule.patient.toString());
        
        for (const time of schedule.checkInSchedule.preferredTimes) {
          const existingCheckIn = todayCheckIns.find(
            ci => ci.patient.toString() === schedule.patient.toString() &&
                  ci.scheduledTime === time
          );

          scheduleItems.push({
            patient: {
              id: patient._id,
              name: `${patient.firstName} ${patient.lastName}`
            },
            scheduledTime: time,
            windowEnd: addMinutes(time, schedule.checkInSchedule.windowMinutes),
            status: existingCheckIn ? existingCheckIn.status : 'pending',
            checkInId: existingCheckIn?._id
          });
        }
      }

      // Sort by scheduled time
      scheduleItems.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

      res.json({
        success: true,
        data: {
          date: today,
          totalScheduled: scheduleItems.length,
          completed: scheduleItems.filter(s => s.status === 'completed').length,
          pending: scheduleItems.filter(s => s.status === 'pending').length,
          schedule: scheduleItems
        }
      });

    } catch (error) {
      logger.error('Get today schedule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve schedule'
      });
    }
  }
);

/**
 * @route   GET /api/checkins/patient/:patientId/history
 * @desc    Get check-in history for a patient
 * @access  Private
 */
router.get('/patient/:patientId/history',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family']),
  [
    param('patientId').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { limit = 30 } = req.query;

      const checkIns = await CheckIn.find({
        patient: patientId,
        status: 'completed'
      })
        .populate('caregiver', 'firstName lastName')
        .sort({ checkInTime: -1 })
        .limit(parseInt(limit))
        .lean();

      // Calculate statistics
      const stats = {
        total: checkIns.length,
        avgWellnessScore: checkIns.reduce((sum, ci) => sum + (ci.wellnessScore || 0), 0) / checkIns.length || 0,
        avgDuration: checkIns.reduce((sum, ci) => sum + (ci.duration || 0), 0) / checkIns.length || 0
      };

      res.json({
        success: true,
        data: {
          checkIns,
          statistics: stats
        }
      });

    } catch (error) {
      logger.error('Get check-in history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve check-in history'
      });
    }
  }
);

// Helper functions

function calculateWellnessScore(observations) {
  let score = 100;
  
  const wellbeingScores = { good: 0, fair: -15, poor: -30 };
  const mobilityScores = { independent: 0, assisted: -10, bedbound: -20 };
  const moodScores = { happy: 0, neutral: -5, sad: -15, anxious: -15 };
  const appetiteScores = { good: 0, fair: -10, poor: -20 };

  score += wellbeingScores[observations.generalWellbeing] || 0;
  score += mobilityScores[observations.mobility] || 0;
  score += moodScores[observations.mood] || 0;
  score += appetiteScores[observations.appetite] || 0;

  if (observations.medicationTaken === false) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function addMinutes(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

export default router;

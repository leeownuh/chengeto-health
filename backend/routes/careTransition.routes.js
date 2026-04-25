import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import CareTransition from '../models/CareTransition.js';
import Patient from '../models/Patient.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { buildPatientAccessMatch } from './compat.utils.js';
import {
  buildDefaultTransitionCheckpoints,
  buildTransitionSummary,
  buildTransitionTaskPayload,
  CARE_TRANSITION_CHECKPOINT_KEYS
} from '../utils/careTransition.js';

const router = express.Router();

async function createTransitionAuditSafe(req, action, transition, details = {}) {
  try {
    await AuditLog.log({
      action,
      category: 'care_transition',
      result: AUDIT_RESULT.SUCCESS,
      actor: {
        userId: req.user?._id,
        email: req.user?.email,
        role: req.user?.role
      },
      target: {
        type: 'care_transition',
        id: transition?._id,
        model: 'CareTransition'
      },
      request: {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      },
      details
    });
  } catch (error) {
    // Audit failure should not block care transitions.
  }
}

function buildDefaultFollowUpTasks(dischargeDate) {
  const baseDate = new Date(dischargeDate || Date.now());
  return buildTransitionTaskPayload([
    {
      title: 'Medication reconciliation',
      description: 'Confirm discharge medications and caregiver understanding.',
      ownerRole: 'clinician',
      dueDate: new Date(baseDate.getTime() + (2 * 24 * 60 * 60 * 1000)),
      priority: 'high'
    },
    {
      title: 'Home follow-up visit',
      description: 'Complete a post-discharge home visit and symptom review.',
      ownerRole: 'caregiver',
      dueDate: new Date(baseDate.getTime() + (3 * 24 * 60 * 60 * 1000)),
      priority: 'high'
    },
    {
      title: 'Community reassessment call',
      description: 'CHW to confirm transport, support, and red-flag symptoms.',
      ownerRole: 'chw',
      dueDate: new Date(baseDate.getTime() + (5 * 24 * 60 * 60 * 1000)),
      priority: 'medium'
    }
  ], baseDate);
}

async function getAccessiblePatient(req, patientId) {
  return Patient.findOne({
    _id: patientId,
    ...buildPatientAccessMatch(req.user)
  })
    .select('firstName lastName patientId primaryCaregiver assignedCHW assignedClinician')
    .lean({ getters: true, virtuals: true });
}

function mapTransitionPayload(transition, patient = null) {
  const summary = buildTransitionSummary(transition);

  return {
    _id: transition._id,
    transitionId: transition.transitionId,
    patient: patient
      ? {
          _id: patient._id,
          patientId: patient.patientId,
          name: `${patient.firstName} ${patient.lastName}`.trim()
        }
      : null,
    status: transition.status,
    transitionType: transition.transitionType,
    dischargeDate: transition.dischargeDate,
    dischargeReason: transition.dischargeReason,
    dischargeFacility: transition.dischargeFacility,
    diagnosisSummary: transition.diagnosisSummary,
    medicationChanges: transition.medicationChanges || [],
    redFlags: transition.redFlags || [],
    followUpTasks: summary?.followUpTasks || [],
    checkpoints: transition.checkpoints || {},
    nextReviewDate: transition.nextReviewDate,
    lastContactAt: transition.lastContactAt,
    outcomeSummary: transition.outcomeSummary,
    summary
  };
}

router.get(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  [
    query('status').optional().isIn(['active', 'completed', 'cancelled']),
    query('patientId').optional().isMongoId()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const accessiblePatients = await Patient.find(buildPatientAccessMatch(req.user))
      .select('_id patientId firstName lastName')
      .lean({ getters: true, virtuals: true });
    const patientIds = accessiblePatients.map((patient) => patient._id);

    const queryFilter = {
      patient: { $in: patientIds }
    };

    if (req.query.status) {
      queryFilter.status = req.query.status;
    }
    if (req.query.patientId) {
      const requestedPatientId = String(req.query.patientId);
      const isAccessiblePatient = patientIds.some((patientId) => String(patientId) === requestedPatientId);

      if (!isAccessiblePatient) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access transitions for this patient'
        });
      }

      queryFilter.patient = req.query.patientId;
    }

    const transitions = await CareTransition.find(queryFilter)
      .sort({ dischargeDate: -1, createdAt: -1 })
      .lean();
    const patientMap = new Map(accessiblePatients.map((patient) => [String(patient._id), patient]));

    const payload = transitions.map((transition) => (
      mapTransitionPayload(transition, patientMap.get(String(transition.patient)) || null)
    ));

    res.json({
      success: true,
      data: { transitions: payload },
      transitions: payload
    });
  }
);

router.get(
  '/patient/:patientId',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  [param('patientId').isMongoId()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const patient = await getAccessiblePatient(req, req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const transitions = await CareTransition.find({ patient: patient._id })
      .sort({ dischargeDate: -1, createdAt: -1 })
      .lean();

    const payload = transitions.map((transition) => mapTransitionPayload(transition, patient));

    res.json({
      success: true,
      data: { transitions: payload },
      transitions: payload
    });
  }
);

router.post(
  '/patient/:patientId',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  [
    param('patientId').isMongoId(),
    body('dischargeDate').isISO8601(),
    body('transitionType').optional().isIn(['hospital_discharge', 'ed_followup', 'transfer', 'post_acute']),
    body('followUpTasks').optional().isArray(),
    body('redFlags').optional().isArray(),
    body('medicationChanges').optional().isArray()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const patient = await getAccessiblePatient(req, req.params.patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found or not accessible' });
    }

    const dischargeDate = new Date(req.body.dischargeDate);
    const followUpTasks = Array.isArray(req.body.followUpTasks) && req.body.followUpTasks.length > 0
      ? buildTransitionTaskPayload(req.body.followUpTasks, dischargeDate)
      : buildDefaultFollowUpTasks(dischargeDate);

    const transition = await CareTransition.create({
      patient: patient._id,
      createdBy: req.user._id,
      assignedCaregiver: patient.primaryCaregiver,
      assignedCHW: patient.assignedCHW,
      assignedClinician: patient.assignedClinician,
      status: req.body.status || 'active',
      transitionType: req.body.transitionType || 'hospital_discharge',
      dischargeDate,
      dischargeReason: req.body.dischargeReason,
      dischargeFacility: req.body.dischargeFacility,
      diagnosisSummary: req.body.diagnosisSummary,
      medicationChanges: req.body.medicationChanges || [],
      redFlags: req.body.redFlags || [],
      followUpTasks,
      checkpoints: buildDefaultTransitionCheckpoints(dischargeDate, req.body.checkpoints || {}),
      nextReviewDate: req.body.nextReviewDate || null,
      lastContactAt: req.body.lastContactAt || null,
      outcomeSummary: req.body.outcomeSummary || ''
    });

    await createTransitionAuditSafe(req, AUDIT_ACTIONS.PATIENT_UPDATE, transition, {
      message: 'Care transition created',
      patientId: patient._id
    });

    res.status(201).json({
      success: true,
      data: mapTransitionPayload(transition.toObject(), patient),
      message: 'Care transition created successfully'
    });
  }
);

router.patch(
  '/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    body('status').optional().isIn(['active', 'completed', 'cancelled']),
    body('followUpTasks').optional().isArray()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const transition = await CareTransition.findById(req.params.id);
    if (!transition) {
      return res.status(404).json({ success: false, message: 'Care transition not found' });
    }

    const patient = await getAccessiblePatient(req, transition.patient);
    if (!patient) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this transition' });
    }

    const allowedFields = [
      'status',
      'dischargeReason',
      'dischargeFacility',
      'diagnosisSummary',
      'redFlags',
      'medicationChanges',
      'nextReviewDate',
      'lastContactAt',
      'outcomeSummary'
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        transition[field] = req.body[field];
      }
    });

    if (req.body.followUpTasks) {
      transition.followUpTasks = buildTransitionTaskPayload(req.body.followUpTasks, transition.dischargeDate);
    }

    if (req.body.checkpoints) {
      transition.checkpoints = buildDefaultTransitionCheckpoints(
        transition.dischargeDate,
        {
          ...(transition.checkpoints?.toObject?.() || transition.checkpoints || {}),
          ...(req.body.checkpoints || {})
        }
      );
    }

    await transition.save();
    await createTransitionAuditSafe(req, AUDIT_ACTIONS.PATIENT_UPDATE, transition, {
      message: 'Care transition updated'
    });

    res.json({
      success: true,
      data: mapTransitionPayload(transition.toObject(), patient),
      message: 'Care transition updated successfully'
    });
  }
);

router.post(
  '/:id/tasks/:taskId/complete',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    param('taskId').isMongoId(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const transition = await CareTransition.findById(req.params.id);
    if (!transition) {
      return res.status(404).json({ success: false, message: 'Care transition not found' });
    }

    const patient = await getAccessiblePatient(req, transition.patient);
    if (!patient) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this transition' });
    }

    const task = await transition.completeTask(req.params.taskId, req.user._id, req.body.notes || '');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Follow-up task not found' });
    }

    await createTransitionAuditSafe(req, AUDIT_ACTIONS.CHECKIN_UPDATE, transition, {
      message: 'Transition follow-up task completed',
      taskId: req.params.taskId
    });

    res.json({
      success: true,
      data: mapTransitionPayload(transition.toObject(), patient),
      message: 'Transition task completed successfully'
    });
  }
);

router.post(
  '/:id/checkpoints/:checkpointKey/complete',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    param('checkpointKey').isIn(CARE_TRANSITION_CHECKPOINT_KEYS),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const transition = await CareTransition.findById(req.params.id);
    if (!transition) {
      return res.status(404).json({ success: false, message: 'Care transition not found' });
    }

    const patient = await getAccessiblePatient(req, transition.patient);
    if (!patient) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this transition' });
    }

    const checkpoint = await transition.completeCheckpoint(
      req.params.checkpointKey,
      req.user._id,
      req.body.notes || ''
    );
    if (!checkpoint) {
      return res.status(404).json({ success: false, message: 'Checkpoint not found' });
    }

    await createTransitionAuditSafe(req, AUDIT_ACTIONS.CHECKIN_UPDATE, transition, {
      message: 'Transition checkpoint completed',
      checkpointKey: req.params.checkpointKey
    });

    res.json({
      success: true,
      data: mapTransitionPayload(transition.toObject(), patient),
      message: 'Transition checkpoint completed successfully'
    });
  }
);

export default router;

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import Alert from '../models/Alert.js';
import Patient from '../models/Patient.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { recordCareEvent } from '../services/blockchain.service.js';
import {
  ACTIVE_ALERT_STATUSES,
  buildPatientAccessMatch,
  legacyAlertTypesToDb,
  legacyStatusesToDb,
  mapAlertLegacy,
  parseLimit,
  parsePage
} from './compat.utils.js';

const router = express.Router();

const persistBlockchainAnchor = async (alert, req, eventType, metadata = {}, escalationLevel) => {
  try {
    const blockchainResult = await recordCareEvent({
      eventType,
      patientId: (alert.patient?._id || alert.patient).toString(),
      actorId: req.user._id.toString(),
      escalationLevel,
      metadata: {
        alertId: alert._id.toString(),
        alertType: alert.type,
        severity: alert.severity,
        status: alert.status,
        ...metadata
      }
    });

    alert.blockchainRecord = {
      transactionHash: blockchainResult.transactionHash,
      blockNumber: blockchainResult.blockNumber,
      recordedAt: blockchainResult.recordedAt,
      dataHash: blockchainResult.dataHash
    };
    alert.auditLog = alert.auditLog ?? [];
    alert.auditLog.push({
      action: 'blockchain_anchor',
      actor: req.user._id,
      timestamp: new Date(),
      details: {
        eventType,
        transactionHash: blockchainResult.transactionHash,
        blockNumber: blockchainResult.blockNumber,
        dataHash: blockchainResult.dataHash,
        contractAddress: blockchainResult.contractAddress
      }
    });
    await alert.save();
  } catch (error) {
    // Keep the user flow working even if blockchain anchoring fails.
    console.warn(`Alert blockchain anchor failed for ${eventType}:`, error.message);
  }
};

async function getAccessiblePatientIds(user) {
  if (['admin', 'clinician', 'auditor'].includes(user.role)) {
    return null;
  }

  const patients = await Patient.find(buildPatientAccessMatch(user)).select('_id').lean();
  return patients.map((patient) => patient._id);
}

async function getAccessibleAlert(req, alertId) {
  const patientIds = await getAccessiblePatientIds(req.user);
  const query = { _id: alertId };

  if (patientIds) {
    query.patient = { $in: patientIds };
  }

  return Alert.findOne(query)
    .populate('patient', 'firstName lastName patientId address status')
    .populate('acknowledgements.acknowledgedBy', 'firstName lastName role email phone')
    .populate('resolution.resolvedBy', 'firstName lastName role email phone')
    .populate('escalation.history.escalatedTo', 'firstName lastName role email phone')
    .lean();
}

router.get(
  '/stats',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  async (req, res) => {
    const patientIds = await getAccessiblePatientIds(req.user);
    const query = {};

    if (patientIds) {
      query.patient = { $in: patientIds };
    }

    const alerts = await Alert.find(query).lean();
    const stats = {
      total: alerts.length,
      active: 0,
      acknowledged: 0,
      escalated: 0,
      resolved: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const alert of alerts) {
      const normalizedStatus = alert.status === 'pending' ? 'active' : alert.status;
      if (stats[normalizedStatus] !== undefined) {
        stats[normalizedStatus] += 1;
      }
      if (stats[alert.severity] !== undefined) {
        stats[alert.severity] += 1;
      }
    }

    res.json({
      success: true,
      data: stats,
      ...stats
    });
  }
);

router.get(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20, 100);
    const patientIds = await getAccessiblePatientIds(req.user);
    const query = {};

    if (patientIds) {
      query.patient = { $in: patientIds };
    }

    if (req.query.status) {
      query.status = {
        $in: legacyStatusesToDb(
          String(req.query.status)
            .split(',')
            .map((status) => status.trim())
            .filter(Boolean)
        )
      };
    }

    if (req.query.severity) {
      query.severity = {
        $in: String(req.query.severity)
          .split(',')
          .map((severity) => severity.trim())
          .filter(Boolean)
      };
    }

    if (req.query.type) {
      query.type = {
        $in: legacyAlertTypesToDb(
          String(req.query.type)
            .split(',')
            .map((type) => type.trim())
            .filter(Boolean)
        )
      };
    }

    const [alerts, total] = await Promise.all([
      Alert.find(query)
        .populate('patient', 'firstName lastName patientId address status')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Alert.countDocuments(query)
    ]);

    const mapped = alerts
      .filter((alert) => {
        if (!req.query.search) {
          return true;
        }

        const search = String(req.query.search).toLowerCase();
        return [
          alert.title,
          alert.message,
          alert.alertId,
          alert.patient?.firstName,
          alert.patient?.lastName
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .map(mapAlertLegacy);

    res.json({
      success: true,
      data: {
        alerts: mapped,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          perPage: limit
        }
      },
      alerts: mapped,
      total
    });
  }
);

router.get(
  '/:id/history',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const alert = await getAccessibleAlert(req, req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const history = [
      {
        type: 'created',
        title: alert.title,
        description: alert.message,
        timestamp: alert.createdAt
      },
      ...(alert.acknowledgements ?? []).map((entry) => ({
        type: 'acknowledged',
        title: 'Alert acknowledged',
        description: entry.notes || 'Alert acknowledged',
        timestamp: entry.acknowledgedAt,
        actor: entry.acknowledgedBy
          ? `${entry.acknowledgedBy.firstName} ${entry.acknowledgedBy.lastName}`
          : entry.role
      })),
      ...(alert.escalation?.history ?? []).map((entry) => ({
        type: 'escalated',
        title: `Escalated to ${entry.role || entry.escalatedTo?.role || 'next level'}`,
        description: entry.reason || 'Alert escalated',
        timestamp: entry.escalatedAt,
        actor: entry.escalatedTo
          ? `${entry.escalatedTo.firstName} ${entry.escalatedTo.lastName}`
          : null
      })),
      ...(alert.auditLog ?? [])
        .filter((entry) => entry.action === 'note_added')
        .map((entry) => ({
          type: 'note',
          title: 'Note added',
          description: entry.details?.content || '',
          timestamp: entry.timestamp
        })),
      ...(alert.resolution?.resolvedAt
        ? [
            {
              type: 'resolved',
              title: 'Alert resolved',
              description: alert.resolution?.resolutionNotes || alert.resolution?.outcome || '',
              timestamp: alert.resolution.resolvedAt
            }
          ]
        : [])
    ]
      .filter((entry) => entry.timestamp)
      .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

    res.json({
      success: true,
      data: { history },
      history
    });
  }
);

router.get(
  '/:id/notes',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const alert = await getAccessibleAlert(req, req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const notes = [
      ...(alert.auditLog ?? [])
        .filter((entry) => entry.action === 'note_added')
        .map((entry, index) => ({
          _id: `${alert._id}-note-${index}`,
          content: entry.details?.content ?? '',
          createdAt: entry.timestamp,
          author: entry.actor
        }))
    ].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

    res.json({
      success: true,
      data: { notes },
      notes
    });
  }
);

router.post(
  '/:id/notes',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [param('id').isMongoId(), body('content').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const note = {
      _id: `${alert._id}-note-${Date.now()}`,
      content: req.body.content,
      createdAt: new Date(),
      author: {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }
    };

    alert.auditLog = alert.auditLog ?? [];
    alert.auditLog.push({
      action: 'note_added',
      actor: req.user._id,
      timestamp: note.createdAt,
      details: { content: req.body.content }
    });
    await alert.save();

    res.status(201).json(note);
  }
);

router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const alert = await getAccessibleAlert(req, req.params.id);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    const payload = mapAlertLegacy(alert);

    res.json({
      success: true,
      data: payload,
      ...payload
    });
  }
);

async function saveAcknowledgement(alertId, req, res) {
  const alert = await Alert.findById(alertId)
    .populate('patient', 'firstName lastName patientId address status')
    .populate('acknowledgements.acknowledgedBy', 'firstName lastName role email phone');

  if (!alert) {
    return res.status(404).json({ success: false, message: 'Alert not found' });
  }

  if (!ACTIVE_ALERT_STATUSES.includes(alert.status)) {
    return res.status(400).json({ success: false, message: 'Alert cannot be acknowledged' });
  }

  alert.acknowledgements = alert.acknowledgements ?? [];
  alert.acknowledgements.push({
    acknowledgedBy: req.user._id,
    role: req.user.role,
    acknowledgedAt: new Date(),
    responseTime: Math.floor((Date.now() - new Date(alert.createdAt).getTime()) / 1000),
    notes: req.body.notes || ''
  });
  if (alert.status === 'pending') {
    alert.status = 'acknowledged';
  }
  await alert.save();
  await persistBlockchainAnchor(alert, req, 'ALERT_ACKNOWLEDGED', {
    notes: req.body.notes || ''
  });

  const payload = mapAlertLegacy(alert.toObject({ virtuals: true }));
  return res.json({ success: true, data: payload, ...payload });
}

async function saveResolution(alertId, req, res) {
  const alert = await Alert.findById(alertId)
    .populate('patient', 'firstName lastName patientId address status')
    .populate('resolution.resolvedBy', 'firstName lastName role email phone');

  if (!alert) {
    return res.status(404).json({ success: false, message: 'Alert not found' });
  }

  const outcome = req.body.falseAlarm ? 'false_alarm' : req.body.outcome || 'resolved';
  alert.status = outcome === 'false_alarm' ? 'false_alarm' : 'resolved';
  alert.resolution = {
    ...(alert.resolution ?? {}),
    resolvedBy: req.user._id,
    resolvedAt: new Date(),
    resolutionType: outcome === 'false_alarm' ? 'false_alarm' : 'resolved',
    resolutionNotes: req.body.notes || req.body.resolution || '',
    followUpRequired: false,
    outcome
  };
  await alert.save();
  await persistBlockchainAnchor(alert, req, 'ALERT_RESOLVED', {
    outcome,
    notes: req.body.notes || req.body.resolution || ''
  });

  const payload = mapAlertLegacy(alert.toObject({ virtuals: true }));
  return res.json({ success: true, data: payload, ...payload });
}

async function saveEscalation(alertId, req, res) {
  const alert = await Alert.findById(alertId)
    .populate('patient', 'firstName lastName patientId address status')
    .populate('escalation.history.escalatedTo', 'firstName lastName role email phone');

  if (!alert) {
    return res.status(404).json({ success: false, message: 'Alert not found' });
  }

  const nextLevel = Math.min((alert.escalation?.currentLevel ?? 0) + 1, 3);
  alert.status = 'escalated';
  alert.escalation = {
    currentLevel: nextLevel,
    history: [
      ...(alert.escalation?.history ?? []),
      {
        level: nextLevel,
        escalatedAt: new Date(),
        role: req.user.role,
        reason: req.body.reason || 'Manual escalation',
        notificationSent: false
      }
    ]
  };
  await alert.save();
  await persistBlockchainAnchor(
    alert,
    req,
    'ALERT_ESCALATED',
    { reason: req.body.reason || 'Manual escalation' },
    nextLevel
  );

  const payload = mapAlertLegacy(alert.toObject({ virtuals: true }));
  return res.json({ success: true, data: payload, ...payload });
}

router.patch(
  '/:id/acknowledge',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveAcknowledgement(req.params.id, req, res)
);

router.put(
  '/:id/acknowledge',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveAcknowledgement(req.params.id, req, res)
);

router.patch(
  '/:id/resolve',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveResolution(req.params.id, req, res)
);

router.put(
  '/:id/resolve',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveResolution(req.params.id, req, res)
);

router.post(
  '/:id/escalate',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveEscalation(req.params.id, req, res)
);

router.patch(
  '/:id/escalate',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveEscalation(req.params.id, req, res)
);

router.put(
  '/:id/escalate',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => saveEscalation(req.params.id, req, res)
);

router.post(
  '/bulk-acknowledge',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const alertIds = Array.isArray(req.body.alertIds) ? req.body.alertIds : [];
    const alerts = await Alert.find({ _id: { $in: alertIds } });

    await Promise.all(
      alerts.map(async (alert) => {
        alert.acknowledgements = alert.acknowledgements ?? [];
        alert.acknowledgements.push({
          acknowledgedBy: req.user._id,
          role: req.user.role,
          acknowledgedAt: new Date(),
          responseTime: Math.floor((Date.now() - new Date(alert.createdAt).getTime()) / 1000),
          notes: ''
        });
        if (alert.status === 'pending') {
          alert.status = 'acknowledged';
        }
        await alert.save();
        await persistBlockchainAnchor(alert, req, 'ALERT_ACKNOWLEDGED');
      })
    );

    res.json({ success: true, count: alerts.length });
  }
);

router.post(
  '/bulk-resolve',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    const alertIds = Array.isArray(req.body.alertIds) ? req.body.alertIds : [];
    const alerts = await Alert.find({ _id: { $in: alertIds } });

    await Promise.all(
      alerts.map(async (alert) => {
        alert.status = 'resolved';
        alert.resolution = {
          ...(alert.resolution ?? {}),
          resolvedBy: req.user._id,
          resolvedAt: new Date(),
          resolutionType: 'resolved',
          resolutionNotes: '',
          followUpRequired: false,
          outcome: 'resolved'
        };
        await alert.save();
        await persistBlockchainAnchor(alert, req, 'ALERT_RESOLVED', {
          outcome: 'resolved'
        });
      })
    );

    res.json({ success: true, count: alerts.length });
  }
);

export default router;

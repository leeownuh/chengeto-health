/**
 * CHENGETO Health - Alert Management Routes
 * Handles alert creation, escalation, acknowledgment, and resolution
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Alert from '../models/Alert.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { escalateAlert } from '../services/escalation.service.js';
import { recordCareEvent } from '../services/blockchain.service.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts with filtering
 * @access  Private (admin, chw, clinician, caregiver)
 */
router.get('/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  [
    query('status').optional().isIn(['active', 'acknowledged', 'resolved', 'escalated', 'false_positive']),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('type').optional().isIn(['fall', 'panic', 'vital_anomaly', 'missed_checkin', 'device_offline', 'geofence']),
    query('patientId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        status,
        severity,
        type,
        patientId,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query = {};

      // Role-based filtering
      if (req.user.role === 'caregiver') {
        // Get patients assigned to this caregiver
        const assignedPatients = await Patient.find({
          assignedCaregivers: req.user._id
        }).select('_id');
        query.patient = { $in: assignedPatients.map(p => p._id) };
      } else if (req.user.role === 'chw') {
        const facilityPatients = await Patient.find({
          facility: req.user.assignedFacility
        }).select('_id');
        query.patient = { $in: facilityPatients.map(p => p._id) };
      }

      if (status) query.status = status;
      if (severity) query.severity = severity;
      if (type) query.type = type;
      if (patientId) query.patient = patientId;

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Execute query
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [alerts, total] = await Promise.all([
        Alert.find(query)
          .populate('patient', 'firstName lastName status')
          .populate('acknowledgedBy.user', 'firstName lastName role')
          .populate('resolvedBy', 'firstName lastName role')
          .populate('assignedCaregivers', 'firstName lastName phone')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Alert.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          alerts,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(total / limit),
            total,
            perPage: parseInt(limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve alerts'
      });
    }
  }
);

/**
 * @route   GET /api/alerts/active
 * @desc    Get all active alerts (for dashboard)
 * @access  Private
 */
router.get('/active',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  async (req, res) => {
    try {
      const query = {
        status: { $in: ['active', 'acknowledged', 'escalated'] }
      };

      // Role-based filtering
      if (req.user.role === 'caregiver') {
        const assignedPatients = await Patient.find({
          assignedCaregivers: req.user._id
        }).select('_id');
        query.patient = { $in: assignedPatients.map(p => p._id) };
      }

      const alerts = await Alert.find(query)
        .populate('patient', 'firstName lastName status location')
        .populate('assignedCaregivers', 'firstName lastName phone')
        .sort({ severity: -1, createdAt: -1 })
        .lean();

      // Group by severity for dashboard
      const groupedAlerts = {
        critical: alerts.filter(a => a.severity === 'critical'),
        high: alerts.filter(a => a.severity === 'high'),
        medium: alerts.filter(a => a.severity === 'medium'),
        low: alerts.filter(a => a.severity === 'low')
      };

      res.json({
        success: true,
        data: {
          total: alerts.length,
          grouped: groupedAlerts,
          alerts
        }
      });

    } catch (error) {
      logger.error('Get active alerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active alerts'
      });
    }
  }
);

/**
 * @route   GET /api/alerts/:id
 * @desc    Get a single alert by ID
 * @access  Private
 */
router.get('/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  [param('id').isMongoId()],
  async (req, res) => {
    try {
      const alert = await Alert.findById(req.params.id)
        .populate('patient', 'firstName lastName status location address emergencyContact')
        .populate('acknowledgedBy.user', 'firstName lastName role phone')
        .populate('resolvedBy', 'firstName lastName role')
        .populate('assignedCaregivers', 'firstName lastName phone email')
        .populate('escalationHistory.escalatedTo', 'firstName lastName role')
        .lean();

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: alert
      });

    } catch (error) {
      logger.error('Get alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve alert'
      });
    }
  }
);

/**
 * @route   POST /api/alerts
 * @desc    Create a new alert (typically from IoT or manual trigger)
 * @access  Private (system, admin, caregiver)
 */
router.post('/',
  authenticate,
  authorize(['admin', 'caregiver', 'system']),
  [
    body('patientId').isMongoId().withMessage('Valid patient ID required'),
    body('type').isIn(['fall', 'panic', 'vital_anomaly', 'missed_checkin', 'device_offline', 'geofence', 'manual'])
      .withMessage('Valid alert type required'),
    body('severity').isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Valid severity required'),
    body('source').optional().isIn(['iot_device', 'manual', 'system', 'caregiver_app']),
    body('description').optional().trim(),
    body('location').optional().isObject(),
    body('vitalData').optional().isObject(),
    body('deviceId').optional().isMongoId()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        patientId,
        type,
        severity,
        source = 'manual',
        description,
        location,
        vitalData,
        deviceId,
        manualTrigger
      } = req.body;

      // Verify patient exists
      const patient = await Patient.findById(patientId)
        .populate('assignedCaregivers', 'firstName lastName phone email');
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Create alert
      const alert = new Alert({
        patient: patientId,
        type,
        severity,
        source,
        description: description || getDefaultDescription(type),
        location: location || patient.location,
        vitalData,
        device: deviceId,
        status: 'active',
        assignedCaregivers: patient.assignedCaregivers.map(cg => cg._id || cg),
        escalationLevel: 0,
        manualTrigger: manualTrigger || false,
        createdBy: req.user._id
      });

      await alert.save();

      // Record on blockchain
      try {
        const blockchainResult = await recordCareEvent({
          eventType: 'ALERT_TRIGGERED',
          patientId: patientId.toString(),
          actorId: req.user._id.toString(),
          metadata: {
            alertId: alert._id.toString(),
            alertType: type,
            severity
          }
        });
        alert.blockchainRecord = {
          transactionHash: blockchainResult.transactionHash,
          blockNumber: blockchainResult.blockNumber,
          recordedAt: blockchainResult.recordedAt,
          dataHash: blockchainResult.dataHash
        };
        await alert.save();
      } catch (bcError) {
        logger.warn('Failed to record alert on blockchain:', bcError.message);
      }

      // Create audit log
      await AuditLog.create({
        action: 'ALERT_CREATED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `${type} alert created for patient ${patient.firstName} ${patient.lastName}`,
          alertType: type,
          severity,
          patientId
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Emit real-time notification via Socket.IO
      const io = req.app.get('io');
      if (io) {
        // Notify admins
        io.to('role:admin').emit('alert:new', {
          id: alert._id,
          type: alert.type,
          severity: alert.severity,
          patient: {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`
          },
          createdAt: alert.createdAt
        });

        // Notify assigned caregivers
        patient.assignedCaregivers.forEach(caregiver => {
          io.to(`user:${caregiver._id}`).emit('alert:new', {
            id: alert._id,
            type: alert.type,
            severity: alert.severity,
            patient: {
              id: patient._id,
              name: `${patient.firstName} ${patient.lastName}`
            },
            message: getAlertMessage(alert)
          });
        });
      }

      // Start escalation timer
      escalateAlert(alert._id).catch(err => 
        logger.error('Failed to start escalation:', err)
      );

      logger.info(`Alert created: ${alert._id} for patient ${patientId}`);

      res.status(201).json({
        success: true,
        message: 'Alert created successfully',
        data: alert
      });

    } catch (error) {
      logger.error('Create alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create alert'
      });
    }
  }
);

/**
 * @route   PUT /api/alerts/:id/acknowledge
 * @desc    Acknowledge an alert
 * @access  Private (admin, chw, clinician, caregiver)
 */
router.put('/:id/acknowledge',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    body('notes').optional().trim()
  ],
  async (req, res) => {
    try {
      const { notes } = req.body;

      const alert = await Alert.findById(req.params.id)
        .populate('patient', 'firstName lastName');
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      if (alert.status !== 'active' && alert.status !== 'escalated') {
        return res.status(400).json({
          success: false,
          message: 'Alert cannot be acknowledged in its current state'
        });
      }

      // Acknowledge alert
      alert.status = 'acknowledged';
      alert.acknowledgedBy = {
        user: req.user._id,
        timestamp: new Date(),
        notes,
        responseTime: Date.now() - alert.createdAt.getTime()
      };
      
      await alert.save();

      // Record on blockchain
      try {
        await recordCareEvent({
          eventType: 'ALERT_ACKNOWLEDGED',
          patientId: alert.patient._id.toString(),
          actorId: req.user._id.toString(),
          metadata: {
            alertId: alert._id.toString(),
            responseTime: alert.acknowledgedBy.responseTime
          }
        });
      } catch (bcError) {
        logger.warn('Blockchain record failed:', bcError.message);
      }

      // Create audit log
      await AuditLog.create({
        action: 'ALERT_ACKNOWLEDGED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `Alert acknowledged by ${req.user.firstName} ${req.user.lastName}`,
          responseTime: alert.acknowledgedBy.responseTime,
          notes
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Notify via socket
      const io = req.app.get('io');
      if (io) {
        io.to('role:admin').emit('alert:acknowledged', {
          id: alert._id,
          acknowledgedBy: {
            id: req.user._id,
            name: `${req.user.firstName} ${req.user.lastName}`
          }
        });
      }

      res.json({
        success: true,
        message: 'Alert acknowledged',
        data: alert
      });

    } catch (error) {
      logger.error('Acknowledge alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to acknowledge alert'
      });
    }
  }
);

/**
 * @route   PUT /api/alerts/:id/resolve
 * @desc    Resolve an alert
 * @access  Private (admin, chw, clinician, caregiver)
 */
router.put('/:id/resolve',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    body('resolution').trim().notEmpty().withMessage('Resolution notes required'),
    body('outcome').isIn(['resolved', 'false_positive', 'no_action_needed'])
      .withMessage('Valid outcome required'),
    body('actionsTaken').optional().isArray()
  ],
  async (req, res) => {
    try {
      const { resolution, outcome, actionsTaken } = req.body;

      const alert = await Alert.findById(req.params.id)
        .populate('patient', 'firstName lastName');
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      if (!['active', 'acknowledged', 'escalated'].includes(alert.status)) {
        return res.status(400).json({
          success: false,
          message: 'Alert cannot be resolved in its current state'
        });
      }

      // Resolve alert
      alert.status = outcome === 'false_positive' ? 'false_positive' : 'resolved';
      alert.resolvedBy = req.user._id;
      alert.resolvedAt = new Date();
      alert.resolution = {
        notes: resolution,
        outcome,
        actionsTaken: actionsTaken || []
      };
      
      // Calculate total resolution time
      alert.resolutionTime = Date.now() - alert.createdAt.getTime();
      
      await alert.save();

      // Record on blockchain
      try {
        await recordCareEvent({
          eventType: 'ALERT_RESOLVED',
          patientId: alert.patient._id.toString(),
          actorId: req.user._id.toString(),
          metadata: {
            alertId: alert._id.toString(),
            outcome,
            resolutionTime: alert.resolutionTime
          }
        });
      } catch (bcError) {
        logger.warn('Blockchain record failed:', bcError.message);
      }

      // Create audit log
      await AuditLog.create({
        action: 'ALERT_RESOLVED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `Alert resolved: ${outcome}`,
          resolution,
          outcome,
          actionsTaken,
          resolutionTime: alert.resolutionTime
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Notify via socket
      const io = req.app.get('io');
      if (io) {
        io.to('role:admin').emit('alert:resolved', {
          id: alert._id,
          resolvedBy: {
            id: req.user._id,
            name: `${req.user.firstName} ${req.user.lastName}`
          },
          outcome
        });
      }

      res.json({
        success: true,
        message: 'Alert resolved',
        data: alert
      });

    } catch (error) {
      logger.error('Resolve alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve alert'
      });
    }
  }
);

/**
 * @route   PUT /api/alerts/:id/escalate
 * @desc    Manually escalate an alert
 * @access  Private (admin, chw, clinician)
 */
router.put('/:id/escalate',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  [
    param('id').isMongoId(),
    body('reason').trim().notEmpty().withMessage('Escalation reason required')
  ],
  async (req, res) => {
    try {
      const { reason } = req.body;

      const alert = await Alert.findById(req.params.id)
        .populate('patient', 'firstName lastName');
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Escalate alert
      const previousLevel = alert.escalationLevel;
      alert.escalationLevel = Math.min(alert.escalationLevel + 1, 3);
      alert.status = 'escalated';
      
      alert.escalationHistory.push({
        level: alert.escalationLevel,
        timestamp: new Date(),
        escalatedBy: req.user._id,
        escalatedTo: await getEscalationRecipient(alert.escalationLevel),
        reason
      });
      
      await alert.save();

      // Create audit log
      await AuditLog.create({
        action: 'ALERT_ESCALATED',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `Alert escalated from level ${previousLevel} to ${alert.escalationLevel}`,
          reason,
          previousLevel,
          newLevel: alert.escalationLevel
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Notify via socket
      const io = req.app.get('io');
      if (io) {
        // Notify next level responders
        io.to(`escalation:level${alert.escalationLevel}`).emit('alert:escalated', {
          id: alert._id,
          escalationLevel: alert.escalationLevel,
          patient: alert.patient
        });
      }

      res.json({
        success: true,
        message: 'Alert escalated',
        data: alert
      });

    } catch (error) {
      logger.error('Escalate alert error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to escalate alert'
      });
    }
  }
);

/**
 * @route   POST /api/alerts/:id/respond
 * @desc    Record a response action to an alert
 * @access  Private (caregiver, chw, clinician)
 */
router.post('/:id/respond',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    body('action').isIn(['calling', 'visiting', 'contacting_family', 'dispatching_ambulance', 'other'])
      .withMessage('Valid action required'),
    body('notes').optional().trim(),
    body('estimatedArrival').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const { action, notes, estimatedArrival } = req.body;

      const alert = await Alert.findById(req.params.id);
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found'
        });
      }

      // Add response action
      alert.responseActions.push({
        action,
        performedBy: req.user._id,
        timestamp: new Date(),
        notes,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null
      });

      // Auto-acknowledge if not already
      if (alert.status === 'active') {
        alert.status = 'acknowledged';
        alert.acknowledgedBy = {
          user: req.user._id,
          timestamp: new Date(),
          notes: `Auto-acknowledged due to response action: ${action}`
        };
      }

      await alert.save();

      // Create audit log
      await AuditLog.create({
        action: 'ALERT_RESPONSE',
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        resource: {
          type: 'Alert',
          id: alert._id
        },
        details: {
          message: `Response action: ${action}`,
          action,
          notes
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Notify via socket
      const io = req.app.get('io');
      if (io) {
        io.to('role:admin').emit('alert:response', {
          alertId: alert._id,
          action,
          performedBy: {
            id: req.user._id,
            name: `${req.user.firstName} ${req.user.lastName}`
          }
        });
      }

      res.json({
        success: true,
        message: 'Response recorded',
        data: alert
      });

    } catch (error) {
      logger.error('Record response error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record response'
      });
    }
  }
);

/**
 * @route   GET /api/alerts/stats/summary
 * @desc    Get alert statistics summary
 * @access  Private (admin, chw, clinician)
 */
router.get('/stats/summary',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'auditor']),
  async (req, res) => {
    try {
      const { startDate, endDate, facilityId } = req.query;

      const matchStage = {};
      
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      // Role-based filtering
      if (req.user.role === 'chw' || facilityId) {
        const patients = await Patient.find({
          facility: facilityId || req.user.assignedFacility
        }).select('_id');
        matchStage.patient = { $in: patients.map(p => p._id) };
      }

      const stats = await Alert.aggregate([
        { $match: matchStage },
        {
          $facet: {
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            bySeverity: [
              { $group: { _id: '$severity', count: { $sum: 1 } } }
            ],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 } } }
            ],
            avgResponseTime: [
              { $match: { 'acknowledgedBy.responseTime': { $exists: true } } },
              { $group: { _id: null, avgTime: { $avg: '$acknowledgedBy.responseTime' } } }
            ],
            avgResolutionTime: [
              { $match: { resolutionTime: { $exists: true } } },
              { $group: { _id: null, avgTime: { $avg: '$resolutionTime' } } }
            ],
            total: [
              { $count: 'count' }
            ]
          }
        }
      ]);

      const result = stats[0];

      res.json({
        success: true,
        data: {
          total: result.total[0]?.count || 0,
          byStatus: result.byStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          bySeverity: result.bySeverity.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          byType: result.byType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          avgResponseTime: result.avgResponseTime[0]?.avgTime || null,
          avgResolutionTime: result.avgResolutionTime[0]?.avgTime || null
        }
      });

    } catch (error) {
      logger.error('Get alert stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve alert statistics'
      });
    }
  }
);

// Helper functions

function getDefaultDescription(type) {
  const descriptions = {
    fall: 'Fall detected by IoT device',
    panic: 'Panic button activated',
    vital_anomaly: 'Vital signs outside normal range',
    missed_checkin: 'Scheduled check-in not completed',
    device_offline: 'Patient device offline or unreachable',
    geofence: 'Patient has left designated safe zone',
    manual: 'Manual alert triggered by caregiver'
  };
  return descriptions[type] || 'Alert triggered';
}

function getAlertMessage(alert) {
  const messages = {
    fall: `🚨 Fall detected for ${alert.patient?.firstName || 'patient'}. Immediate attention required.`,
    panic: `🚨 PANIC ALERT from ${alert.patient?.firstName || 'patient'}. Urgent response needed.`,
    vital_anomaly: `⚠️ Abnormal vitals detected for ${alert.patient?.firstName || 'patient'}.`,
    missed_checkin: `⚠️ Missed check-in for ${alert.patient?.firstName || 'patient'}.`,
    device_offline: `📱 Device offline for ${alert.patient?.firstName || 'patient'}.`,
    geofence: `📍 Geofence alert for ${alert.patient?.firstName || 'patient'}.`
  };
  return messages[alert.type] || 'Alert triggered';
}

async function getEscalationRecipient(level) {
  // Get appropriate recipient based on escalation level
  const roles = {
    1: 'caregiver',
    2: 'chw',
    3: 'clinician'
  };
  
  const recipient = await User.findOne({
    role: roles[level] || 'admin',
    isActive: true
  }).select('_id');
  
  return recipient?._id;
}

export default router;

/**
 * Escalation Service
 * Handles automatic alert escalation based on time thresholds
 */

import { Alert, User, Patient } from '../models/index.js';
import { ALERT_STATUS, ESCALATION_LEVELS } from '../models/Alert.js';
import { logger } from '../config/logger.js';
import { emitAlert, emitToUser } from './socket.service.js';
import schedule from 'node-schedule';

// Escalation timeouts in minutes
const ESCALATION_TIMEOUTS = {
  [ESCALATION_LEVELS.LEVEL_1]: parseInt(process.env.ESCALATION_LEVEL1_TIMEOUT) || 5,
  [ESCALATION_LEVELS.LEVEL_2]: parseInt(process.env.ESCALATION_LEVEL2_TIMEOUT) || 10,
  [ESCALATION_LEVELS.LEVEL_3]: parseInt(process.env.ESCALATION_LEVEL3_TIMEOUT) || 15
};

// Notification channels
const CHANNELS = {
  PUSH: 'push',
  SMS: 'sms',
  USSD: 'ussd',
  EMAIL: 'email'
};

let escalationJobs = new Map(); // alertId -> job

/**
 * Initialize escalation service
 */
export const initializeEscalationService = () => {
  // Run escalation check every minute
  schedule.scheduleJob('* * * * *', checkPendingEscalations);
  
  logger.info('Escalation service initialized');
};

/**
 * Start escalation for a new alert
 */
export const startEscalation = async (alert) => {
  if (!alert || !alert._id) {
    logger.error('Invalid alert for escalation');
    return;
  }

  // Set initial escalation level and next escalation time
  alert.escalation.currentLevel = ESCALATION_LEVELS.LEVEL_1;
  alert.escalation.nextEscalationAt = new Date(Date.now() + ESCALATION_TIMEOUTS[ESCALATION_LEVELS.LEVEL_1] * 60000);
  
  await alert.save();

  // Schedule escalation job
  scheduleEscalationJob(alert);

  // Notify Level 1 responders (caregivers)
  await notifyLevel(alert, ESCALATION_LEVELS.LEVEL_1);

  logger.info('Escalation started', {
    alertId: alert._id,
    nextEscalation: alert.escalation.nextEscalationAt
  });

  return alert;
};

/**
 * Schedule escalation job
 */
const scheduleEscalationJob = (alert) => {
  const alertId = alert._id.toString();

  // Cancel existing job if any
  cancelEscalationJob(alertId);

  if (alert.escalation.nextEscalationAt) {
    const job = schedule.scheduleJob(alert.escalation.nextEscalationAt, async () => {
      await performEscalation(alertId);
    });

    escalationJobs.set(alertId, job);
  }
};

/**
 * Cancel escalation job
 */
const cancelEscalationJob = (alertId) => {
  const job = escalationJobs.get(alertId);
  if (job) {
    job.cancel();
    escalationJobs.delete(alertId);
  }
};

/**
 * Perform escalation
 */
const performEscalation = async (alertId) => {
  try {
    const alert = await Alert.findById(alertId)
      .populate('patient')
      .populate('acknowledgements.acknowledgedBy');

    if (!alert) {
      logger.warn('Alert not found for escalation', { alertId });
      cancelEscalationJob(alertId);
      return;
    }

    // Check if alert is resolved
    if (alert.status === ALERT_STATUS.RESOLVED || 
        alert.status === ALERT_STATUS.FALSE_ALARM ||
        alert.status === ALERT_STATUS.CLOSED) {
      cancelEscalationJob(alertId);
      return;
    }

    // Check if alert has been acknowledged
    if (alert.status === ALERT_STATUS.ACKNOWLEDGED) {
      // Don't escalate acknowledged alerts
      cancelEscalationJob(alertId);
      return;
    }

    const currentLevel = alert.escalation.currentLevel;
    const nextLevel = currentLevel + 1;

    // Check if we've reached max escalation level
    if (nextLevel > ESCALATION_LEVELS.LEVEL_3) {
      logger.warn('Alert reached max escalation level without resolution', {
        alertId,
        currentLevel
      });
      
      // Mark for manual intervention
      alert.status = ALERT_STATUS.ESCALATED;
      alert.escalation.nextEscalationAt = null;
      await alert.save();
      
      cancelEscalationJob(alertId);
      return;
    }

    // Perform escalation to next level
    await escalateToLevel(alert, nextLevel);

  } catch (error) {
    logger.error('Escalation error', { alertId, error: error.message });
  }
};

/**
 * Escalate alert to specific level
 */
const escalateToLevel = async (alert, level) => {
  const patient = await Patient.findById(alert.patient)
    .populate('primaryCaregiver')
    .populate('assignedCHW')
    .populate('assignedClinician');

  if (!patient) {
    logger.error('Patient not found for escalation', { patientId: alert.patient });
    return;
  }

  // Get recipients based on level
  const recipients = await getRecipientsForLevel(patient, level);

  // Record escalation
  for (const recipient of recipients) {
    alert.escalation.history.push({
      level,
      escalatedAt: new Date(),
      escalatedTo: recipient._id,
      role: recipient.role,
      reason: `No response from Level ${level - 1} responders`,
      notificationSent: false,
      channels: []
    });
  }

  // Update alert status and escalation level
  alert.status = ALERT_STATUS.ESCALATED;
  alert.escalation.currentLevel = level;

  // Set next escalation time if not at max level
  if (level < ESCALATION_LEVELS.LEVEL_3) {
    alert.escalation.nextEscalationAt = new Date(
      Date.now() + ESCALATION_TIMEOUTS[level] * 60000
    );
  } else {
    alert.escalation.nextEscalationAt = null;
  }

  await alert.save();

  // Schedule next escalation if applicable
  if (alert.escalation.nextEscalationAt) {
    scheduleEscalationJob(alert);
  }

  // Notify recipients
  await notifyLevel(alert, level, recipients);

  // Emit real-time alert update
  emitAlert(alert);

  logger.info('Alert escalated', {
    alertId: alert._id,
    level,
    recipientsCount: recipients.length
  });
};

/**
 * Get recipients for escalation level
 */
const getRecipientsForLevel = async (patient, level) => {
  const recipients = [];

  switch (level) {
    case ESCALATION_LEVELS.LEVEL_1:
      // Primary caregiver
      if (patient.primaryCaregiver) {
        recipients.push(patient.primaryCaregiver);
      }
      // Backup caregivers
      for (const backup of patient.backupCaregivers || []) {
        const caregiver = await User.findById(backup.caregiver);
        if (caregiver) recipients.push(caregiver);
      }
      break;

    case ESCALATION_LEVELS.LEVEL_2:
      // Community Health Worker
      if (patient.assignedCHW) {
        const chw = await User.findById(patient.assignedCHW);
        if (chw) recipients.push(chw);
      }
      break;

    case ESCALATION_LEVELS.LEVEL_3:
      // Clinician
      if (patient.assignedClinician) {
        const clinician = await User.findById(patient.assignedClinician);
        if (clinician) recipients.push(clinician);
      }
      // System administrators
      const admins = await User.find({ role: 'admin', status: 'active' });
      recipients.push(...admins);
      break;
  }

  return recipients;
};

/**
 * Notify recipients at escalation level
 */
const notifyLevel = async (alert, level, recipients = null) => {
  if (!recipients) {
    const patient = await Patient.findById(alert.patient)
      .populate('primaryCaregiver')
      .populate('assignedCHW')
      .populate('assignedClinician');
    
    if (patient) {
      recipients = await getRecipientsForLevel(patient, level);
    }
  }

  if (!recipients || recipients.length === 0) {
    logger.warn('No recipients for alert notification', { alertId: alert._id, level });
    return;
  }

  const notification = {
    alertId: alert._id,
    alertType: alert.type,
    severity: alert.severity,
    message: alert.message,
    level,
    patientId: alert.patient,
    timestamp: new Date()
  };

  for (const recipient of recipients) {
    // Push notification
    if (recipient.deviceToken) {
      await sendPushNotification(recipient, notification);
    }

    // Real-time socket notification
    emitToUser(recipient._id.toString(), 'alert:escalation', notification);

    // SMS for higher levels
    if (level >= ESCALATION_LEVELS.LEVEL_2 && recipient.phone) {
      await sendSMS(recipient.phone, notification);
    }

    // Log notification
    alert.notifications.push({
      channel: CHANNELS.PUSH,
      recipient: recipient._id,
      recipientPhone: recipient.phone,
      sentAt: new Date(),
      status: 'sent'
    });
  }

  await alert.save();
};

/**
 * Check all pending escalations
 */
const checkPendingEscalations = async () => {
  try {
    const now = new Date();
    
    const pendingAlerts = await Alert.find({
      status: { $in: [ALERT_STATUS.PENDING, ALERT_STATUS.ESCALATED] },
      'escalation.nextEscalationAt': { $lte: now }
    });

    logger.debug('Checking pending escalations', { count: pendingAlerts.length });

    for (const alert of pendingAlerts) {
      await performEscalation(alert._id);
    }
  } catch (error) {
    logger.error('Error checking pending escalations', { error: error.message });
  }
};

/**
 * Stop escalation for resolved alert
 */
export const stopEscalation = async (alertId) => {
  cancelEscalationJob(alertId.toString());
  
  const alert = await Alert.findById(alertId);
  if (alert) {
    alert.escalation.nextEscalationAt = null;
    await alert.save();
  }

  logger.info('Escalation stopped', { alertId });
};

/**
 * Acknowledge alert (pauses escalation)
 */
export const acknowledgeAlert = async (alertId, userId, notes = '') => {
  const alert = await Alert.findById(alertId);
  
  if (!alert) {
    throw new Error('Alert not found');
  }

  const user = await User.findById(userId);
  
  await alert.acknowledge(userId, user.role, notes);

  // Cancel escalation timer
  cancelEscalationJob(alertId.toString());

  logger.info('Alert acknowledged', { alertId, userId });

  return alert;
};

/**
 * Send push notification (stub - would integrate with FCM/APNS)
 */
const sendPushNotification = async (recipient, notification) => {
  // In production, integrate with Firebase Cloud Messaging or similar
  logger.debug('Push notification sent', {
    recipientId: recipient._id,
    alertId: notification.alertId
  });
  
  return { success: true };
};

/**
 * Send SMS notification (stub - would integrate with Africa's Talking)
 */
const sendSMS = async (phone, notification) => {
  // In production, integrate with Africa's Talking or Twilio
  logger.debug('SMS sent', {
    phone: phone.replace(/\d(?=\d{4})/g, '*'), // Mask phone number
    alertId: notification.alertId
  });
  
  return { success: true };
};

/**
 * Get escalation statistics
 */
export const getEscalationStats = async (timeRange = 24) => {
  const since = new Date(Date.now() - timeRange * 3600000);
  
  const stats = await Alert.aggregate([
    {
      $match: {
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$escalation.currentLevel',
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$totalResponseTime' }
      }
    }
  ]);

  return stats;
};

export default {
  initializeEscalationService,
  startEscalation,
  stopEscalation,
  acknowledgeAlert,
  getEscalationStats
};

// Backward-compatible aliases used by route modules.
export const escalateAlert = async (alertId) => {
  const alert = typeof alertId === 'object' ? alertId : await Alert.findById(alertId);

  if (!alert) {
    throw new Error('Alert not found');
  }

  return startEscalation(alert);
};

export const triggerAlertEscalation = escalateAlert;

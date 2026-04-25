/**
 * CHENGETO Health - Dashboard Routes
 * Provides aggregated data for various dashboard views
 */

import express from 'express';
import os from 'os';
import { body, param, query, validationResult } from 'express-validator';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Alert from '../models/Alert.js';
import CheckIn from '../models/CheckIn.js';
import IoTTelemetry from '../models/IoTTelemetry.js';
import IoTDevice from '../models/IoTDevice.js';
import CareSchedule from '../models/CareSchedule.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { getBlockchainStatus } from '../services/blockchain.service.js';
import { buildMedicationSnapshot } from '../utils/medication.js';
import { buildWorkflowSnapshot } from '../utils/workflowTasks.js';
import { buildRiskProfileForPatient, buildRiskProfilesForPatients } from '../services/riskScoring.service.js';
import logger from '../config/logger.js';

const router = express.Router();
const DEVICE_ONLINE_WINDOW_MS = 30 * 60 * 1000;
const ACTIVE_ALERT_STATUSES = ['pending', 'acknowledged', 'escalated', 'active'];

const getLimit = (value, fallback = 10) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : Math.max(1, Math.min(parsed, 50));
};

const formatDisplayName = (entity = {}) =>
  [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim();

const getDayName = (date = new Date()) => (
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
);

const toTimeMinutes = (value = '00:00') => {
  const [hours = 0, minutes = 0] = String(value).split(':').map((part) => Number.parseInt(part, 10) || 0);
  return (hours * 60) + minutes;
};

const isWithinWindow = (dateValue, startTime, endTime) => {
  if (!dateValue || !startTime || !endTime) {
    return false;
  }

  const date = new Date(dateValue);
  const minutes = (date.getHours() * 60) + date.getMinutes();
  return minutes >= toTimeMinutes(startTime) && minutes <= toTimeMinutes(endTime);
};

const mapStatusToMuiColor = (status = '') => {
  if (status === 'critical') {
    return 'error';
  }

  if (status === 'abnormal') {
    return 'warning';
  }

  return 'success';
};

const formatBloodPressure = (telemetry) => {
  const systolic = telemetry?.bloodPressure?.systolic?.value;
  const diastolic = telemetry?.bloodPressure?.diastolic?.value;

  if (systolic == null || diastolic == null) {
    return null;
  }

  return `${systolic}/${diastolic}`;
};

const mapTelemetrySnapshot = (telemetry) => ({
  heartRate: telemetry?.heartRate?.value ?? null,
  bloodPressure: formatBloodPressure(telemetry),
  activityLevel: telemetry?.motion?.type || 'Unknown',
  oxygenSaturation: telemetry?.oxygenSaturation?.value ?? null,
  temperature: telemetry?.temperature?.value ?? null
});

const toLegacyCoordinates = (coordinates) => {
  if (coordinates?.longitude == null || coordinates?.latitude == null) {
    return null;
  }

  return [coordinates.longitude, coordinates.latitude];
};

const buildTrackedDeviceQuery = () => ({
  assignedPatient: { $exists: true, $ne: null },
  status: { $ne: 'decommissioned' }
});

const buildConnectedDeviceQuery = (onlineThreshold) => ({
  ...buildTrackedDeviceQuery(),
  'connection.online': true,
  'connection.lastOnline': { $gte: onlineThreshold }
});

const buildOfflineDeviceQuery = (onlineThreshold) => ({
  ...buildTrackedDeviceQuery(),
  $or: [
    { 'connection.online': false },
    { 'connection.online': { $exists: false } },
    { 'connection.lastOnline': { $lt: onlineThreshold } },
    { 'connection.lastOnline': { $exists: false } }
  ]
});

const summarizePatient = (patient = {}) => ({
  _id: patient._id,
  id: patient._id,
  patientId: patient.patientId,
  firstName: patient.firstName,
  lastName: patient.lastName,
  name: formatDisplayName(patient),
  status: patient.status,
  riskLevel: patient.riskLevel,
  location: patient.address?.coordinates
    ? {
        latitude: patient.address.coordinates.latitude,
        longitude: patient.address.coordinates.longitude
      }
    : null
});

const buildRankedPatients = (patients = [], riskProfiles = new Map()) => (
  patients
    .map((patient) => {
      const riskStratification = riskProfiles.get(String(patient._id)) || null;
      return {
        ...summarizePatient(patient),
        riskLevel: riskStratification?.level ?? patient.riskLevel,
        riskScore: riskStratification?.score ?? null,
        riskSummary: riskStratification?.summary ?? '',
        riskReasons: riskStratification?.reasons?.slice(0, 3) || [],
        hasActiveTransition: Boolean(riskStratification?.hasActiveTransition)
      };
    })
    .sort((left, right) => (right.riskScore || 0) - (left.riskScore || 0))
);

const collectTransitionTasksForRole = (patients = [], riskProfiles = new Map(), ownerRole = 'caregiver') => (
  patients.flatMap((patient) => {
    const riskStratification = riskProfiles.get(String(patient._id));
    return (riskStratification?.transitionSummaries || []).flatMap((transition) =>
      (transition.followUpTasks || [])
        .filter((task) => task.status !== 'completed' && (
          task.ownerRole === ownerRole ||
          (ownerRole === 'clinician' && task.type === 'checkpoint')
        ))
        .map((task) => ({
          patient: summarizePatient(patient),
          transitionId: transition.transitionId,
          transitionType: transition.transitionType,
          title: task.title,
          dueDate: task.dueDate,
          status: task.status,
          priority: task.priority,
          notes: task.notes
        }))
    );
  }).sort((left, right) => new Date(left.dueDate || 0) - new Date(right.dueDate || 0))
);

const collectTransitionTasks = (patients = [], riskProfiles = new Map()) => (
  patients.flatMap((patient) => {
    const riskStratification = riskProfiles.get(String(patient._id));
    return (riskStratification?.transitionSummaries || []).flatMap((transition) =>
      (transition.followUpTasks || [])
        .filter((task) => task.status !== 'completed')
        .map((task) => ({
          patient: summarizePatient(patient),
          transitionId: transition.transitionId,
          transitionType: transition.transitionType,
          title: task.title,
          dueDate: task.dueDate,
          status: task.status,
          priority: task.priority,
          ownerRole: task.ownerRole,
          notes: task.notes
        }))
    );
  }).sort((left, right) => new Date(left.dueDate || 0) - new Date(right.dueDate || 0))
);

const getRecentAdminActivities = async (limit = 10) => {
  const [recentAlerts, recentCheckIns, recentUsers] = await Promise.all([
    Alert.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('patient', 'firstName lastName')
      .select('type severity patient createdAt')
      .lean(),
    CheckIn.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('patient', 'firstName lastName')
      .select('patient createdAt timestamp status')
      .lean(),
    User.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('firstName lastName role createdAt')
      .lean()
  ]);

  return [
    ...recentAlerts.map((alert) => ({
      type: 'alert',
      message: `${alert.severity || 'new'} alert for ${alert.patient?.firstName || 'Unknown'} ${alert.patient?.lastName || 'patient'}`.trim(),
      timestamp: new Date(alert.createdAt).toLocaleString(),
      createdAt: alert.createdAt
    })),
    ...recentCheckIns.map((checkIn) => ({
      type: 'checkin',
      message: `Check-in ${checkIn.status || 'recorded'} for ${checkIn.patient?.firstName || 'Unknown'} ${checkIn.patient?.lastName || 'patient'}`.trim(),
      timestamp: new Date(checkIn.timestamp || checkIn.createdAt).toLocaleString(),
      createdAt: checkIn.timestamp || checkIn.createdAt
    })),
    ...recentUsers.map((user) => ({
      type: 'user',
      message: `${user.firstName} ${user.lastName} joined as ${user.role}`,
      timestamp: new Date(user.createdAt).toLocaleString(),
      createdAt: user.createdAt
    }))
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(({ createdAt, ...activity }) => activity);
};

const getRecentAdminUsers = async (limit = 5) => {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('firstName lastName email role status createdAt')
    .lean();

  return users.map((user) => ({
    ...user,
    active: user.status === 'active'
  }));
};

const calculateCheckInStreak = (checkIns = []) => {
  const completedDays = new Set(
    checkIns
      .map((entry) => {
        const sourceDate = entry.actualTime || entry.createdAt || entry.timestamp;
        if (!sourceDate) {
          return null;
        }

        const date = new Date(sourceDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
      .filter(Boolean)
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (completedDays.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const getLinkedPatientIds = async (userId) => {
  const [user, patients] = await Promise.all([
    User.findById(userId).select('linkedPatients').lean(),
    Patient.find({ 'familyMembers.user': userId }).select('_id').lean()
  ]);

  const ids = new Set();

  for (const link of user?.linkedPatients || []) {
    const patientId = link?.patient || link;
    if (patientId) {
      ids.add(patientId.toString());
    }
  }

  for (const patient of patients) {
    ids.add(patient._id.toString());
  }

  return Array.from(ids);
};

const buildTodayScheduleFromWorkflow = (workflow = {}) => (
  [...(workflow.overdue || []), ...(workflow.dueNow || []), ...(workflow.upcoming || []), ...(workflow.completedToday || [])]
    .map((task) => ({
      patient: task.patient,
      time: task.startTime,
      windowEnd: task.endTime,
      status: task.workflowStatus === 'completed' ? 'completed' : 'pending',
      workflowStatus: task.workflowStatus,
      priority: task.priority,
      activeAlertsCount: task.activeAlertsCount,
      checkIn: task.completedCheckInId ? { _id: task.completedCheckInId } : null
    }))
    .sort((left, right) => left.time.localeCompare(right.time))
);

const getAssignedChwPatients = async (userId) => (
  Patient.find({ assignedCHW: userId })
    .select('firstName lastName patientId status riskLevel phone address compliance')
    .lean({ getters: true, virtuals: true })
);

const buildChwDashboardData = async (user) => {
  const patients = await getAssignedChwPatients(user._id);

  if (patients.length === 0) {
    return {
      patients: [],
      workflow: await buildWorkflowSnapshot({ patients: [], role: user.role }),
      visits: [],
      urgentPatients: [],
      rankedPatients: [],
      transitionTasks: [],
      riskProfiles: new Map(),
      summary: {
        todayVisits: 0,
        completedVisits: 0,
        pendingVisits: 0,
        overdueVisits: 0,
        totalPatients: 0,
        urgentPatients: 0,
        staleDevices: 0,
        handoffNotes: 0,
        highRiskPatients: 0,
        activeTransitions: 0,
        transitionTasks: 0
      },
      activeAlertsCount: 0,
      criticalAlertsCount: 0
    };
  }

  const patientIds = patients.map((patient) => patient._id);
  const [workflow, activeAlerts, riskProfiles] = await Promise.all([
    buildWorkflowSnapshot({ patients, role: user.role }),
    Alert.find({
      patient: { $in: patientIds },
      status: { $in: ACTIVE_ALERT_STATUSES }
    })
      .select('patient severity title message type')
      .lean(),
    buildRiskProfilesForPatients(patients)
  ]);

  const urgentPatients = patients
    .map((patient) => {
      const patientAlerts = activeAlerts.filter((alert) => alert.patient?.toString() === patient._id.toString());
      if (patientAlerts.length === 0) {
        return null;
      }

      const primaryAlert = patientAlerts.find((alert) => alert.severity === 'critical') || patientAlerts[0];
      return {
        _id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        patientId: patient.patientId,
        phone: patient.phone,
        alertReason: primaryAlert?.title || primaryAlert?.message || primaryAlert?.type || 'Active alert'
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  const visits = [...workflow.overdue, ...workflow.dueNow, ...workflow.upcoming, ...workflow.completedToday]
    .map((task) => ({
      ...task,
      status: task.workflowStatus === 'completed' ? 'completed' : 'pending'
    }));
  const rankedPatients = buildRankedPatients(patients, riskProfiles);
  const transitionTasks = collectTransitionTasksForRole(patients, riskProfiles, 'chw');

  return {
    patients,
    workflow,
    visits,
    urgentPatients,
    rankedPatients,
    transitionTasks,
    riskProfiles,
    summary: {
      todayVisits: visits.length,
      completedVisits: workflow.summary.completedToday,
      pendingVisits: workflow.summary.pendingTasks,
      overdueVisits: workflow.summary.overdue,
      totalPatients: patients.length,
      urgentPatients: urgentPatients.length,
      staleDevices: workflow.summary.staleDevices,
      handoffNotes: workflow.summary.handoffNotes,
      highRiskPatients: rankedPatients.filter((patient) => ['high', 'critical'].includes(patient.riskLevel)).length,
      activeTransitions: transitionTasks.length > 0
        ? new Set(transitionTasks.map((task) => task.transitionId)).size
        : 0,
      transitionTasks: transitionTasks.length
    },
    activeAlertsCount: activeAlerts.length,
    criticalAlertsCount: activeAlerts.filter((alert) => alert.severity === 'critical').length
  };
};

/**
 * @route   GET /api/dashboard/admin/overview
 * @desc    Get consolidated admin overview data for the command center
 * @access  Private (admin)
 */
router.get('/admin/overview',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const onlineThreshold = new Date(Date.now() - DEVICE_ONLINE_WINDOW_MS);
      const cpuLoad = os.cpus().length > 0
        ? Math.min(100, Math.round((os.loadavg()[0] / os.cpus().length) * 100))
        : 0;
      const memoryUsage = Math.round((1 - (os.freemem() / os.totalmem())) * 100);

      const [
        totalUsers,
        activePatientDocs,
        openAlerts,
        totalDevices,
        connectedDevices,
        blockchainStatus,
        activities,
        recentUsers,
        activeAlerts,
        attentionDevices
      ] = await Promise.all([
        User.countDocuments(),
        Patient.find({ status: 'active' })
          .select('firstName lastName patientId status riskLevel address phone compliance vitalThresholds medicalConditions ncdConditions functionalBaseline currentMedications')
          .lean({ getters: true, virtuals: true }),
        Alert.countDocuments({ status: { $in: ['active', 'acknowledged', 'escalated'] } }),
        IoTDevice.countDocuments(buildTrackedDeviceQuery()),
        IoTDevice.countDocuments(buildConnectedDeviceQuery(onlineThreshold)),
        getBlockchainStatus(),
        getRecentAdminActivities(12),
        getRecentAdminUsers(6),
        Alert.find({ status: { $in: ['active', 'acknowledged', 'escalated'] } })
          .sort({ createdAt: -1 })
          .limit(6)
          .populate('patient', 'firstName lastName patientId')
          .select('type severity message patient createdAt status')
          .lean(),
        IoTDevice.find({
          ...buildTrackedDeviceQuery(),
          $or: [
            { ...buildOfflineDeviceQuery(onlineThreshold).$or[0] },
            { ...buildOfflineDeviceQuery(onlineThreshold).$or[1] },
            { ...buildOfflineDeviceQuery(onlineThreshold).$or[2] },
            { ...buildOfflineDeviceQuery(onlineThreshold).$or[3] },
            { 'power.batteryLevel': { $lte: 25 } }
          ]
        })
          .sort({ 'connection.lastOnline': 1, 'power.batteryLevel': 1 })
          .limit(6)
          .populate('assignedPatient', 'firstName lastName patientId')
          .select('deviceId deviceType status assignedPatient connection power')
          .lean()
      ]);

      const riskProfiles = await buildRiskProfilesForPatients(activePatientDocs);
      const highRiskPatients = buildRankedPatients(activePatientDocs, riskProfiles).slice(0, 6);
      const transitionWatchlist = collectTransitionTasks(activePatientDocs, riskProfiles).slice(0, 8);

      res.json({
        stats: {
          totalUsers,
          activePatients: activePatientDocs.length,
          openAlerts,
          totalDevices,
          connectedDevices
        },
        health: {
          database: 'healthy',
          mqtt: 'healthy',
          blockchain: blockchainStatus.mode === 'real' ? 'synced' : blockchainStatus.mode,
          blockchainDetails: blockchainStatus,
          totalDevices,
          connectedDevices,
          cpu: Math.max(0, cpuLoad),
          memory: Math.max(0, memoryUsage)
        },
        activities,
        recentUsers,
        activeAlerts: activeAlerts.map((alert) => ({
          ...alert,
          patient: alert.patient
            ? {
                _id: alert.patient._id,
                patientId: alert.patient.patientId,
                name: formatDisplayName(alert.patient)
              }
            : null
        })),
        highRiskPatients,
        transitionWatchlist,
        deviceWatchlist: attentionDevices.map((device) => ({
          _id: device._id,
          deviceId: device.deviceId,
          deviceType: device.deviceType,
          status: device.status,
          assignedPatient: device.assignedPatient
            ? {
                _id: device.assignedPatient._id,
                patientId: device.assignedPatient.patientId,
                name: formatDisplayName(device.assignedPatient)
              }
            : null,
          connection: device.connection || {},
          power: device.power || {}
        }))
      });
    } catch (error) {
      logger.error('Admin dashboard overview error:', error);
      res.status(500).json({ message: 'Failed to retrieve admin overview' });
    }
  }
);

/**
 * @route   GET /api/dashboard/admin/stats
 * @desc    Get summary stats for the admin dashboard
 * @access  Private (admin)
 */
router.get('/admin/stats',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const onlineThreshold = new Date(Date.now() - DEVICE_ONLINE_WINDOW_MS);
      const [totalUsers, activePatients, openAlerts, totalDevices, connectedDevices] = await Promise.all([
        User.countDocuments(),
        Patient.countDocuments({ status: 'active' }),
        Alert.countDocuments({ status: { $in: ['active', 'acknowledged', 'escalated'] } }),
        IoTDevice.countDocuments(buildTrackedDeviceQuery()),
        IoTDevice.countDocuments(buildConnectedDeviceQuery(onlineThreshold))
      ]);

      res.json({
        totalUsers,
        activePatients,
        openAlerts,
        totalDevices,
        connectedDevices
      });
    } catch (error) {
      logger.error('Admin dashboard stats error:', error);
      res.status(500).json({ message: 'Failed to retrieve admin dashboard stats' });
    }
  }
);

/**
 * @route   GET /api/dashboard/admin/health
 * @desc    Get system health data for the admin dashboard
 * @access  Private (admin)
 */
router.get('/admin/health',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const onlineThreshold = new Date(Date.now() - DEVICE_ONLINE_WINDOW_MS);
      const [totalDevices, connectedDevices] = await Promise.all([
        IoTDevice.countDocuments(buildTrackedDeviceQuery()),
        IoTDevice.countDocuments(buildConnectedDeviceQuery(onlineThreshold))
      ]);

      const cpuLoad = os.cpus().length > 0
        ? Math.min(100, Math.round((os.loadavg()[0] / os.cpus().length) * 100))
        : 0;
      const memoryUsage = Math.round((1 - (os.freemem() / os.totalmem())) * 100);
      const blockchainStatus = await getBlockchainStatus();

      res.json({
        database: 'healthy',
        mqtt: 'healthy',
        blockchain: blockchainStatus.mode === 'real' ? 'synced' : blockchainStatus.mode,
        blockchainDetails: blockchainStatus,
        totalDevices,
        connectedDevices,
        cpu: Math.max(0, cpuLoad),
        memory: Math.max(0, memoryUsage)
      });
    } catch (error) {
      logger.error('Admin dashboard health error:', error);
      res.status(500).json({ message: 'Failed to retrieve admin dashboard health' });
    }
  }
);

/**
 * @route   GET /api/dashboard/admin/activities
 * @desc    Get recent activity for the admin dashboard
 * @access  Private (admin)
 */
router.get('/admin/activities',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 10);
      const [recentAlerts, recentCheckIns, recentUsers] = await Promise.all([
        Alert.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('patient', 'firstName lastName')
          .select('type severity patient createdAt')
          .lean(),
        CheckIn.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('patient', 'firstName lastName')
          .select('patient createdAt timestamp status')
          .lean(),
        User.find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .select('firstName lastName role createdAt')
          .lean()
      ]);

      const activities = [
        ...recentAlerts.map((alert) => ({
          type: 'alert',
          message: `${alert.severity || 'new'} alert for ${alert.patient?.firstName || 'Unknown'} ${alert.patient?.lastName || 'patient'}`.trim(),
          timestamp: new Date(alert.createdAt).toLocaleString(),
          createdAt: alert.createdAt
        })),
        ...recentCheckIns.map((checkIn) => ({
          type: 'checkin',
          message: `Check-in ${checkIn.status || 'recorded'} for ${checkIn.patient?.firstName || 'Unknown'} ${checkIn.patient?.lastName || 'patient'}`.trim(),
          timestamp: new Date(checkIn.timestamp || checkIn.createdAt).toLocaleString(),
          createdAt: checkIn.timestamp || checkIn.createdAt
        })),
        ...recentUsers.map((user) => ({
          type: 'user',
          message: `${user.firstName} ${user.lastName} joined as ${user.role}`,
          timestamp: new Date(user.createdAt).toLocaleString(),
          createdAt: user.createdAt
        }))
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(({ createdAt, ...activity }) => activity);

      res.json(activities);
    } catch (error) {
      logger.error('Admin dashboard activities error:', error);
      res.status(500).json({ message: 'Failed to retrieve admin dashboard activities' });
    }
  }
);

/**
 * @route   GET /api/dashboard/admin/recent-users
 * @desc    Get recent users for the admin dashboard
 * @access  Private (admin)
 */
router.get('/admin/recent-users',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 5);
      const users = await User.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('firstName lastName email role status createdAt')
        .lean();

      res.json(
        users.map((user) => ({
          ...user,
          active: user.status === 'active'
        }))
      );
    } catch (error) {
      logger.error('Admin dashboard recent users error:', error);
      res.status(500).json({ message: 'Failed to retrieve recent users' });
    }
  }
);

/**
 * @route   GET /api/dashboard/chw/stats
 * @desc    Get summary stats for the CHW dashboard
 * @access  Private (chw)
 */
router.get('/chw/stats',
  authenticate,
  authorize(['chw']),
  async (req, res) => {
    try {
      const chwDashboard = await buildChwDashboardData(req.user);

      res.json({
        todayVisits: chwDashboard.summary.todayVisits,
        completedVisits: chwDashboard.summary.completedVisits,
        pendingVisits: chwDashboard.summary.pendingVisits,
        totalPatients: chwDashboard.summary.totalPatients,
        urgentPatients: chwDashboard.urgentPatients,
        overdueVisits: chwDashboard.summary.overdueVisits,
        staleDevices: chwDashboard.summary.staleDevices,
        handoffNotes: chwDashboard.summary.handoffNotes,
        highRiskPatients: chwDashboard.summary.highRiskPatients,
        activeTransitions: chwDashboard.summary.activeTransitions,
        transitionTasks: chwDashboard.summary.transitionTasks
      });
    } catch (error) {
      logger.error('CHW dashboard stats error:', error);
      res.status(500).json({ message: 'Failed to retrieve CHW dashboard stats' });
    }
  }
);

/**
 * @route   GET /api/dashboard/chw/visits
 * @desc    Get today's visit list for the CHW dashboard
 * @access  Private (chw)
 */
router.get('/chw/visits',
  authenticate,
  authorize(['chw']),
  async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 20);
      const chwDashboard = await buildChwDashboardData(req.user);

      res.json(chwDashboard.visits.slice(0, limit));
    } catch (error) {
      logger.error('CHW dashboard visits error:', error);
      res.status(500).json({ message: 'Failed to retrieve CHW visit list' });
    }
  }
);

/**
 * @route   GET /api/dashboard/clinician/stats
 * @desc    Get summary stats for the clinician dashboard
 * @access  Private (clinician)
 */
router.get('/clinician/stats',
  authenticate,
  authorize(['clinician']),
  async (req, res) => {
    try {
      const patients = await Patient.find({ assignedClinician: req.user._id })
        .select('firstName lastName patientId dateOfBirth gender ncdConditions medicalConditions compliance vitalThresholds riskLevel functionalBaseline currentMedications')
        .lean({ getters: true, virtuals: true });

      const patientIds = patients.map((patient) => patient._id);

      const [activeAlerts, criticalAlerts, riskProfiles] = await Promise.all([
        Alert.countDocuments({
          patient: { $in: patientIds },
          status: { $in: ACTIVE_ALERT_STATUSES }
        }),
        Alert.countDocuments({
          patient: { $in: patientIds },
          status: { $in: ACTIVE_ALERT_STATUSES },
          severity: 'critical'
        }),
        buildRiskProfilesForPatients(patients)
      ]);

      const avgAdherence = patients.length > 0
        ? Math.round(patients.reduce((sum, patient) => sum + (patient.compliance?.checkinAdherence || 0), 0) / patients.length)
        : 0;

      const highRiskProfiles = Array.from(riskProfiles.values()).filter(
        (profile) => profile && ['high', 'critical'].includes(profile.level)
      );
      const activeTransitions = Array.from(riskProfiles.values()).reduce(
        (count, profile) => count + (profile?.transitionSummaries?.length || 0),
        0
      );
      const pendingReviews = patients.filter((patient) => (patient.compliance?.checkinAdherence || 0) < 80).length + criticalAlerts + highRiskProfiles.length;

      res.json({
        totalPatients: patients.length,
        criticalAlerts,
        criticalAlertsTrend: criticalAlerts > 0 ? 'up' : 'stable',
        avgAdherence,
        adherenceTrend: avgAdherence >= 80 ? 'stable' : 'down',
        pendingReviews,
        criticalPatients: Math.min(criticalAlerts, patients.length),
        activeAlerts,
        highRiskPatients: highRiskProfiles.length,
        activeTransitions
      });
    } catch (error) {
      logger.error('Clinician dashboard stats error:', error);
      res.status(500).json({ message: 'Failed to retrieve clinician dashboard stats' });
    }
  }
);

/**
 * @route   GET /api/dashboard/clinician/patients
 * @desc    Get patient table data for the clinician dashboard
 * @access  Private (clinician)
 */
router.get('/clinician/patients',
  authenticate,
  authorize(['clinician']),
  async (req, res) => {
    try {
      const patients = await Patient.find({ assignedClinician: req.user._id })
        .select('firstName lastName patientId dateOfBirth gender ncdConditions medicalConditions compliance')
        .lean({ getters: true, virtuals: true });

      const riskProfiles = await buildRiskProfilesForPatients(patients);

      const patientRows = await Promise.all(
        patients.map(async (patient) => {
          const [latestTelemetry, lastCheckIn, activeAlerts] = await Promise.all([
            IoTTelemetry.findOne({ patient: patient._id })
              .sort({ timestamp: -1 })
              .lean(),
            CheckIn.findOne({
              patient: patient._id,
              status: 'completed'
            })
              .sort({ actualTime: -1, createdAt: -1 })
              .select('actualTime createdAt')
              .lean(),
            Alert.countDocuments({
              patient: patient._id,
              status: { $in: ACTIVE_ALERT_STATUSES }
            })
          ]);

          const conditionList = [
            ...(patient.ncdConditions || []).map((condition) => condition.type).filter(Boolean),
            ...(patient.medicalConditions || []).map((condition) => condition.condition || condition).filter(Boolean)
          ];
          const riskStratification = riskProfiles.get(String(patient._id)) || null;

          return {
            _id: patient._id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            medicalId: patient.patientId,
            age: calculateAge(patient.dateOfBirth),
            gender: patient.gender,
            conditions: Array.from(new Set(conditionList)),
            vitals: {
              heartRate: latestTelemetry?.heartRate?.value ?? null,
              heartRateStatus: mapStatusToMuiColor(latestTelemetry?.heartRate?.status),
              bloodPressure: formatBloodPressure(latestTelemetry),
              bpStatus: mapStatusToMuiColor(
                latestTelemetry?.bloodPressure?.systolic?.status || latestTelemetry?.bloodPressure?.diastolic?.status
              )
            },
            lastCheckIn: lastCheckIn?.actualTime || lastCheckIn?.createdAt || null,
            activeAlerts,
            adherenceScore: patient.compliance?.checkinAdherence || 0,
            pendingActions: activeAlerts,
            riskStratification,
            riskScore: riskStratification?.score ?? 0,
            riskLevel: riskStratification?.level ?? patient.riskLevel,
            riskSummary: riskStratification?.summary ?? '',
            transitionCount: riskStratification?.transitionSummaries?.length || 0
          };
        })
      );

      res.json(patientRows.sort((left, right) => (right.riskScore || 0) - (left.riskScore || 0)));
    } catch (error) {
      logger.error('Clinician dashboard patients error:', error);
      res.status(500).json({ message: 'Failed to retrieve clinician patient list' });
    }
  }
);

/**
 * @route   GET /api/dashboard/clinician/patient/:patientId/vitals
 * @desc    Get clinician chart data for a patient's vitals
 * @access  Private (clinician)
 */
router.get('/clinician/patient/:patientId/vitals',
  authenticate,
  authorize(['clinician']),
  [param('patientId').isMongoId()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const days = Math.max(1, Math.min(Number.parseInt(req.query.days, 10) || 7, 30));
      const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const telemetry = await IoTTelemetry.find({
        patient: req.params.patientId,
        timestamp: { $gte: since }
      })
        .sort({ timestamp: 1 })
        .lean();

      res.json(
        telemetry.map((entry) => ({
          date: new Date(entry.timestamp).toLocaleDateString(),
          timestamp: entry.timestamp,
          heartRate: entry.heartRate?.value ?? null,
          systolic: entry.bloodPressure?.systolic?.value ?? null,
          diastolic: entry.bloodPressure?.diastolic?.value ?? null,
          oxygenSaturation: entry.oxygenSaturation?.value ?? null,
          temperature: entry.temperature?.value ?? null
        }))
      );
    } catch (error) {
      logger.error('Clinician patient vitals error:', error);
      res.status(500).json({ message: 'Failed to retrieve patient vital history' });
    }
  }
);

/**
 * @route   GET /api/dashboard/overview
 * @desc    Get overall system overview for admin dashboard
 * @access  Private (admin)
 */
router.get('/overview',
  authenticate,
  authorize(['admin']),
  async (req, res) => {
    try {
      const onlineThreshold = new Date(Date.now() - DEVICE_ONLINE_WINDOW_MS);
      const [
        totalPatients,
        activePatients,
        totalCaregivers,
        activeCaregivers,
        totalAlerts,
        activeAlerts,
        todayCheckIns,
        totalDevices,
        devicesOnline,
        devicesOffline
      ] = await Promise.all([
        Patient.countDocuments({ status: { $ne: 'archived' } }),
        Patient.countDocuments({ status: 'active' }),
        User.countDocuments({ role: 'caregiver' }),
        User.countDocuments({ role: 'caregiver', isActive: true }),
        Alert.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        Alert.countDocuments({ status: { $in: ['active', 'acknowledged', 'escalated'] } }),
        CheckIn.countDocuments({
          status: 'completed',
          timestamp: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }),
        IoTDevice.countDocuments(buildTrackedDeviceQuery()),
        IoTDevice.countDocuments(buildConnectedDeviceQuery(onlineThreshold)),
        IoTDevice.countDocuments(buildOfflineDeviceQuery(onlineThreshold))
      ]);

      // Get alert breakdown by severity
      const alertsBySeverity = await Alert.aggregate([
        {
          $match: {
            status: { $in: ['active', 'acknowledged', 'escalated'] }
          }
        },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get check-in compliance rate
      const scheduledToday = await CareSchedule.aggregate([
        { $unwind: '$checkInSchedule.preferredTimes' },
        { $count: 'total' }
      ]);

      const complianceRate = scheduledToday[0]?.total > 0 
        ? Math.round((todayCheckIns / scheduledToday[0].total) * 100) 
        : 0;

      res.json({
        success: true,
        data: {
          patients: {
            total: totalPatients,
            active: activePatients
          },
          caregivers: {
            total: totalCaregivers,
            active: activeCaregivers
          },
          alerts: {
            total24h: totalAlerts,
            active: activeAlerts,
            bySeverity: alertsBySeverity.reduce((acc, item) => {
              acc[item._id] = item.count;
              return acc;
            }, {})
          },
          checkIns: {
            today: todayCheckIns,
            scheduledToday: scheduledToday[0]?.total || 0,
            complianceRate: Math.min(complianceRate, 100)
          },
          devices: {
            tracked: totalDevices,
            online: devicesOnline,
            offline: devicesOffline,
            total: totalDevices
          },
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Dashboard overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dashboard overview'
      });
    }
  }
);

/**
 * @route   GET /api/dashboard/caregiver
 * @desc    Get caregiver-specific dashboard data
 * @access  Private (caregiver)
 */
router.get('/caregiver',
  authenticate,
  authorize(['caregiver']),
  async (req, res) => {
    try {
      const caregiverId = req.user._id;
      const caregiver = await User.findById(caregiverId).select('assignedPatients').lean();

      const patientMatchers = [
        { primaryCaregiver: caregiverId },
        { 'backupCaregivers.caregiver': caregiverId }
      ];

      if (Array.isArray(caregiver?.assignedPatients) && caregiver.assignedPatients.length > 0) {
        patientMatchers.push({ _id: { $in: caregiver.assignedPatients } });
      }

      const assignedPatients = await Patient.find({
        $or: patientMatchers
      })
        .select('firstName lastName patientId status riskLevel address phone iotDevice currentMedications compliance')
        .lean({ getters: true, virtuals: true });

      const patientIds = assignedPatients.map((patient) => patient._id);

      if (patientIds.length === 0) {
        return res.json({
          success: true,
          data: {
            assignedPatients: [],
            rankedPatients: [],
            todaySchedule: [],
            completedToday: 0,
            pendingToday: 0,
            activeAlerts: [],
            latestVitals: [],
            workflow: await buildWorkflowSnapshot({ patients: [], role: req.user.role }),
            transitionTasks: [],
            summary: {
              totalPatients: 0,
              activeAlertsCount: 0,
              criticalAlerts: 0,
              dueNow: 0,
              overdue: 0,
              pendingHandoffs: 0,
              staleDevices: 0,
              highRiskPatients: 0,
              activeTransitions: 0,
              transitionTasks: 0
            }
          }
        });
      }

      const [workflow, activeAlerts, telemetry, riskProfiles] = await Promise.all([
        buildWorkflowSnapshot({ patients: assignedPatients, role: req.user.role }),
        Alert.find({
          patient: { $in: patientIds },
          status: { $in: ACTIVE_ALERT_STATUSES }
        })
          .populate('patient', 'firstName lastName patientId')
          .sort({ createdAt: -1 })
          .lean(),
        IoTTelemetry.find({
          patient: { $in: patientIds }
        })
          .sort({ timestamp: -1 })
          .lean(),
        buildRiskProfilesForPatients(assignedPatients)
      ]);

      const latestTelemetryByPatient = new Map();
      for (const entry of telemetry) {
        const patientKey = entry.patient?.toString();
        if (patientKey && !latestTelemetryByPatient.has(patientKey)) {
          latestTelemetryByPatient.set(patientKey, entry);
        }
      }
      const todaySchedule = buildTodayScheduleFromWorkflow(workflow);

      const latestVitals = await Promise.all(
        assignedPatients.map(async (patient) => {
          const latest = latestTelemetryByPatient.get(patient._id.toString());
          
          return {
            patientId: patient._id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            vitals: latest ? {
              heartRate: latest.heartRate?.value ?? null,
              bloodPressure: formatBloodPressure(latest),
              oxygenSaturation: latest.oxygenSaturation?.value ?? null,
              temperature: latest.temperature?.value ?? null
            } : null,
            lastUpdated: latest?.timestamp || null
          };
        })
      );

      const rankedPatients = buildRankedPatients(assignedPatients, riskProfiles);
      const transitionTasks = collectTransitionTasksForRole(assignedPatients, riskProfiles, 'caregiver');

      res.json({
        success: true,
        data: {
          assignedPatients: assignedPatients.map((patient) => ({
            ...summarizePatient(patient),
            riskStratification: riskProfiles.get(String(patient._id)) || null
          })),
          rankedPatients,
          todaySchedule,
          completedToday: workflow.summary.completedToday,
          pendingToday: workflow.summary.pendingTasks,
          medicationTasks: workflow.medicationTasks,
          activeAlerts,
          latestVitals,
          workflow,
          transitionTasks,
          summary: {
            totalPatients: assignedPatients.length,
            activeAlertsCount: activeAlerts.length,
            criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
            medicationsDueToday: workflow.summary.medicationTasks,
            missedMedicationsToday: workflow.medicationTasks.filter((task) => task.status === 'missed').length,
            refillRisks: workflow.medicationTasks.filter((task) => task.refillConcern).length,
            dueNow: workflow.summary.dueNow,
            overdue: workflow.summary.overdue,
            pendingHandoffs: workflow.summary.handoffNotes,
            staleDevices: workflow.summary.staleDevices,
            highRiskPatients: rankedPatients.filter((patient) => ['high', 'critical'].includes(patient.riskLevel)).length,
            activeTransitions: transitionTasks.length > 0
              ? new Set(transitionTasks.map((task) => task.transitionId)).size
              : 0,
            transitionTasks: transitionTasks.length
          }
        }
      });

    } catch (error) {
      logger.error('Caregiver dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve caregiver dashboard'
      });
    }
  }
);

/**
 * @route   GET /api/dashboard/chw
 * @desc    Get CHW (Community Health Worker) dashboard data
 * @access  Private (chw)
 */
router.get('/chw',
  authenticate,
  authorize(['chw']),
  async (req, res) => {
    try {
      const chwDashboard = await buildChwDashboardData(req.user);

      res.json({
        success: true,
        data: {
          patients: chwDashboard.patients.map((patient) => ({
            ...summarizePatient(patient),
            riskStratification: chwDashboard.riskProfiles.get(String(patient._id)) || null
          })),
          rankedPatients: chwDashboard.rankedPatients,
          visits: chwDashboard.visits,
          workflow: chwDashboard.workflow,
          urgentPatients: chwDashboard.urgentPatients,
          transitionTasks: chwDashboard.transitionTasks,
          totalPatients: chwDashboard.summary.totalPatients,
          activeAlerts: chwDashboard.activeAlertsCount,
          criticalAlerts: chwDashboard.criticalAlertsCount,
          checkInsToday: chwDashboard.summary.completedVisits,
          summary: chwDashboard.summary
        }
      });

    } catch (error) {
      logger.error('CHW dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve CHW dashboard'
      });
    }
  }
);

/**
 * @route   GET /api/dashboard/patient/:patientId
 * @desc    Get patient-specific dashboard data
 * @access  Private (family, caregiver, clinician)
 */
router.get('/patient/:patientId',
  authenticate,
  [
    param('patientId').isMongoId()
  ],
  async (req, res) => {
    try {
      const { patientId } = req.params;
      const { period = '7d' } = req.query;

      const patient = await Patient.findById(patientId)
        .populate('assignedCaregivers', 'firstName lastName phone')
        .populate('primaryCaregiver', 'firstName lastName phone')
        .populate('assignedDevices', 'deviceId deviceType status batteryLevel')
        .lean();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Calculate time range
      let startDate = new Date();
      switch (period) {
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '7d':
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const [vitalsHistory, checkInHistory, alertHistory, riskStratification] = await Promise.all([
        IoTTelemetry.find({
          patient: patientId,
          timestamp: { $gte: startDate }
        })
          .select('vitals timestamp')
          .sort({ timestamp: 1 })
          .lean(),
        CheckIn.find({
          patient: patientId,
          status: 'completed',
          timestamp: { $gte: startDate }
        })
          .populate('caregiver', 'firstName lastName')
          .sort({ timestamp: -1 })
          .limit(20)
          .lean(),
        Alert.find({
          patient: patientId,
          createdAt: { $gte: startDate }
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
        buildRiskProfileForPatient(patient)
      ]);

      // Calculate statistics
      const avgHeartRate = vitalsHistory.length > 0
        ? Math.round(vitalsHistory.reduce((sum, v) => sum + (v.vitals?.heartRate || 0), 0) / vitalsHistory.length)
        : null;

      const avgOxygen = vitalsHistory.length > 0
        ? Math.round(vitalsHistory.reduce((sum, v) => sum + (v.vitals?.oxygenSaturation || 0), 0) / vitalsHistory.length)
        : null;

      // Get care schedule
      const careSchedule = await CareSchedule.findOne({
        patient: patientId,
        isActive: true
      }).lean();

      // Calculate compliance
      const scheduledDays = Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedCheckIns = scheduledDays * (careSchedule?.checkInSchedule?.preferredTimes?.length || 3);
      const actualCheckIns = checkInHistory.length;
      const complianceRate = expectedCheckIns > 0 
        ? Math.round((actualCheckIns / expectedCheckIns) * 100) 
        : 0;

      res.json({
        success: true,
        data: {
          patient: {
            ...patient,
            age: calculateAge(patient.dateOfBirth),
            riskStratification
          },
          vitals: {
            current: vitalsHistory[vitalsHistory.length - 1]?.vitals || null,
            history: vitalsHistory.slice(-50), // Last 50 data points
            averages: {
              heartRate: avgHeartRate,
              oxygenSaturation: avgOxygen
            }
          },
          checkIns: {
            history: checkInHistory,
            total: checkInHistory.length,
            complianceRate: Math.min(complianceRate, 100)
          },
          alerts: {
            history: alertHistory,
            total: alertHistory.length,
            byType: alertHistory.reduce((acc, a) => {
              acc[a.type] = (acc[a.type] || 0) + 1;
              return acc;
            }, {})
          },
          transitions: riskStratification?.transitionSummaries || [],
          schedule: careSchedule,
          devices: patient.assignedDevices
        }
      });

    } catch (error) {
      logger.error('Patient dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve patient dashboard'
      });
    }
  }
);

/**
 * @route   GET /api/dashboard/family/patient/:patientId
 * @desc    Get family portal dashboard data
 * @access  Private (family)
 */
router.get('/family/patient/:patientId',
  authenticate,
  authorize(['family']),
  [
    param('patientId').isMongoId()
  ],
  async (req, res) => {
    try {
      const { patientId } = req.params;

      // Verify family access
      const user = await User.findById(req.user._id);
      const hasAccess = user.linkedPatients?.some(
        p => p.toString() === patientId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this patient'
        });
      }

      const patient = await Patient.findById(patientId)
        .select('firstName lastName status village district preferences')
        .populate('primaryCaregiver', 'firstName lastName phone')
        .lean();

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Get recent check-ins (limited info for family)
      const recentCheckIns = await CheckIn.find({
        patient: patientId,
        status: 'completed'
      })
        .select('checkInTime wellnessObservations.generalWellbeing caregiver')
        .populate('caregiver', 'firstName lastName')
        .sort({ checkInTime: -1 })
        .limit(7)
        .lean();

      // Get latest vitals (limited)
      const latestVitals = await IoTTelemetry.findOne({
        patient: patientId
      })
        .select('vitals.heartRate vitals.oxygenSaturation timestamp')
        .sort({ timestamp: -1 })
        .lean();

      // Get upcoming schedule
      const schedule = await CareSchedule.findOne({
        patient: patientId,
        isActive: true
      }).select('checkInSchedule.preferredTimes').lean();

      res.json({
        success: true,
        data: {
          patient: {
            name: `${patient.firstName} ${patient.lastName}`,
            status: patient.status,
            location: {
              village: patient.village,
              district: patient.district
            }
          },
          primaryCaregiver: patient.primaryCaregiver,
          currentStatus: {
            wellbeing: recentCheckIns[0]?.wellnessObservations?.generalWellbeing || 'unknown',
            lastCheckIn: recentCheckIns[0]?.checkInTime || null
          },
          latestVitals: latestVitals ? {
            heartRate: latestVitals.vitals?.heartRate,
            oxygenSaturation: latestVitals.vitals?.oxygenSaturation,
            timestamp: latestVitals.timestamp
          } : null,
          recentActivity: recentCheckIns.map(ci => ({
            date: ci.checkInTime,
            wellbeing: ci.wellnessObservations?.generalWellbeing,
            caregiver: ci.caregiver
          })),
          schedule: schedule?.checkInSchedule?.preferredTimes || []
        }
      });

    } catch (error) {
      logger.error('Family dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve family dashboard'
      });
    }
  }
);

/**
 * @route   GET /api/dashboard/family/members
 * @desc    Get linked patients for the family dashboard
 * @access  Private (family)
 */
router.get('/family/members',
  authenticate,
  authorize(['family']),
  async (req, res) => {
    try {
      const patientIds = await getLinkedPatientIds(req.user._id);

      const patients = await Patient.find({ _id: { $in: patientIds } })
        .populate('primaryCaregiver', 'firstName lastName phone role')
        .populate('assignedCHW', 'firstName lastName phone role')
        .populate('assignedClinician', 'firstName lastName phone role')
        .lean({ getters: true, virtuals: true });

      const members = await Promise.all(
        patients.map(async (patient) => {
          const [recentCheckIns, latestTelemetry, activeAlerts, schedule] = await Promise.all([
            CheckIn.find({
              patient: patient._id,
              status: 'completed'
            })
              .sort({ actualTime: -1, createdAt: -1 })
              .limit(10)
              .select('actualTime createdAt wellness medication')
              .lean(),
            IoTTelemetry.findOne({ patient: patient._id })
              .sort({ timestamp: -1 })
              .lean(),
            Alert.countDocuments({
              patient: patient._id,
              status: { $in: ACTIVE_ALERT_STATUSES }
            }),
            CareSchedule.findOne({
              patient: patient._id,
              status: 'active'
            }).lean()
          ]);

          const familyRelationship =
            patient.familyMembers?.find((member) => member.user?.toString() === req.user._id.toString())?.relationship ||
            'family';
          const lastCheckIn = recentCheckIns[0]?.actualTime || recentCheckIns[0]?.createdAt || patient.compliance?.lastCheckin || null;
          const nextCheckInWindow = (schedule?.checkinWindows || [])[0];
          const medicationSnapshot = buildMedicationSnapshot(patient, schedule, recentCheckIns);
          const caregivers = [patient.primaryCaregiver, patient.assignedCHW, patient.assignedClinician]
            .filter(Boolean)
            .map((entry) => ({
              _id: entry._id,
              firstName: entry.firstName,
              lastName: entry.lastName,
              phone: entry.phone,
              role: entry.role
            }));

          return {
            _id: patient._id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            relationship: familyRelationship,
            active: patient.status === 'active',
            phone: patient.phone || patient.primaryCaregiver?.phone || null,
            lastCheckIn,
            activeAlerts,
            checkInStreak: calculateCheckInStreak(recentCheckIns),
            wellnessScore: patient.compliance?.checkinAdherence || null,
            vitals: mapTelemetrySnapshot(latestTelemetry),
            nextCheckIn: nextCheckInWindow
              ? `${nextCheckInWindow.startTime} - ${nextCheckInWindow.endTime}`
              : null,
            medicationCount: medicationSnapshot.summary.totalActive,
            medicationSummary: medicationSnapshot.summary,
            nextAppointment: schedule?.weeklyActivities?.[0]?.time || null,
            caregivers
          };
        })
      );

      res.json(members);
    } catch (error) {
      logger.error('Family dashboard members error:', error);
      res.status(500).json({ message: 'Failed to retrieve family members' });
    }
  }
);

/**
 * @route   GET /api/dashboard/family/activities
 * @desc    Get recent linked-patient activity for the family dashboard
 * @access  Private (family)
 */
router.get('/family/activities',
  authenticate,
  authorize(['family']),
  async (req, res) => {
    try {
      const limit = getLimit(req.query.limit, 10);
      const patientIds = await getLinkedPatientIds(req.user._id);

      const [checkIns, alerts, telemetry] = await Promise.all([
        CheckIn.find({
          patient: { $in: patientIds },
          status: 'completed'
        })
          .sort({ actualTime: -1, createdAt: -1 })
          .limit(limit)
          .populate('patient', 'firstName lastName')
          .lean(),
        Alert.find({
          patient: { $in: patientIds }
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('patient', 'firstName lastName')
          .lean(),
        IoTTelemetry.find({
          patient: { $in: patientIds }
        })
          .sort({ timestamp: -1 })
          .limit(limit)
          .populate('patient', 'firstName lastName')
          .lean()
      ]);

      const activities = [
        ...checkIns.map((entry) => ({
          _id: entry._id,
          type: 'checkin',
          description: `Check-in completed for ${formatDisplayName(entry.patient) || 'patient'}`,
          timestamp: entry.actualTime || entry.createdAt
        })),
        ...alerts.map((entry) => ({
          _id: entry._id,
          type: 'alert',
          description: `${entry.severity || 'New'} alert for ${formatDisplayName(entry.patient) || 'patient'}`,
          timestamp: entry.createdAt
        })),
        ...telemetry.map((entry) => ({
          _id: entry._id,
          type: 'vitals',
          description: `Vitals updated for ${formatDisplayName(entry.patient) || 'patient'}`,
          timestamp: entry.timestamp
        }))
      ]
        .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
        .slice(0, limit);

      res.json(activities);
    } catch (error) {
      logger.error('Family dashboard activities error:', error);
      res.status(500).json({ message: 'Failed to retrieve family activity feed' });
    }
  }
);

/**
 * @route   POST /api/dashboard/family/message
 * @desc    Record a family communication request
 * @access  Private (family)
 */
router.post('/family/message',
  authenticate,
  authorize(['family']),
  [
    body('patientId').isMongoId(),
    body('message').trim().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const linkedPatientIds = await getLinkedPatientIds(req.user._id);
      if (!linkedPatientIds.includes(req.body.patientId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to message for this patient'
        });
      }

      logger.info('Family message request recorded', {
        familyUserId: req.user._id,
        patientId: req.body.patientId
      });

      res.json({
        success: true,
        message: 'Message recorded successfully'
      });
    } catch (error) {
      logger.error('Family message error:', error);
      res.status(500).json({ message: 'Failed to record family message' });
    }
  }
);

/**
 * @route   GET /api/dashboard/analytics
 * @desc    Get analytics data for reporting
 * @access  Private (admin, clinician)
 */
router.get('/analytics',
  authenticate,
  authorize(['admin', 'clinician', 'auditor']),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('metric').optional().isIn(['alerts', 'checkins', 'vitals', 'compliance'])
  ],
  async (req, res) => {
    try {
      const { startDate, endDate, metric } = req.query;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      let analyticsData = {};

      if (!metric || metric === 'alerts') {
        // Alert analytics
        const alertsByDay = await Alert.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
              },
              total: { $sum: 1 },
              critical: {
                $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
              },
              resolved: {
                $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
              }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        const avgResponseTime = await Alert.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              'acknowledgedBy.responseTime': { $exists: true }
            }
          },
          {
            $group: {
              _id: null,
              avgTime: { $avg: '$acknowledgedBy.responseTime' }
            }
          }
        ]);

        analyticsData.alerts = {
          byDay: alertsByDay,
          avgResponseTime: avgResponseTime[0]?.avgTime || null
        };
      }

      if (!metric || metric === 'checkins') {
        // Check-in analytics
        const checkInsByDay = await CheckIn.aggregate([
          {
            $match: {
              timestamp: { $gte: start, $lte: end },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
              },
              total: { $sum: 1 },
              avgWellnessScore: { $avg: '$wellnessScore' }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        const verificationMethods = await CheckIn.aggregate([
          {
            $match: {
              timestamp: { $gte: start, $lte: end },
              status: 'completed'
            }
          },
          {
            $group: {
              _id: '$verificationMethod',
              count: { $sum: 1 }
            }
          }
        ]);

        analyticsData.checkIns = {
          byDay: checkInsByDay,
          verificationMethods: verificationMethods.reduce((acc, item) => {
            acc[item._id || 'unknown'] = item.count;
            return acc;
          }, {})
        };
      }

      if (!metric || metric === 'compliance') {
        // Compliance analytics
        const complianceByPatient = await CheckIn.aggregate([
          {
            $match: {
              timestamp: { $gte: start, $lte: end }
            }
          },
          {
            $group: {
              _id: '$patient',
              total: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
              }
            }
          },
          {
            $addFields: {
              complianceRate: {
                $multiply: [{ $divide: ['$completed', '$total'] }, 100]
              }
            }
          },
          { $sort: { complianceRate: -1 } },
          { $limit: 20 }
        ]);

        analyticsData.compliance = {
          topPatients: complianceByPatient
        };
      }

      res.json({
        success: true,
        data: {
          period: { start, end },
          ...analyticsData
        }
      });

    } catch (error) {
      logger.error('Analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics'
      });
    }
  }
);

// Helper functions
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function addMinutes(timeStr, minutes) {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

export default router;

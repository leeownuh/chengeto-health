import CareSchedule from '../models/CareSchedule.js';
import CheckIn from '../models/CheckIn.js';
import Alert from '../models/Alert.js';
import IoTDevice from '../models/IoTDevice.js';
import { buildMedicationSnapshot } from './medication.js';

export const ACTIVE_WORKFLOW_ALERT_STATUSES = ['pending', 'acknowledged', 'escalated', 'active'];

const DEVICE_STALE_WINDOW_MS = 6 * 60 * 60 * 1000;

export function getDayName(date = new Date()) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
}

export function toTimeMinutes(value = '00:00') {
  const [hours = 0, minutes = 0] = String(value).split(':').map((part) => Number.parseInt(part, 10) || 0);
  return (hours * 60) + minutes;
}

export function isWithinWindow(dateValue, startTime, endTime) {
  if (!dateValue || !startTime || !endTime) {
    return false;
  }

  const date = new Date(dateValue);
  const minutes = (date.getHours() * 60) + date.getMinutes();
  return minutes >= toTimeMinutes(startTime) && minutes <= toTimeMinutes(endTime);
}

function getWindowWorkflowStatus(window, completedCheckIn, now = new Date()) {
  if (completedCheckIn) {
    return 'completed';
  }

  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const startMinutes = toTimeMinutes(window?.startTime);
  const endMinutes = toTimeMinutes(window?.endTime);
  const graceMinutes = Number(window?.gracePeriod) || 15;

  if (currentMinutes < startMinutes) {
    return 'upcoming';
  }

  if (currentMinutes <= endMinutes + graceMinutes) {
    return 'due_now';
  }

  return 'overdue';
}

function getPriorityWeight(priority) {
  switch (priority) {
    case 'urgent':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    default:
      return 3;
  }
}

function sortWorkflowTasks(left, right) {
  const priorityDelta = getPriorityWeight(left.priority) - getPriorityWeight(right.priority);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return toTimeMinutes(left.startTime) - toTimeMinutes(right.startTime);
}

function summarizeWorkflowPatient(patient) {
  return {
    _id: patient._id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    name: `${patient.firstName} ${patient.lastName}`.trim(),
    phone: patient.phone || null,
    riskLevel: patient.riskLevel || 'low',
    address: {
      area: [patient.address?.village, patient.address?.district].filter(Boolean).join(', ') || 'Unknown area'
    },
    location: patient.address?.coordinates
      ? {
          latitude: patient.address.coordinates.latitude,
          longitude: patient.address.coordinates.longitude,
          coordinates: [
            patient.address.coordinates.longitude,
            patient.address.coordinates.latitude
          ]
        }
      : null
  };
}

function createEmptyWorkflowSnapshot() {
  return {
    allTasks: [],
    dueNow: [],
    overdue: [],
    upcoming: [],
    completedToday: [],
    medicationTasks: [],
    staleDevices: [],
    handoffNotes: [],
    summary: {
      dueNow: 0,
      overdue: 0,
      upcoming: 0,
      completedToday: 0,
      medicationTasks: 0,
      staleDevices: 0,
      handoffNotes: 0,
      pendingTasks: 0
    }
  };
}

export async function buildWorkflowSnapshot({ patients = [], role = null, now = new Date() } = {}) {
  if (!Array.isArray(patients) || patients.length === 0) {
    return createEmptyWorkflowSnapshot();
  }

  const patientIds = patients.map((patient) => patient._id);
  const patientMap = new Map(patients.map((patient) => [String(patient._id), patient]));

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(dayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayName = getDayName(dayStart);
  const staleThreshold = new Date(now.getTime() - DEVICE_STALE_WINDOW_MS);
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  const [schedules, completedCheckIns, recentCheckIns, activeAlerts, devices] = await Promise.all([
    CareSchedule.find({
      patient: { $in: patientIds },
      status: 'active'
    }).lean(),
    CheckIn.find({
      patient: { $in: patientIds },
      status: 'completed',
      $or: [
        { actualTime: { $gte: dayStart, $lt: tomorrow } },
        { createdAt: { $gte: dayStart, $lt: tomorrow } }
      ]
    })
      .select('patient actualTime createdAt notes medication')
      .lean(),
    CheckIn.find({
      patient: { $in: patientIds },
      'notes.handoffs.0': { $exists: true }
    })
      .sort({ actualTime: -1, createdAt: -1 })
      .limit(20)
      .populate('patient', 'firstName lastName patientId')
      .populate('caregiver', 'firstName lastName role')
      .lean(),
    Alert.find({
      patient: { $in: patientIds },
      status: { $in: ACTIVE_WORKFLOW_ALERT_STATUSES }
    })
      .select('patient severity')
      .lean(),
    IoTDevice.find({
      assignedPatient: { $in: patientIds }
    })
      .select('assignedPatient deviceId status connection power')
      .lean()
  ]);

  const completedCheckInsByPatient = new Map();
  completedCheckIns.forEach((entry) => {
    const key = String(entry.patient);
    const existing = completedCheckInsByPatient.get(key) || [];
    existing.push(entry);
    completedCheckInsByPatient.set(key, existing);
  });

  const alertCountByPatient = new Map();
  const criticalAlertCountByPatient = new Map();
  activeAlerts.forEach((alert) => {
    const key = String(alert.patient);
    alertCountByPatient.set(key, (alertCountByPatient.get(key) || 0) + 1);
    if (alert.severity === 'critical') {
      criticalAlertCountByPatient.set(key, (criticalAlertCountByPatient.get(key) || 0) + 1);
    }
  });

  const allTasks = [];

  schedules.forEach((schedule) => {
    const patient = patientMap.get(String(schedule.patient));
    if (!patient) {
      return;
    }

    const completedEntries = completedCheckInsByPatient.get(String(schedule.patient)) || [];

    (schedule.checkinWindows || [])
      .filter((window) => !window.days || window.days.length === 0 || window.days.includes(todayName))
      .forEach((window) => {
        const completedCheckIn = completedEntries.find((entry) => (
          isWithinWindow(entry.actualTime || entry.createdAt, window.startTime, window.endTime)
        ));

        const workflowStatus = getWindowWorkflowStatus(window, completedCheckIn, now);
        const criticalAlerts = criticalAlertCountByPatient.get(String(schedule.patient)) || 0;
        const activeAlertCount = alertCountByPatient.get(String(schedule.patient)) || 0;

        allTasks.push({
          _id: `${schedule._id}:${window.name}:${window.startTime}`,
          scheduleId: schedule._id,
          patient: summarizeWorkflowPatient(patient),
          windowName: window.name,
          startTime: window.startTime,
          endTime: window.endTime,
          workflowStatus,
          minutesFromNow: toTimeMinutes(window.startTime) - currentMinutes,
          priority:
            criticalAlerts > 0
              ? 'urgent'
              : activeAlertCount > 0
                ? 'high'
                : workflowStatus === 'overdue'
                  ? 'high'
                  : workflowStatus === 'due_now'
                    ? 'medium'
                    : 'low',
          activeAlertsCount: activeAlertCount,
          completedCheckInId: completedCheckIn?._id || null
        });
      });
  });

  allTasks.sort(sortWorkflowTasks);

  const schedulesByPatient = new Map(
    schedules.map((schedule) => [String(schedule.patient), schedule])
  );

  const medicationTasks = patients.flatMap((patient) => {
    const snapshot = buildMedicationSnapshot(
      patient,
      schedulesByPatient.get(String(patient._id)) || null,
      completedCheckInsByPatient.get(String(patient._id)) || []
    );

    return snapshot.medications
      .filter((medication) => medication.dueToday)
      .map((medication) => ({
        patient: summarizeWorkflowPatient(patient),
        medication: medication.name,
        name: medication.name,
        dosage: medication.dosage,
        scheduledTime: medication.scheduledTime,
        status: medication.todayStatus || 'pending',
        refillConcern: medication.refillConcern
      }));
  });

  const staleDevices = devices
    .filter((device) => {
      const lastOnline = device.connection?.lastOnline;
      return (
        device.status === 'maintenance' ||
        device.connection?.online === false ||
        !lastOnline ||
        new Date(lastOnline) < staleThreshold
      );
    })
    .map((device) => {
      const patient = patientMap.get(String(device.assignedPatient));
      return {
        _id: device._id,
        deviceId: device.deviceId,
        patient: patient ? summarizeWorkflowPatient(patient) : null,
        status: device.status,
        lastSeen: device.connection?.lastOnline || null,
        batteryLevel: device.power?.batteryLevel ?? null
      };
    });

  const handoffNotes = recentCheckIns.flatMap((entry) => (
    (entry.notes?.handoffs || [])
      .filter((handoff) => handoff.status === 'pending' && (
        !handoff.targetRole ||
        !role ||
        handoff.targetRole === role ||
        role === 'admin'
      ))
      .map((handoff) => ({
        checkInId: entry._id,
        patient: entry.patient
          ? {
              _id: entry.patient._id,
              patientId: entry.patient.patientId,
              name: `${entry.patient.firstName} ${entry.patient.lastName}`.trim()
            }
          : null,
        from: entry.caregiver
          ? `${entry.caregiver.firstName} ${entry.caregiver.lastName}`.trim()
          : 'Care team',
        fromRole: entry.caregiver?.role || 'caregiver',
        targetRole: handoff.targetRole,
        priority: handoff.priority,
        note: handoff.note,
        createdAt: handoff.createdAt || entry.actualTime || entry.createdAt
      }))
  ));

  const dueNow = allTasks.filter((task) => task.workflowStatus === 'due_now');
  const overdue = allTasks.filter((task) => task.workflowStatus === 'overdue');
  const upcoming = allTasks.filter((task) => task.workflowStatus === 'upcoming');
  const completedToday = allTasks.filter((task) => task.workflowStatus === 'completed');
  const pendingTasks = dueNow.length + overdue.length + upcoming.length;

  return {
    allTasks,
    dueNow,
    overdue,
    upcoming,
    completedToday,
    medicationTasks,
    staleDevices,
    handoffNotes,
    summary: {
      dueNow: dueNow.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      completedToday: completedToday.length,
      medicationTasks: medicationTasks.length,
      staleDevices: staleDevices.length,
      handoffNotes: handoffNotes.length,
      pendingTasks
    }
  };
}

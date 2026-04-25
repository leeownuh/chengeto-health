import Alert from '../models/Alert.js';
import CheckIn from '../models/CheckIn.js';
import IoTDevice from '../models/IoTDevice.js';
import IoTTelemetry from '../models/IoTTelemetry.js';
import CareSchedule from '../models/CareSchedule.js';
import CareTransition from '../models/CareTransition.js';
import { buildMedicationSnapshot } from '../utils/medication.js';
import { buildTransitionSummary, getTransitionTaskEntries } from '../utils/careTransition.js';

const ACTIVE_ALERT_STATUSES = ['pending', 'acknowledged', 'escalated', 'active'];
const ACTIVE_TRANSITION_STATUSES = ['active'];
const DEVICE_STALE_WINDOW_MS = 6 * 60 * 60 * 1000;
const RECENT_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function flattenThresholds(vitalThresholds = {}) {
  return {
    heartRateMin: vitalThresholds.heartRate?.min ?? 50,
    heartRateMax: vitalThresholds.heartRate?.max ?? 120,
    systolicMin: vitalThresholds.bloodPressure?.systolicMin ?? 90,
    systolicMax: vitalThresholds.bloodPressure?.systolicMax ?? 140,
    diastolicMin: vitalThresholds.bloodPressure?.diastolicMin ?? 60,
    diastolicMax: vitalThresholds.bloodPressure?.diastolicMax ?? 90,
    temperatureMin: vitalThresholds.temperature?.min ?? 36.0,
    temperatureMax: vitalThresholds.temperature?.max ?? 38.0,
    spo2Min: vitalThresholds.oxygenSaturation?.min ?? 90,
    respiratoryRateMin: vitalThresholds.respiratoryRate?.min ?? 12,
    respiratoryRateMax: vitalThresholds.respiratoryRate?.max ?? 24,
    bloodGlucoseMin: vitalThresholds.bloodGlucose?.min ?? 70,
    bloodGlucoseMax: vitalThresholds.bloodGlucose?.max ?? 180,
    weightMin: vitalThresholds.weight?.min ?? 35,
    weightMax: vitalThresholds.weight?.max ?? 150
  };
}

function getVitalSnapshot(telemetry, checkIn) {
  return {
    heartRate: telemetry?.heartRate?.value ?? checkIn?.vitals?.heartRate?.value ?? null,
    systolic: telemetry?.bloodPressure?.systolic?.value ?? checkIn?.vitals?.bloodPressure?.systolic ?? null,
    diastolic: telemetry?.bloodPressure?.diastolic?.value ?? checkIn?.vitals?.bloodPressure?.diastolic ?? null,
    oxygenSaturation: telemetry?.oxygenSaturation?.value ?? checkIn?.vitals?.oxygenSaturation?.value ?? null,
    temperature: telemetry?.temperature?.value ?? checkIn?.vitals?.temperature?.value ?? null,
    respiratoryRate: telemetry?.respiratoryRate?.value ?? checkIn?.vitals?.respiratoryRate?.value ?? null,
    bloodGlucose: telemetry?.bloodGlucose?.value ?? checkIn?.vitals?.bloodGlucose?.value ?? null,
    weight: telemetry?.weight?.value ?? checkIn?.vitals?.weight?.value ?? null,
    rhythmIrregularity: telemetry?.cardiacRhythm?.irregular ?? checkIn?.vitals?.cardiacRhythm?.irregular ?? null
  };
}

function compareThreshold(value, min, max) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (Number.isFinite(min) && value < min) {
    return 'low';
  }

  if (Number.isFinite(max) && value > max) {
    return 'high';
  }

  return null;
}

function addBreakdownPoints(breakdown, category, points) {
  breakdown[category] = (breakdown[category] || 0) + points;
}

function addReason(reasons, breakdown, category, points, severity, title, detail) {
  if (!points) {
    return;
  }

  addBreakdownPoints(breakdown, category, points);
  reasons.push({
    category,
    points,
    severity,
    title,
    detail
  });
}

function deriveRiskLevel(score, reasons = []) {
  if (reasons.some((reason) => reason.severity === 'critical')) {
    return 'critical';
  }

  if (score >= 75) {
    return 'critical';
  }

  if (score >= 50) {
    return 'high';
  }

  if (score >= 25) {
    return 'moderate';
  }

  return 'low';
}

function buildRiskSummary(level, reasons) {
  const topReasons = reasons
    .slice()
    .sort((left, right) => right.points - left.points)
    .slice(0, 3)
    .map((reason) => reason.title.toLowerCase());

  if (topReasons.length === 0) {
    return 'Stable today with no major risk signals detected.';
  }

  return `${level.charAt(0).toUpperCase()}${level.slice(1)} priority because of ${topReasons.join(', ')}.`;
}

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isRecent(dateValue, maxAgeMs, now = new Date()) {
  if (!dateValue) {
    return false;
  }

  const parsed = new Date(dateValue);
  return !Number.isNaN(parsed.getTime()) && (now.getTime() - parsed.getTime()) <= maxAgeMs;
}

export async function buildPatientRiskContext(patientIds = []) {
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    return {
      latestTelemetryByPatient: new Map(),
      latestCheckInByPatient: new Map(),
      recentCheckInsByPatient: new Map(),
      activeAlertsByPatient: new Map(),
      devicesByPatient: new Map(),
      schedulesByPatient: new Map(),
      transitionsByPatient: new Map()
    };
  }

  const [telemetryDocs, checkInDocs, activeAlerts, devices, schedules, transitions] = await Promise.all([
    IoTTelemetry.find({ patient: { $in: patientIds } })
      .sort({ timestamp: -1 })
      .lean(),
    CheckIn.find({
      patient: { $in: patientIds },
      status: 'completed'
    })
      .sort({ actualTime: -1, createdAt: -1 })
      .limit(500)
      .lean(),
    Alert.find({
      patient: { $in: patientIds },
      status: { $in: ACTIVE_ALERT_STATUSES }
    })
      .sort({ createdAt: -1 })
      .lean(),
    IoTDevice.find({
      assignedPatient: { $in: patientIds }
    }).lean(),
    CareSchedule.find({
      patient: { $in: patientIds },
      status: 'active'
    })
      .sort({ updatedAt: -1 })
      .lean(),
    CareTransition.find({
      patient: { $in: patientIds },
      status: { $in: ACTIVE_TRANSITION_STATUSES }
    })
      .sort({ dischargeDate: -1 })
      .lean()
  ]);

  const latestTelemetryByPatient = new Map();
  const latestCheckInByPatient = new Map();
  const recentCheckInsByPatient = new Map();
  const activeAlertsByPatient = new Map();
  const devicesByPatient = new Map();
  const schedulesByPatient = new Map();
  const transitionsByPatient = new Map();

  for (const telemetry of telemetryDocs) {
    const key = String(telemetry.patient);
    if (!latestTelemetryByPatient.has(key)) {
      latestTelemetryByPatient.set(key, telemetry);
    }
  }

  for (const checkIn of checkInDocs) {
    const key = String(checkIn.patient);
    if (!latestCheckInByPatient.has(key)) {
      latestCheckInByPatient.set(key, checkIn);
    }

    const existing = recentCheckInsByPatient.get(key) || [];
    if (existing.length < 20) {
      existing.push(checkIn);
      recentCheckInsByPatient.set(key, existing);
    }
  }

  for (const alert of activeAlerts) {
    const key = String(alert.patient);
    const existing = activeAlertsByPatient.get(key) || [];
    existing.push(alert);
    activeAlertsByPatient.set(key, existing);
  }

  for (const device of devices) {
    const key = String(device.assignedPatient);
    const existing = devicesByPatient.get(key) || [];
    existing.push(device);
    devicesByPatient.set(key, existing);
  }

  for (const schedule of schedules) {
    const key = String(schedule.patient);
    if (!schedulesByPatient.has(key)) {
      schedulesByPatient.set(key, schedule);
    }
  }

  for (const transition of transitions) {
    const key = String(transition.patient);
    const existing = transitionsByPatient.get(key) || [];
    existing.push(transition);
    transitionsByPatient.set(key, existing);
  }

  return {
    latestTelemetryByPatient,
    latestCheckInByPatient,
    recentCheckInsByPatient,
    activeAlertsByPatient,
    devicesByPatient,
    schedulesByPatient,
    transitionsByPatient
  };
}

export function buildRiskStratification(patient, context = {}, now = new Date()) {
  const thresholds = flattenThresholds(patient?.vitalThresholds);
  const latestTelemetry = context.latestTelemetry || null;
  const latestCheckIn = context.latestCheckIn || null;
  const recentCheckIns = context.recentCheckIns || [];
  const activeAlerts = context.activeAlerts || [];
  const devices = context.devices || [];
  const schedule = context.schedule || null;
  const transitions = context.transitions || [];
  const medicationSnapshot = context.medicationSnapshot || buildMedicationSnapshot(
    patient,
    schedule,
    recentCheckIns,
    now
  );

  const scoreBreakdown = {
    alerts: 0,
    vitals: 0,
    medication: 0,
    function: 0,
    adherence: 0,
    device: 0,
    transitions: 0
  };
  const reasons = [];

  const criticalAlerts = activeAlerts.filter((alert) => alert.severity === 'critical');
  const activeHighAlerts = activeAlerts.filter((alert) => alert.severity === 'high');

  if (criticalAlerts.length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'alerts',
      28,
      'critical',
      `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? 's' : ''} active`,
      'Immediate response is required because critical alerts are still open.'
    );
  } else if (activeHighAlerts.length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'alerts',
      16,
      'high',
      `${activeHighAlerts.length} high-severity alert${activeHighAlerts.length > 1 ? 's' : ''}`,
      'Active high-severity alerts are increasing this patient’s urgency.'
    );
  } else if (activeAlerts.length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'alerts',
      8,
      'medium',
      `${activeAlerts.length} active alert${activeAlerts.length > 1 ? 's' : ''}`,
      'There are unresolved alerts that still need follow-up.'
    );
  }

  if (activeAlerts.some((alert) => isRecent(alert.createdAt, RECENT_ALERT_WINDOW_MS, now))) {
    addReason(
      reasons,
      scoreBreakdown,
      'alerts',
      6,
      'medium',
      'Recent alert activity',
      'At least one alert was triggered in the last 24 hours.'
    );
  }

  const vitalSnapshot = getVitalSnapshot(latestTelemetry, latestCheckIn);
  const vitalChecks = [
    {
      label: 'Heart rate out of range',
      value: vitalSnapshot.heartRate,
      status: compareThreshold(vitalSnapshot.heartRate, thresholds.heartRateMin, thresholds.heartRateMax),
      points: 10
    },
    {
      label: 'Blood pressure out of range',
      value: vitalSnapshot.systolic,
      status: compareThreshold(vitalSnapshot.systolic, thresholds.systolicMin, thresholds.systolicMax),
      points: 10
    },
    {
      label: 'Low oxygen saturation',
      value: vitalSnapshot.oxygenSaturation,
      status: compareThreshold(vitalSnapshot.oxygenSaturation, thresholds.spo2Min, null),
      points: 14
    },
    {
      label: 'Temperature out of range',
      value: vitalSnapshot.temperature,
      status: compareThreshold(vitalSnapshot.temperature, thresholds.temperatureMin, thresholds.temperatureMax),
      points: 8
    },
    {
      label: 'Respiratory rate out of range',
      value: vitalSnapshot.respiratoryRate,
      status: compareThreshold(vitalSnapshot.respiratoryRate, thresholds.respiratoryRateMin, thresholds.respiratoryRateMax),
      points: 8
    },
    {
      label: 'Blood glucose out of range',
      value: vitalSnapshot.bloodGlucose,
      status: compareThreshold(vitalSnapshot.bloodGlucose, thresholds.bloodGlucoseMin, thresholds.bloodGlucoseMax),
      points: 10
    }
  ];

  vitalChecks.forEach((check) => {
    if (!check.status) {
      return;
    }

    addReason(
      reasons,
      scoreBreakdown,
      'vitals',
      check.points,
      check.label === 'Low oxygen saturation' ? 'critical' : 'high',
      check.label,
      `${check.value} is outside the configured monitoring range.`
    );
  });

  if (vitalSnapshot.rhythmIrregularity) {
    addReason(
      reasons,
      scoreBreakdown,
      'vitals',
      8,
      'high',
      'Irregular rhythm detected',
      'Recent telemetry or check-in data reported rhythm irregularity.'
    );
  }

  const medicationSummary = medicationSnapshot.summary || {};
  if ((medicationSummary.missedToday || 0) > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'medication',
      12,
      'high',
      'Medication doses missed today',
      `${medicationSummary.missedToday} medication dose${medicationSummary.missedToday > 1 ? 's were' : ' was'} missed today.`
    );
  }

  if ((medicationSummary.refillRisks || 0) > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'medication',
      8,
      'medium',
      'Medication refill risk',
      'At least one active medication needs refill follow-up soon.'
    );
  }

  const recentFunctionalAssessment = latestCheckIn?.functionalStatus || {};
  if (recentFunctionalAssessment.recentFall) {
    addReason(
      reasons,
      scoreBreakdown,
      'function',
      recentFunctionalAssessment.fallInjury ? 20 : 14,
      recentFunctionalAssessment.fallInjury ? 'critical' : 'high',
      recentFunctionalAssessment.fallInjury ? 'Recent fall with injury risk' : 'Recent fall reported',
      recentFunctionalAssessment.changeNotes || 'A recent fall was captured during the latest check-in.'
    );
  }

  if (recentFunctionalAssessment.changedSinceLastVisit || recentFunctionalAssessment.nearFall) {
    addReason(
      reasons,
      scoreBreakdown,
      'function',
      8,
      'medium',
      'Functional decline reported',
      recentFunctionalAssessment.changeNotes || 'The latest visit captured functional decline or near-fall concerns.'
    );
  }

  if (patient?.functionalBaseline?.frailty === 'frail' || recentFunctionalAssessment.frailty === 'frail') {
    addReason(
      reasons,
      scoreBreakdown,
      'function',
      6,
      'medium',
      'Frailty risk',
      'The patient is currently marked as frail and needs closer observation.'
    );
  }

  if ((patient?.compliance?.consecutiveMissedCheckins || 0) > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'adherence',
      Math.min(18, 6 + ((patient.compliance.consecutiveMissedCheckins - 1) * 4)),
      'high',
      'Missed visit pattern',
      `${patient.compliance.consecutiveMissedCheckins} consecutive check-in${patient.compliance.consecutiveMissedCheckins > 1 ? 's' : ''} have been missed.`
    );
  }

  if ((patient?.compliance?.checkinAdherence ?? 100) < 80) {
    addReason(
      reasons,
      scoreBreakdown,
      'adherence',
      8,
      'medium',
      'Low check-in adherence',
      `Check-in adherence is ${patient.compliance.checkinAdherence || 0}%.`
    );
  }

  if ((patient?.compliance?.medicationAdherence ?? 100) < 80) {
    addReason(
      reasons,
      scoreBreakdown,
      'adherence',
      8,
      'medium',
      'Low medication adherence',
      `Medication adherence is ${patient.compliance.medicationAdherence || 0}%.`
    );
  }

  if (latestCheckIn?.followUp?.required) {
    addReason(
      reasons,
      scoreBreakdown,
      'adherence',
      6,
      latestCheckIn.followUp.priority === 'urgent' ? 'high' : 'medium',
      'Outstanding follow-up',
      latestCheckIn.followUp.reason || 'The latest check-in requested follow-up.'
    );
  }

  if ((latestCheckIn?.notes?.concerns || []).length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'adherence',
      6,
      'medium',
      'Caregiver concerns recorded',
      latestCheckIn.notes.concerns.slice(0, 2).join(', ')
    );
  }

  const staleThreshold = new Date(now.getTime() - DEVICE_STALE_WINDOW_MS);
  const staleDevices = devices.filter((device) => (
    device.status === 'maintenance' ||
    device.connection?.online === false ||
    !device.connection?.lastOnline ||
    new Date(device.connection.lastOnline) < staleThreshold
  ));

  if (staleDevices.length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'device',
      8,
      'medium',
      'Device freshness gap',
      `${staleDevices.length} device${staleDevices.length > 1 ? 's are' : ' is'} stale, offline, or in maintenance mode.`
    );
  }

  if (devices.some((device) => Number(device.power?.batteryLevel) > 0 && Number(device.power?.batteryLevel) < 20)) {
    addReason(
      reasons,
      scoreBreakdown,
      'device',
      5,
      'medium',
      'Low device battery',
      'At least one assigned device is close to running out of battery.'
    );
  }

  const transitionSummaries = transitions.map((transition) => buildTransitionSummary(transition, now)).filter(Boolean);
  const overdueTransitionTasks = transitionSummaries.flatMap((summary) =>
    (summary.followUpTasks || []).filter((task) => task.status === 'overdue')
  );

  if (transitionSummaries.length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'transitions',
      10,
      'medium',
      'Active post-discharge transition',
      'This patient is currently in a care-transition follow-up window.'
    );
  }

  if (overdueTransitionTasks.length > 0) {
    addReason(
      reasons,
      scoreBreakdown,
      'transitions',
      12,
      'high',
      'Overdue transition follow-up',
      `${overdueTransitionTasks.length} post-discharge task${overdueTransitionTasks.length > 1 ? 's are' : ' is'} overdue.`
    );
  }

  if (transitionSummaries.some((summary) => (summary.redFlags || []).length > 0)) {
    addReason(
      reasons,
      scoreBreakdown,
      'transitions',
      6,
      'medium',
      'Transition red flags recorded',
      transitionSummaries
        .flatMap((summary) => summary.redFlags || [])
        .slice(0, 2)
        .join(', ')
    );
  }

  const rawScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  const score = clampScore(rawScore);
  const sortedReasons = reasons.sort((left, right) => right.points - left.points);
  const level = deriveRiskLevel(score, sortedReasons);

  return {
    score,
    level,
    summary: buildRiskSummary(level, sortedReasons),
    reasons: sortedReasons,
    breakdown: scoreBreakdown,
    medicationSummary,
    transitionSummaries,
    lastEvaluatedAt: now,
    hasActiveTransition: transitionSummaries.length > 0,
    persistentRiskLevel: patient?.riskLevel || 'moderate'
  };
}

export async function buildRiskProfilesForPatients(patients = [], options = {}) {
  if (!Array.isArray(patients) || patients.length === 0) {
    return new Map();
  }

  const now = options.now || new Date();
  const context = options.context || await buildPatientRiskContext(patients.map((patient) => patient._id));
  const profiles = new Map();

  patients.forEach((patient) => {
    const key = String(patient._id);
    profiles.set(key, buildRiskStratification(patient, {
      latestTelemetry: context.latestTelemetryByPatient.get(key),
      latestCheckIn: context.latestCheckInByPatient.get(key),
      recentCheckIns: context.recentCheckInsByPatient.get(key) || [],
      activeAlerts: context.activeAlertsByPatient.get(key) || [],
      devices: context.devicesByPatient.get(key) || [],
      schedule: context.schedulesByPatient.get(key) || null,
      transitions: context.transitionsByPatient.get(key) || []
    }, now));
  });

  return profiles;
}

export async function buildRiskProfileForPatient(patient, options = {}) {
  if (!patient?._id) {
    return null;
  }

  const profiles = await buildRiskProfilesForPatients([patient], options);
  return profiles.get(String(patient._id)) || null;
}

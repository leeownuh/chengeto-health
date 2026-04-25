import express from 'express';
import { body, param, validationResult } from 'express-validator';
import Patient from '../models/Patient.js';
import Alert from '../models/Alert.js';
import CheckIn from '../models/CheckIn.js';
import IoTDevice from '../models/IoTDevice.js';
import IoTTelemetry from '../models/IoTTelemetry.js';
import CareSchedule from '../models/CareSchedule.js';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { normalizeNcdConditions } from '../config/elderlyNcdProfiles.js';
import { buildCarePlanPayload } from '../utils/carePlan.js';
import { buildFunctionalBaselinePayload } from '../utils/functionalStatus.js';
import { buildMedicationSnapshot } from '../utils/medication.js';
import { buildRiskProfileForPatient, buildRiskProfilesForPatients } from '../services/riskScoring.service.js';
import {
  ACTIVE_ALERT_STATUSES,
  buildPatientAccessMatch,
  flattenThresholds,
  mapLatestVitals,
  normalizePatientLegacy,
  parseLimit,
  parsePage
} from './compat.utils.js';

const router = express.Router();

function buildThresholdPayload(vitalThresholds = {}, existingThresholds = null) {
  return {
    heartRate: {
      min: vitalThresholds?.heartRateMin ?? existingThresholds?.heartRate?.min ?? 60,
      max: vitalThresholds?.heartRateMax ?? existingThresholds?.heartRate?.max ?? 100
    },
    bloodPressure: {
      systolicMin:
        vitalThresholds?.systolicMin ?? existingThresholds?.bloodPressure?.systolicMin ?? 90,
      systolicMax:
        vitalThresholds?.systolicMax ?? existingThresholds?.bloodPressure?.systolicMax ?? 140,
      diastolicMin:
        vitalThresholds?.diastolicMin ?? existingThresholds?.bloodPressure?.diastolicMin ?? 60,
      diastolicMax:
        vitalThresholds?.diastolicMax ?? existingThresholds?.bloodPressure?.diastolicMax ?? 90
    },
    oxygenSaturation: {
      min: vitalThresholds?.spo2Min ?? existingThresholds?.oxygenSaturation?.min ?? 95
    },
    temperature: {
      min: vitalThresholds?.temperatureMin ?? existingThresholds?.temperature?.min ?? 36,
      max: vitalThresholds?.temperatureMax ?? existingThresholds?.temperature?.max ?? 37.5
    },
    respiratoryRate: {
      min: vitalThresholds?.respiratoryRateMin ?? existingThresholds?.respiratoryRate?.min ?? 12,
      max: vitalThresholds?.respiratoryRateMax ?? existingThresholds?.respiratoryRate?.max ?? 24
    },
    bloodGlucose: {
      min: vitalThresholds?.bloodGlucoseMin ?? existingThresholds?.bloodGlucose?.min ?? 70,
      max: vitalThresholds?.bloodGlucoseMax ?? existingThresholds?.bloodGlucose?.max ?? 180
    },
    weight: {
      min: vitalThresholds?.weightMin ?? existingThresholds?.weight?.min ?? 35,
      max: vitalThresholds?.weightMax ?? existingThresholds?.weight?.max ?? 150
    }
  };
}

function buildCareWindowDays(frequency) {
  return frequency === 'weekly'
    ? ['monday']
    : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
}

function toCsv(rows) {
  if (!rows.length) {
    return '';
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escapeValue = (value) => {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value).replace(/"/g, '""');
    return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
  };

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(','))
  ].join('\n');
}

function buildSearchMatcher(search) {
  if (!search) {
    return () => true;
  }

  const normalized = search.toLowerCase();

  return (patient) =>
    [
      patient.firstName,
      patient.lastName,
      patient.patientId,
      patient.phone,
      patient.nationalId
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
}

async function getPatientContext(patientIds) {
  if (!patientIds.length) {
    return {
      alertsByPatient: new Map(),
      latestTelemetryByPatient: new Map(),
      latestCheckInByPatient: new Map(),
      schedulesByPatient: new Map()
    };
  }

  const [alertsAgg, telemetryDocs, checkInDocs, schedules] = await Promise.all([
    Alert.aggregate([
      {
        $match: {
          patient: { $in: patientIds },
          status: { $in: ACTIVE_ALERT_STATUSES }
        }
      },
      { $group: { _id: '$patient', count: { $sum: 1 } } }
    ]),
    IoTTelemetry.find({ patient: { $in: patientIds } }).sort({ timestamp: -1 }).lean(),
    CheckIn.find({ patient: { $in: patientIds }, status: 'completed' })
      .sort({ actualTime: -1, createdAt: -1 })
      .populate('caregiver', 'firstName lastName role')
      .lean(),
    CareSchedule.find({ patient: { $in: patientIds } }).sort({ updatedAt: -1 }).lean()
  ]);

  const alertsByPatient = new Map(
    alertsAgg.map((entry) => [String(entry._id), entry.count])
  );
  const latestTelemetryByPatient = new Map();
  const latestCheckInByPatient = new Map();
  const schedulesByPatient = new Map();

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
  }

  for (const schedule of schedules) {
    const key = String(schedule.patient);
    if (!schedulesByPatient.has(key)) {
      schedulesByPatient.set(key, schedule);
    }
  }

  return {
    alertsByPatient,
    latestTelemetryByPatient,
    latestCheckInByPatient,
    schedulesByPatient
  };
}

async function calculateCheckInStreak(patientId) {
  const history = await CheckIn.find({
    patient: patientId,
    status: 'completed'
  })
    .sort({ actualTime: -1, createdAt: -1 })
    .select('actualTime createdAt')
    .limit(30)
    .lean();

  let streak = 0;
  let expectedDate = null;

  for (const checkIn of history) {
    const timestamp = checkIn.actualTime ?? checkIn.createdAt;
    if (!timestamp) {
      continue;
    }

    const dateKey = new Date(timestamp);
    dateKey.setHours(0, 0, 0, 0);

    if (!expectedDate) {
      expectedDate = dateKey;
      streak += 1;
      expectedDate = new Date(expectedDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
      continue;
    }

    if (dateKey.getTime() === expectedDate.getTime()) {
      streak += 1;
      expectedDate = new Date(expectedDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
      continue;
    }

    if (dateKey.getTime() < expectedDate.getTime()) {
      break;
    }
  }

  return streak;
}

function buildScheduleHints(schedule) {
  if (!schedule) {
    return { nextCheckIn: null, nextAppointment: null };
  }

  const firstWindow = schedule.checkinWindows?.[0];
  const firstActivity = schedule.weeklyActivities?.[0];

  return {
    nextCheckIn: firstWindow ? `${firstWindow.startTime}-${firstWindow.endTime}` : null,
    nextAppointment: firstActivity ? `${firstActivity.day} ${firstActivity.time}` : null
  };
}

async function getAccessiblePatient(req, patientId) {
  const query = {
    _id: patientId,
    ...buildPatientAccessMatch(req.user)
  };

  return Patient.findOne(query)
    .populate('primaryCaregiver', 'firstName lastName email phone role')
    .populate('assignedCHW', 'firstName lastName email phone role')
    .populate('assignedClinician', 'firstName lastName email phone role')
    .populate('familyMembers.user', 'firstName lastName email phone role')
    .lean({ virtuals: true, getters: true });
}

router.get(
  '/export',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  async (req, res) => {
    const patients = await Patient.find(buildPatientAccessMatch(req.user))
      .populate('assignedCHW', 'firstName lastName')
      .lean({ virtuals: true, getters: true });

    const rows = patients.map((patient) => ({
      patientId: patient.patientId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      gender: patient.gender,
      phone: patient.phone,
      status: patient.status,
      riskLevel: patient.riskLevel,
      district: patient.address?.district,
      province: patient.address?.province,
      assignedCHW: patient.assignedCHW
        ? `${patient.assignedCHW.firstName} ${patient.assignedCHW.lastName}`
        : ''
    }));

    const csv = toCsv(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('patients.csv');
    res.send(csv);
  }
);

router.get(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  async (req, res) => {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20);
    const sortField = req.query.sort ?? req.query.sortBy ?? 'lastName';
    const sortOrder = req.query.order === 'desc' || req.query.sortOrder === 'desc' ? -1 : 1;
    const searchMatcher = buildSearchMatcher(req.query.search);
    const dbQuery = { ...buildPatientAccessMatch(req.user) };

    if (req.query.status) {
      dbQuery.status = {
        $in: String(req.query.status)
          .split(',')
          .map((status) => status.trim())
          .filter(Boolean)
      };
    }

    const patients = await Patient.find(dbQuery)
      .populate('primaryCaregiver', 'firstName lastName email phone role')
      .populate('assignedCHW', 'firstName lastName email phone role')
      .populate('assignedClinician', 'firstName lastName email phone role')
      .lean({ virtuals: true, getters: true });

    const filteredPatients = patients.filter(searchMatcher);
    const patientIds = filteredPatients.map((patient) => patient._id);
    const context = await getPatientContext(patientIds);
    const riskProfiles = await buildRiskProfilesForPatients(filteredPatients, {
      context: undefined
    });

    const legacyPatients = filteredPatients
      .map((patient) => {
        const patientKey = String(patient._id);
        const latestCheckIn = context.latestCheckInByPatient.get(patientKey);
        const schedule = context.schedulesByPatient.get(patientKey);
        const riskStratification = riskProfiles.get(patientKey) || null;

        return normalizePatientLegacy(patient, {
          activeAlerts: context.alertsByPatient.get(patientKey) ?? 0,
          latestCheckIn,
          lastCheckIn: latestCheckIn?.actualTime ?? patient.compliance?.lastCheckin ?? null,
          latestVitals: mapLatestVitals(
            context.latestTelemetryByPatient.get(patientKey),
            latestCheckIn,
            flattenThresholds(patient.vitalThresholds)
          ),
          riskStratification,
          transitionSummaries: riskStratification?.transitionSummaries || [],
          ...buildScheduleHints(schedule)
        });
      })
      .filter((patient) => {
        if (!req.query.careLevel) {
          return true;
        }

        const levels = String(req.query.careLevel)
          .split(',')
          .map((level) => level.trim())
          .filter(Boolean);

        return levels.length === 0 || levels.includes(patient.careLevel);
      })
      .sort((left, right) => {
        const leftValue = left[sortField] ?? '';
        const rightValue = right[sortField] ?? '';

        if (leftValue < rightValue) {
          return -1 * sortOrder;
        }
        if (leftValue > rightValue) {
          return 1 * sortOrder;
        }
        return 0;
      });

    const total = legacyPatients.length;
    const pagedPatients = legacyPatients.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: {
        patients: pagedPatients,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          perPage: limit
        }
      },
      patients: pagedPatients,
      total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit) || 1,
        total,
        perPage: limit
      }
    });
  }
);

router.get(
  '/:id/vitals/history',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const range = req.query.range ?? (req.query.days ? `${req.query.days}d` : '7d');
    const hours =
      range === '1h'
        ? 1
        : range === '6h'
          ? 6
          : range === '24h'
            ? 24
            : range === '30d'
              ? 24 * 30
              : 24 * 7;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const telemetry = await IoTTelemetry.find({
      patient: patient._id,
      timestamp: { $gte: since }
    })
      .sort({ timestamp: 1 })
      .lean();

    const history = telemetry.map((entry) => ({
      timestamp: entry.timestamp,
      heartRate: entry.heartRate?.value ?? null,
      systolic: entry.bloodPressure?.systolic?.value ?? null,
      diastolic: entry.bloodPressure?.diastolic?.value ?? null,
      temperature: entry.temperature?.value ?? null,
      spo2: entry.oxygenSaturation?.value ?? null,
      respiratoryRate: entry.respiratoryRate?.value ?? null,
      bloodGlucose: entry.bloodGlucose?.value ?? null,
      weight: entry.weight?.value ?? null,
      rhythmIrregularity: entry.cardiacRhythm?.irregular ?? null,
      source: 'iot'
    }));

    const latestCheckIn = await CheckIn.findOne({
      patient: patient._id,
      status: 'completed'
    })
      .sort({ actualTime: -1, createdAt: -1 })
      .lean();
    const current = mapLatestVitals(
      telemetry[telemetry.length - 1] ?? null,
      latestCheckIn,
      flattenThresholds(patient.vitalThresholds)
    );

    res.json({
      success: true,
      data: { current, history },
      current,
      history
    });
  }
);

router.get(
  '/:id/vitals/export',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const telemetry = await IoTTelemetry.find({
      patient: patient._id,
      timestamp: { $gte: since }
    })
      .sort({ timestamp: 1 })
      .lean();

    const rows = telemetry.map((entry) => ({
      timestamp: entry.timestamp?.toISOString?.() ?? entry.timestamp,
      heartRate: entry.heartRate?.value ?? '',
      systolic: entry.bloodPressure?.systolic?.value ?? '',
      diastolic: entry.bloodPressure?.diastolic?.value ?? '',
      temperature: entry.temperature?.value ?? '',
      spo2: entry.oxygenSaturation?.value ?? '',
      respiratoryRate: entry.respiratoryRate?.value ?? '',
      bloodGlucose: entry.bloodGlucose?.value ?? '',
      weight: entry.weight?.value ?? '',
      rhythmIrregularity: entry.cardiacRhythm?.irregular ?? ''
    }));

    const csv = toCsv(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment(`vitals-${patient.patientId}.csv`);
    res.send(csv);
  }
);

router.post(
  '/:id/vitals',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver']),
  [
    param('id').isMongoId(),
    body('heartRate').optional().isFloat({ min: 20, max: 250 }),
    body('systolic').optional().isFloat({ min: 60, max: 260 }),
    body('diastolic').optional().isFloat({ min: 40, max: 200 }),
    body('temperature').optional().isFloat({ min: 30, max: 45 }),
    body('spo2').optional().isFloat({ min: 50, max: 100 }),
    body('respiratoryRate').optional().isFloat({ min: 4, max: 60 }),
    body('bloodGlucose').optional().isFloat({ min: 20, max: 600 }),
    body('weight').optional().isFloat({ min: 10, max: 300 }),
    body('rhythmIrregularity').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const telemetry = await IoTTelemetry.create({
      deviceId: patient.iotDevice?.deviceId ?? `manual-${patient.patientId}`,
      patient: patient._id,
      timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
      type: 'manual_vitals',
      data: {
        heartRate: req.body.heartRate ? Number(req.body.heartRate) : null,
        systolic: req.body.systolic ? Number(req.body.systolic) : null,
        diastolic: req.body.diastolic ? Number(req.body.diastolic) : null,
        temperature: req.body.temperature ? Number(req.body.temperature) : null,
        spo2: req.body.spo2 ? Number(req.body.spo2) : null,
        respiratoryRate: req.body.respiratoryRate ? Number(req.body.respiratoryRate) : null,
        bloodGlucose: req.body.bloodGlucose ? Number(req.body.bloodGlucose) : null,
        weight: req.body.weight ? Number(req.body.weight) : null,
        rhythmIrregularity:
          typeof req.body.rhythmIrregularity === 'boolean' ? req.body.rhythmIrregularity : null,
        notes: req.body.notes || ''
      },
      heartRate: req.body.heartRate
        ? { value: Number(req.body.heartRate), unit: 'bpm', status: 'normal', source: 'manual' }
        : undefined,
      bloodPressure:
        req.body.systolic || req.body.diastolic
          ? {
              systolic: { value: Number(req.body.systolic), status: 'normal' },
              diastolic: { value: Number(req.body.diastolic), status: 'normal' },
              unit: 'mmHg',
              measuredAt: new Date()
            }
          : undefined,
      oxygenSaturation: req.body.spo2
        ? { value: Number(req.body.spo2), unit: '%', status: 'normal' }
        : undefined,
      temperature: req.body.temperature
        ? { value: Number(req.body.temperature), unit: 'C', status: 'normal', location: 'wrist' }
        : undefined,
      respiratoryRate: req.body.respiratoryRate
        ? { value: Number(req.body.respiratoryRate), unit: 'breaths/min', status: 'normal' }
        : undefined,
      bloodGlucose: req.body.bloodGlucose
        ? { value: Number(req.body.bloodGlucose), unit: 'mg/dL', status: 'normal' }
        : undefined,
      weight: req.body.weight
        ? { value: Number(req.body.weight), unit: 'kg', status: 'normal' }
        : undefined,
      cardiacRhythm:
        typeof req.body.rhythmIrregularity === 'boolean'
          ? {
              irregular: req.body.rhythmIrregularity,
              source: 'manual',
              status: req.body.rhythmIrregularity ? 'abnormal' : 'normal'
            }
          : undefined,
      processed: true,
      processedAt: new Date(),
      rawData: req.body.notes || undefined
    });

    res.status(201).json({
      success: true,
      message: 'Vitals recorded successfully',
      data: telemetry
    });
  }
);

router.get(
  '/:id/checkins',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const limit = parseLimit(req.query.limit, 10, 50);
    const checkIns = await CheckIn.find({ patient: patient._id })
      .populate('caregiver', 'firstName lastName role')
      .sort({ actualTime: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const mapped = checkIns.map((checkIn) => ({
      _id: checkIn._id,
      status: checkIn.status,
      timestamp: checkIn.actualTime ?? checkIn.createdAt,
      method: checkIn.proximityVerification?.method ?? 'manual',
      caregiver: checkIn.caregiver
        ? {
            _id: checkIn.caregiver._id,
            firstName: checkIn.caregiver.firstName,
            lastName: checkIn.caregiver.lastName,
            role: checkIn.caregiver.role
          }
        : null,
      verificationMethod: checkIn.proximityVerification?.method ?? 'manual',
      notes: checkIn.notes?.caregiver ?? '',
      wellness: checkIn.wellness?.overallStatus ?? null,
      functionalStatus: checkIn.functionalStatus ?? null,
      wellnessScore:
        checkIn.wellness?.overallStatus === 'good'
          ? 9
          : checkIn.wellness?.overallStatus === 'fair'
            ? 6
            : checkIn.wellness?.overallStatus === 'poor'
              ? 3
              : checkIn.wellness?.overallStatus === 'critical'
                ? 1
                : null
    }));

    res.json({
      success: true,
      data: { checkins: mapped },
      checkins: mapped
    });
  }
);

router.get(
  '/:id/alerts',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const limit = parseLimit(req.query.limit, 10, 50);
    const alerts = await Alert.find({ patient: patient._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const mapped = alerts.map((alert) => ({
      _id: alert._id,
      severity: alert.severity,
      type: alert.type,
      status: alert.status === 'pending' ? 'active' : alert.status,
      title: alert.title,
      message: alert.message || alert.title || alert.type,
      createdAt: alert.createdAt,
      timestamp: alert.createdAt
    }));

    res.json({
      success: true,
      data: { alerts: mapped },
      alerts: mapped
    });
  }
);

router.get(
  '/:id/medications',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
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
  }
);

router.get(
  '/:id/devices',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const deviceRecords = await IoTDevice.find({ assignedPatient: patient._id }).lean();
    const devices =
      deviceRecords.length > 0
        ? deviceRecords.map((device) => ({
            _id: device._id,
            deviceId: device.deviceId,
            name: device.deviceType ?? device.type ?? 'IoT Device',
            type: device.deviceType ?? device.type,
            status: device.connection?.online ? 'online' : device.status,
            lastSeen: device.connection?.lastOnline ?? patient.iotDevice?.lastSeen ?? null
          }))
        : patient.iotDevice?.deviceId
          ? [
              {
                _id: patient.iotDevice.deviceId,
                deviceId: patient.iotDevice.deviceId,
                name: 'Wearable Monitor',
                type: 'patient_monitor',
                status: patient.iotDevice.status,
                lastSeen: patient.iotDevice.lastSeen ?? null
              }
            ]
          : [];

    res.json({
      success: true,
      data: { devices },
      devices
    });
  }
);

router.get(
  '/:id/family',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const family = (patient.familyMembers ?? []).map((member) => ({
      _id: member.user?._id ?? member.user,
      firstName: member.user?.firstName,
      lastName: member.user?.lastName,
      email: member.user?.email,
      phone: member.user?.phone,
      role: member.relationship,
      accessLevel: member.accessLevel
    }));

    res.json({
      success: true,
      data: { family },
      family
    });
  }
);

router.get(
  '/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'family', 'auditor']),
  async (req, res) => {
    const patient = await getAccessiblePatient(req, req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const patientKey = String(patient._id);
    const context = await getPatientContext([patient._id]);
    const checkInStreak = await calculateCheckInStreak(patient._id);
    const latestCheckIn = context.latestCheckInByPatient.get(patientKey);
    const schedule = context.schedulesByPatient.get(patientKey);
    const riskStratification = await buildRiskProfileForPatient(patient);
    const deviceRecords = await IoTDevice.find({ assignedPatient: patient._id }).lean();
    const devices = deviceRecords.map((device) => ({
      _id: device._id,
      deviceId: device.deviceId,
      name: device.deviceType ?? device.type ?? 'IoT Device',
      type: device.deviceType ?? device.type,
      status: device.connection?.online ? 'online' : device.status,
      lastSeen: device.connection?.lastOnline ?? patient.iotDevice?.lastSeen ?? null
    }));

    const payload = normalizePatientLegacy(patient, {
      activeAlerts: context.alertsByPatient.get(patientKey) ?? 0,
      latestCheckIn,
      lastCheckIn: latestCheckIn?.actualTime ?? patient.compliance?.lastCheckin ?? null,
      latestVitals: mapLatestVitals(
        context.latestTelemetryByPatient.get(patientKey),
        latestCheckIn,
        flattenThresholds(patient.vitalThresholds)
      ),
      riskStratification,
      transitionSummaries: riskStratification?.transitionSummaries || [],
      checkInStreak,
      devices,
      ...buildScheduleHints(schedule)
    });

    res.json({
      success: true,
      data: payload,
      ...payload
    });
  }
);

router.post(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  async (req, res) => {
    const fallbackChw =
      req.user.role === 'chw'
        ? req.user._id
        : (await User.findOne({ role: 'chw', status: 'active' }).select('_id').lean())?._id;
    const assignedCHW = req.body.assignedCHW || fallbackChw;
    const defaultCaregiver =
      (await User.findOne({ role: 'caregiver', status: 'active' }).select('_id').lean())?._id ??
      req.user._id;
    const carePlan = buildCarePlanPayload(req.body.carePlan, {}, req.body.checkInFrequency);

    const patient = await Patient.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      dateOfBirth: req.body.dateOfBirth,
      gender: String(req.body.gender || '').toLowerCase(),
      phone: req.body.phone,
      nationalId: req.body.nationalId,
      address: {
        village: req.body.address?.street ?? req.body.address?.village ?? '',
        ward: req.body.address?.ward ?? '',
        district: req.body.address?.city ?? req.body.address?.district ?? '',
        province: req.body.address?.province ?? '',
        country: req.body.address?.country ?? 'Zimbabwe',
        coordinates: req.body.address?.coordinates
      },
      medicalSummary: req.body.medicalHistory ?? req.body.primaryDiagnosis ?? '',
      medicalConditions: [
        ...(req.body.primaryDiagnosis
          ? [{ condition: req.body.primaryDiagnosis, status: 'active' }]
          : []),
        ...((req.body.secondaryDiagnoses ?? []).map((diagnosis) => ({
          condition: diagnosis,
          status: 'active'
        })))
      ],
      ncdConditions: normalizeNcdConditions(req.body.ncdConditions),
      allergies: (req.body.allergies ?? []).map((allergy) =>
        typeof allergy === 'string'
          ? { allergen: allergy, severity: 'mild', reaction: '' }
          : allergy
      ),
      currentMedications: (req.body.currentMedications ?? []).map((medication) =>
        typeof medication === 'string'
          ? { name: medication, dosage: '', frequency: '', prescribedBy: '' }
          : medication
      ),
      primaryCaregiver: defaultCaregiver,
      assignedCHW,
      assignedClinician: req.user.role === 'clinician' ? req.user._id : undefined,
      emergencyContacts: req.body.emergencyContact?.name
        ? [
            {
              name: req.body.emergencyContact.name,
              relationship: req.body.emergencyContact.relationship,
              phone: req.body.emergencyContact.phone,
              isPrimary: true
            }
          ]
        : [],
      riskLevel:
        req.body.careLevel === 'palliative'
          ? 'critical'
          : req.body.careLevel === 'intensive'
            ? 'high'
            : req.body.careLevel === 'enhanced'
              ? 'moderate'
              : 'low',
      carePlan,
      functionalBaseline: buildFunctionalBaselinePayload(req.body.functionalBaseline),
      vitalThresholds: buildThresholdPayload(req.body.vitalThresholds),
      consent: {
        dataCollection: carePlan.consentSettings.dataCollection,
        familyAccess: carePlan.consentSettings.familyUpdates,
        emergencyDataSharing: carePlan.consentSettings.emergencySharing
      },
      enrolledBy: req.user._id,
      lastUpdatedBy: req.user._id
    });

    const careWindow = buildCareWindowDays(req.body.checkInFrequency);

    await CareSchedule.create({
      patient: patient._id,
      effectiveDate: new Date(),
      checkinWindows: [
        {
          name: 'morning',
          startTime: '09:00',
          endTime: '10:00',
          required: true,
          days: careWindow,
          assignedCaregiver: defaultCaregiver
        }
      ],
      specialInstructions: req.body.notes
        ? [{ type: 'notes', instruction: req.body.notes, active: true }]
        : [],
      createdBy: req.user._id,
      lastModifiedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      data: patient,
      _id: patient._id
    });
  }
);

router.put(
  '/:id',
  authenticate,
  authorize(['admin', 'chw', 'clinician']),
  async (req, res) => {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (req.body.firstName !== undefined) {
      patient.firstName = req.body.firstName;
    }
    if (req.body.lastName !== undefined) {
      patient.lastName = req.body.lastName;
    }
    if (req.body.dateOfBirth !== undefined) {
      patient.dateOfBirth = req.body.dateOfBirth;
    }
    if (req.body.gender !== undefined) {
      patient.gender = String(req.body.gender).toLowerCase();
    }
    if (req.body.phone !== undefined) {
      patient.phone = req.body.phone;
    }
    if (req.body.nationalId !== undefined) {
      patient.nationalId = req.body.nationalId;
    }
    if (req.body.address) {
      if (req.body.address.street !== undefined || req.body.address.village !== undefined) {
        patient.address.village = req.body.address.street ?? req.body.address.village;
      }
      if (req.body.address.ward !== undefined) {
        patient.address.ward = req.body.address.ward;
      }
      if (req.body.address.city !== undefined || req.body.address.district !== undefined) {
        patient.address.district = req.body.address.city ?? req.body.address.district;
      }
      if (req.body.address.province !== undefined) {
        patient.address.province = req.body.address.province;
      }
      if (req.body.address.country !== undefined) {
        patient.address.country = req.body.address.country;
      }
      if (req.body.address.coordinates !== undefined) {
        patient.address.coordinates = req.body.address.coordinates;
      }
    }
    if (req.body.medicalHistory !== undefined || req.body.primaryDiagnosis !== undefined) {
      patient.medicalSummary = req.body.medicalHistory ?? req.body.primaryDiagnosis ?? '';
    }
    if (req.body.primaryDiagnosis !== undefined || req.body.secondaryDiagnoses !== undefined) {
      patient.medicalConditions = [
        ...(req.body.primaryDiagnosis
          ? [{ condition: req.body.primaryDiagnosis, status: 'active' }]
          : (patient.medicalConditions ?? []).slice(0, 1)),
        ...((req.body.secondaryDiagnoses ?? []).map((diagnosis) => ({
          condition: diagnosis,
          status: 'active'
        })))
      ];
    }
    if (req.body.ncdConditions !== undefined) {
      patient.ncdConditions = normalizeNcdConditions(req.body.ncdConditions);
    }
    if (req.body.allergies !== undefined) {
      patient.allergies = req.body.allergies.map((allergy) =>
        typeof allergy === 'string'
          ? { allergen: allergy, severity: 'mild', reaction: '' }
          : allergy
      );
    }
    if (req.body.currentMedications !== undefined) {
      patient.currentMedications = req.body.currentMedications.map((medication) =>
        typeof medication === 'string'
          ? { name: medication, dosage: '', frequency: '', prescribedBy: '' }
          : medication
      );
    }
    if (req.body.assignedCHW !== undefined) {
      patient.assignedCHW = req.body.assignedCHW;
    }
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
    if (req.body.vitalThresholds !== undefined) {
      patient.vitalThresholds = buildThresholdPayload(
        req.body.vitalThresholds,
        patient.vitalThresholds
      );
    }
    if (req.body.emergencyContact !== undefined) {
      patient.emergencyContacts = req.body.emergencyContact?.name
        ? [
            {
              name: req.body.emergencyContact.name,
              relationship: req.body.emergencyContact.relationship,
              phone: req.body.emergencyContact.phone,
              isPrimary: true
            }
          ]
        : [];
    }
    patient.lastUpdatedBy = req.user._id;
    await patient.save();

    if (req.body.checkInFrequency !== undefined) {
      const schedule = await CareSchedule.findOne({ patient: patient._id }).sort({ updatedAt: -1 });
      if (schedule) {
        const nextDays = buildCareWindowDays(req.body.checkInFrequency);
        if (Array.isArray(schedule.checkinWindows) && schedule.checkinWindows.length > 0) {
          schedule.checkinWindows = schedule.checkinWindows.map((window, index) => {
            const serializedWindow =
              typeof window.toObject === 'function' ? window.toObject() : window;
            return index === 0 ? { ...serializedWindow, days: nextDays } : serializedWindow;
          });
        } else {
          schedule.checkinWindows = [
            {
              name: 'morning',
              startTime: '09:00',
              endTime: '10:00',
              required: true,
              days: nextDays,
              assignedCaregiver: patient.primaryCaregiver
            }
          ];
        }
        schedule.lastModifiedBy = req.user._id;
        await schedule.save();
      }
    }

    res.json({
      success: true,
      message: 'Patient updated successfully',
      data: patient,
      _id: patient._id
    });
  }
);

export default router;

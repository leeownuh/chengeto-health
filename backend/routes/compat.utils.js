import { buildMonitoringSummary } from '../config/elderlyNcdProfiles.js';
import { buildCarePlanResponse } from '../utils/carePlan.js';

export const ACTIVE_ALERT_STATUSES = ['pending', 'acknowledged', 'escalated'];

export function parsePage(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function formatUserName(user) {
  if (!user) {
    return '';
  }

  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

export function summarizeUser(user, fallbackRole = null) {
  if (!user) {
    return null;
  }

  const id = user._id ?? user.id ?? user;

  return {
    _id: id,
    id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: formatUserName(user) || undefined,
    email: user.email,
    phone: user.phone,
    role: user.role ?? fallbackRole
  };
}

export function formatPatientAddress(address = {}) {
  const parts = [
    address.street,
    address.village,
    address.ward,
    address.city,
    address.district,
    address.province,
    address.country
  ].filter(Boolean);

  return parts.join(', ');
}

export function summarizePatient(patient) {
  if (!patient) {
    return null;
  }

  const id = patient._id ?? patient.id ?? patient;

  return {
    _id: id,
    id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    name: [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim(),
    status: patient.status,
    location: patient.address?.coordinates
      ? {
          latitude: patient.address.coordinates.latitude,
          longitude: patient.address.coordinates.longitude
        }
      : null,
    address: formatPatientAddress(patient.address)
  };
}

export function mapRiskToCareLevel(riskLevel) {
  switch (riskLevel) {
    case 'critical':
      return 'palliative';
    case 'high':
      return 'intensive';
    case 'moderate':
      return 'enhanced';
    case 'low':
    default:
      return 'standard';
  }
}

export function flattenThresholds(vitalThresholds = {}) {
  return {
    heartRateMin: vitalThresholds.heartRateMin ?? vitalThresholds.heartRate?.min ?? null,
    heartRateMax: vitalThresholds.heartRateMax ?? vitalThresholds.heartRate?.max ?? null,
    systolicMin:
      vitalThresholds.systolicMin ?? vitalThresholds.bloodPressure?.systolicMin ?? null,
    systolicMax:
      vitalThresholds.systolicMax ?? vitalThresholds.bloodPressure?.systolicMax ?? null,
    diastolicMin:
      vitalThresholds.diastolicMin ?? vitalThresholds.bloodPressure?.diastolicMin ?? null,
    diastolicMax:
      vitalThresholds.diastolicMax ?? vitalThresholds.bloodPressure?.diastolicMax ?? null,
    temperatureMin: vitalThresholds.temperatureMin ?? vitalThresholds.temperature?.min ?? null,
    temperatureMax: vitalThresholds.temperatureMax ?? vitalThresholds.temperature?.max ?? null,
    spo2Min: vitalThresholds.spo2Min ?? vitalThresholds.oxygenSaturation?.min ?? null,
    spo2Max: vitalThresholds.spo2Max ?? 100,
    respiratoryRateMin:
      vitalThresholds.respiratoryRateMin ?? vitalThresholds.respiratoryRate?.min ?? null,
    respiratoryRateMax:
      vitalThresholds.respiratoryRateMax ?? vitalThresholds.respiratoryRate?.max ?? null,
    bloodGlucoseMin:
      vitalThresholds.bloodGlucoseMin ?? vitalThresholds.bloodGlucose?.min ?? null,
    bloodGlucoseMax:
      vitalThresholds.bloodGlucoseMax ?? vitalThresholds.bloodGlucose?.max ?? null,
    weightMin: vitalThresholds.weightMin ?? vitalThresholds.weight?.min ?? null,
    weightMax: vitalThresholds.weightMax ?? vitalThresholds.weight?.max ?? null
  };
}

function getVitalStatus(value, min, max, existingStatus) {
  if (existingStatus === 'critical' || existingStatus === 'abnormal') {
    return 'critical';
  }

  if (!Number.isFinite(value)) {
    return 'normal';
  }

  if (Number.isFinite(min) && value < min) {
    return 'critical';
  }

  if (Number.isFinite(max) && value > max) {
    return 'critical';
  }

  return 'normal';
}

export function mapLatestVitals(telemetry, checkIn, thresholds = {}) {
  const heartRate = telemetry?.heartRate?.value ?? checkIn?.vitals?.heartRate?.value ?? null;
  const systolic =
    telemetry?.bloodPressure?.systolic?.value ?? checkIn?.vitals?.bloodPressure?.systolic ?? null;
  const diastolic =
    telemetry?.bloodPressure?.diastolic?.value ?? checkIn?.vitals?.bloodPressure?.diastolic ?? null;
  const temperature = telemetry?.temperature?.value ?? checkIn?.vitals?.temperature?.value ?? null;
  const spo2 =
    telemetry?.oxygenSaturation?.value ?? checkIn?.vitals?.oxygenSaturation?.value ?? null;
  const respiratoryRate =
    telemetry?.respiratoryRate?.value ?? checkIn?.vitals?.respiratoryRate?.value ?? null;
  const bloodGlucose =
    telemetry?.bloodGlucose?.value ?? checkIn?.vitals?.bloodGlucose?.value ?? null;
  const weight = telemetry?.weight?.value ?? checkIn?.vitals?.weight?.value ?? null;
  const rhythmIrregularity =
    telemetry?.cardiacRhythm?.irregular ?? checkIn?.vitals?.cardiacRhythm?.irregular ?? null;

  return {
    heartRate,
    heartRateStatus: getVitalStatus(
      heartRate,
      thresholds.heartRateMin,
      thresholds.heartRateMax,
      telemetry?.heartRate?.status
    ),
    bloodPressure:
      Number.isFinite(systolic) || Number.isFinite(diastolic)
        ? `${systolic ?? '--'}/${diastolic ?? '--'}`
        : null,
    bpStatus:
      telemetry?.bloodPressure?.systolic?.status === 'critical' ||
      telemetry?.bloodPressure?.diastolic?.status === 'critical' ||
      checkIn?.vitals?.bloodPressure?.abnormal
        ? 'critical'
        : 'normal',
    temperature,
    tempStatus: getVitalStatus(
      temperature,
      thresholds.temperatureMin,
      thresholds.temperatureMax,
      telemetry?.temperature?.status
    ),
    spo2,
    spo2Status: getVitalStatus(
      spo2,
      thresholds.spo2Min,
      thresholds.spo2Max,
      telemetry?.oxygenSaturation?.status
    ),
    respiratoryRate,
    respiratoryRateStatus: getVitalStatus(
      respiratoryRate,
      thresholds.respiratoryRateMin,
      thresholds.respiratoryRateMax,
      telemetry?.respiratoryRate?.status
    ),
    bloodGlucose,
    bloodGlucoseStatus: getVitalStatus(
      bloodGlucose,
      thresholds.bloodGlucoseMin,
      thresholds.bloodGlucoseMax,
      telemetry?.bloodGlucose?.status
    ),
    weight,
    weightStatus: getVitalStatus(
      weight,
      thresholds.weightMin,
      thresholds.weightMax,
      telemetry?.weight?.status
    ),
    rhythmIrregularity
  };
}

export function calculateWellnessScore(checkIn) {
  const status = checkIn?.wellness?.overallStatus;

  switch (status) {
    case 'good':
      return 90;
    case 'fair':
      return 72;
    case 'poor':
      return 45;
    case 'critical':
      return 20;
    default:
      return 75;
  }
}

export function mapVerificationMethod(method) {
  switch (method) {
    case 'ble':
      return 'BLE';
    case 'nfc':
      return 'NFC';
    case 'gps':
      return 'GPS';
    default:
      return 'MANUAL';
  }
}

export function mapCheckInLegacy(checkIn) {
  const timestamp = checkIn.actualTime ?? checkIn.createdAt ?? checkIn.scheduledTime ?? null;

  return {
    _id: checkIn._id,
    id: checkIn._id,
    checkinId: checkIn.checkinId,
    status: checkIn.status,
    timestamp,
    patient: checkIn.patient
      ? {
          _id: checkIn.patient._id,
          id: checkIn.patient._id,
          patientId: checkIn.patient.patientId,
          name: [checkIn.patient.firstName, checkIn.patient.lastName].filter(Boolean).join(' ').trim()
        }
      : null,
    caregiver: checkIn.caregiver
      ? {
          _id: checkIn.caregiver._id,
          id: checkIn.caregiver._id,
          name: formatUserName(checkIn.caregiver),
          role: checkIn.caregiver.role
        }
      : null,
    verificationMethod: mapVerificationMethod(
      checkIn.proximityVerification?.method ?? checkIn.verificationMethod
    ),
    location: checkIn.proximityVerification?.gpsCoordinates ?? null,
    vitals: {
      heartRate: checkIn.vitals?.heartRate?.value ?? null,
      bloodPressure:
        checkIn.vitals?.bloodPressure?.systolic || checkIn.vitals?.bloodPressure?.diastolic
          ? {
              systolic: checkIn.vitals?.bloodPressure?.systolic ?? null,
              diastolic: checkIn.vitals?.bloodPressure?.diastolic ?? null
            }
          : null,
      temperature: checkIn.vitals?.temperature?.value ?? null,
      oxygenSaturation: checkIn.vitals?.oxygenSaturation?.value ?? null,
      respiratoryRate: checkIn.vitals?.respiratoryRate?.value ?? null,
      bloodGlucose: checkIn.vitals?.bloodGlucose?.value ?? null,
      weight: checkIn.vitals?.weight?.value ?? null,
      cardiacRhythm: checkIn.vitals?.cardiacRhythm?.irregular ?? null
    },
    wellnessAssessment: {
      overallScore: calculateWellnessScore(checkIn),
      notes: checkIn.notes?.caregiver ?? ''
    },
    medicationsAdministered:
      checkIn.medication?.medications?.filter((medication) => medication.taken).map((medication) => medication.name) ??
      [],
    blockchainHash: checkIn.blockchainRecord?.transactionHash ?? null,
    notes: checkIn.notes?.caregiver ?? ''
  };
}

export function normalizePatientLegacy(patient, extras = {}) {
  const thresholds = flattenThresholds(patient.vitalThresholds);
  const conditions = patient.medicalConditions?.map((condition) => condition.condition).filter(Boolean) ?? [];
  const ncdConditions =
    patient.ncdConditions
      ?.map((condition) => (typeof condition === 'string' ? condition : condition?.type))
      .filter(Boolean) ?? [];
  const monitoringSummary = buildMonitoringSummary(ncdConditions);
  const allergies =
    patient.allergies?.map((allergy) => allergy?.allergen ?? allergy).filter(Boolean) ?? [];
  const medications =
    patient.currentMedications
      ?.map((medication) =>
        typeof medication === 'string'
          ? medication
          : {
              name: medication.name,
              dosage: medication.dosage,
              frequency: medication.frequency,
              status: 'active'
            }
      )
      .filter(Boolean) ?? [];
  const emergencyContact = patient.emergencyContacts?.[0] ?? null;
  const familyMembers =
    patient.familyMembers
      ?.map((member) => ({
        ...summarizeUser(member.user, 'family'),
        relationship: member.relationship,
        accessLevel: member.accessLevel
      }))
      .filter(Boolean) ?? [];
  const careTeam = [
    summarizeUser(patient.primaryCaregiver, 'caregiver'),
    summarizeUser(patient.assignedCHW, 'chw'),
    summarizeUser(patient.assignedClinician, 'clinician')
  ].filter(Boolean);
  const baselineMobility = patient.functionalBaseline?.mobility;
  const computedRisk = extras.riskStratification ?? null;
  const transitionSummaries = extras.transitionSummaries ?? [];

  return {
    _id: patient._id,
    id: patient._id,
    patientId: patient.patientId,
    medicalId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    fullName: [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim(),
    dateOfBirth: patient.dateOfBirth,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    email: patient.email,
    nationalId: patient.nationalId,
    status: patient.status,
    riskLevel: computedRisk?.level ?? patient.riskLevel,
    careLevel: mapRiskToCareLevel(computedRisk?.level ?? patient.riskLevel),
    bloodType: patient.bloodType,
    address: {
      ...patient.address,
      street: patient.address?.street ?? patient.address?.village ?? '',
      city: patient.address?.city ?? patient.address?.district ?? '',
      formatted: formatPatientAddress(patient.address)
    },
    primaryDiagnosis: conditions[0] ?? patient.medicalSummary ?? '',
    secondaryDiagnoses: conditions.slice(1),
    conditions,
    ncdConditions,
    ncdConditionLabels: monitoringSummary.conditionLabels,
    medicalHistory: patient.medicalSummary ?? '',
    mobilityStatus:
      extras.latestCheckIn?.wellness?.mobility === 'needs_assistance'
        ? 'assisted'
        : extras.latestCheckIn?.wellness?.mobility === 'bedridden'
          ? 'bedbound'
          : extras.latestCheckIn?.wellness?.mobility ?? baselineMobility ?? 'independent',
    functionalBaseline: patient.functionalBaseline ?? {},
    allergies,
    currentMedications: medications,
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name,
          relationship: emergencyContact.relationship,
          phone: emergencyContact.phone,
          email: emergencyContact.email
        }
      : { name: '', relationship: '', phone: '', email: '' },
    assignedCHW: summarizeUser(patient.assignedCHW, 'chw'),
    assignedCHWId: patient.assignedCHW?._id ?? patient.assignedCHW ?? '',
    primaryCaregiver: summarizeUser(patient.primaryCaregiver, 'caregiver'),
    assignedClinician: summarizeUser(patient.assignedClinician, 'clinician'),
    careTeam,
    carePlan: buildCarePlanResponse(patient),
    riskStratification: computedRisk,
    riskScore: computedRisk?.score ?? null,
    whyHighRisk: computedRisk?.summary ?? '',
    transitionSummaries,
    activeTransitions: transitionSummaries.length,
    familyMembers,
    activeAlerts: extras.activeAlerts ?? 0,
    adherenceScore: patient.compliance?.checkinAdherence ?? 0,
    lastCheckIn: extras.lastCheckIn ?? patient.compliance?.lastCheckin ?? null,
    checkInStreak: extras.checkInStreak ?? 0,
    vitals: extras.latestVitals ?? null,
    vitalThresholds: thresholds,
    monitoringSummary,
    iotDevice: patient.iotDevice,
    devices: extras.devices ?? [],
    nextAppointment: extras.nextAppointment ?? null,
    nextCheckIn: extras.nextCheckIn ?? null
  };
}

export function buildPatientAccessMatch(user) {
  if (!user) {
    return { _id: null };
  }

  if (['admin', 'clinician', 'auditor'].includes(user.role)) {
    return {};
  }

  if (user.role === 'caregiver') {
    const ors = [
      { primaryCaregiver: user._id },
      { 'backupCaregivers.caregiver': user._id }
    ];

    if (Array.isArray(user.assignedPatients) && user.assignedPatients.length > 0) {
      ors.push({ _id: { $in: user.assignedPatients } });
    }

    return { $or: ors };
  }

  if (user.role === 'chw') {
    const ors = [{ assignedCHW: user._id }];

    if (Array.isArray(user.assignedPatients) && user.assignedPatients.length > 0) {
      ors.push({ _id: { $in: user.assignedPatients } });
    }

    return { $or: ors };
  }

  if (user.role === 'family') {
    return { 'familyMembers.user': user._id };
  }

  return { _id: null };
}

export function normalizeAlertStatus(status) {
  return status === 'pending' ? 'active' : status;
}

export function legacyStatusesToDb(statusValues = []) {
  return statusValues.flatMap((statusValue) =>
    statusValue === 'active' ? ['pending'] : [statusValue]
  );
}

export function normalizeAlertType(type) {
  switch (type) {
    case 'vital_sign':
      return 'vital';
    case 'fall_detected':
      return 'fall';
    case 'medication_missed':
      return 'medication';
    default:
      return type;
  }
}

export function legacyAlertTypesToDb(typeValues = []) {
  return typeValues.flatMap((typeValue) => {
    switch (typeValue) {
      case 'vital':
        return ['vital_sign'];
      case 'fall':
        return ['fall_detected'];
      case 'medication':
        return ['medication_missed'];
      default:
        return [typeValue];
    }
  });
}

export function mapAlertLegacy(alert) {
  const lastAcknowledgement = alert.acknowledgements?.[alert.acknowledgements.length - 1];
  const blockchain = alert.blockchainRecord || null;

  return {
    _id: alert._id,
    id: alert._id,
    alertId: alert.alertId,
    type: normalizeAlertType(alert.type),
    severity: alert.severity,
    status: normalizeAlertStatus(alert.status),
    title: alert.title,
    message: alert.message,
    description: alert.message,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    patient: summarizePatient(alert.patient),
    escalationLevel: alert.escalation?.currentLevel ?? 0,
    acknowledgedAt: lastAcknowledgement?.acknowledgedAt ?? null,
    acknowledgedBy: lastAcknowledgement?.acknowledgedBy
      ? summarizeUser(lastAcknowledgement.acknowledgedBy)
      : null,
    resolvedAt: alert.resolution?.resolvedAt ?? null,
    resolvedBy: alert.resolution?.resolvedBy ? summarizeUser(alert.resolution.resolvedBy) : null,
    location: alert.location ?? null,
    vitalSnapshot: alert.vitalSnapshot ?? null,
    blockchainRecord: blockchain
      ? {
          transactionHash: blockchain.transactionHash,
          blockNumber: blockchain.blockNumber,
          timestamp: blockchain.recordedAt || blockchain.timestamp || null,
          dataHash: blockchain.dataHash || null
        }
      : null,
    notesCount: alert.auditLog?.filter((entry) => entry.action === 'note_added').length ?? 0
  };
}

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Alert from '../models/Alert.js';
import CheckIn from '../models/CheckIn.js';
import IoTTelemetry from '../models/IoTTelemetry.js';
import CareSchedule from '../models/CareSchedule.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';
import IoTDevice from '../models/IoTDevice.js';
import CareTransition from '../models/CareTransition.js';
import { buildDefaultTransitionCheckpoints, buildTransitionTaskPayload } from '../utils/careTransition.js';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123456';
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://admin:chengeto_secure_2024@127.0.0.1:27017/chengeto_health?authSource=admin';

const oid = () => new mongoose.Types.ObjectId();
const now = new Date();
const daysAgo = (days) => new Date(Date.now() - days * 86400000);
const hoursAgo = (hours) => new Date(Date.now() - hours * 3600000);
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000);
const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60000);

const rolePermissions = {
  admin: ['read:patients', 'write:patients', 'delete:patients', 'read:alerts', 'write:alerts', 'acknowledge:alerts', 'escalate:alerts', 'read:checkins', 'write:checkins', 'verify:checkins', 'read:devices', 'write:devices', 'provision:devices', 'read:audit', 'export:audit', 'manage:users', 'manage:schedules', 'manage:system', 'access:admin', 'access:reports'],
  chw: ['read:patients', 'write:patients', 'read:alerts', 'acknowledge:alerts', 'escalate:alerts', 'read:checkins', 'write:checkins', 'verify:checkins', 'read:devices', 'access:reports'],
  caregiver: ['read:patients', 'read:alerts', 'acknowledge:alerts', 'read:checkins', 'write:checkins', 'read:devices'],
  clinician: ['read:patients', 'write:patients', 'read:alerts', 'acknowledge:alerts', 'escalate:alerts', 'read:checkins', 'read:devices', 'access:reports'],
  family: ['read:alerts', 'read:checkins'],
  auditor: ['read:patients', 'read:alerts', 'read:checkins', 'read:devices', 'read:audit', 'export:audit']
};

function buildAuditLog(logId, action, category, actor, target, details, timestamp) {
  return {
    _id: oid(),
    logId,
    timestamp,
    action,
    category,
    result: AUDIT_RESULT.SUCCESS,
    actor,
    target,
    request: {
      method: 'SEED',
      endpoint: '/scripts/seedDatabase.js',
      ipAddress: '127.0.0.1',
      userAgent: 'CHENGETO demo seed'
    },
    details
  };
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  await Promise.all([
    Alert.deleteMany({}),
    CheckIn.deleteMany({}),
    IoTTelemetry.deleteMany({}),
    CareSchedule.deleteMany({}),
    CareTransition.deleteMany({}),
    AuditLog.collection.deleteMany({}),
    IoTDevice.deleteMany({}),
    Patient.deleteMany({}),
    User.deleteMany({})
  ]);

  const ids = {
    admin: oid(),
    chw: oid(),
    caregiver: oid(),
    clinician: oid(),
    family: oid(),
    auditor: oid(),
    patients: [oid(), oid(), oid()],
    devices: [oid(), oid(), oid()],
    alerts: [oid(), oid(), oid()],
    checkins: [oid(), oid(), oid(), oid()],
    schedules: [oid(), oid(), oid()],
    transitions: [oid()]
  };

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
  const actor = (id, email, role) => ({ userId: id, email, role });

  const users = [
    { _id: ids.admin, email: 'admin@chengeto.health', password: hashedPassword, firstName: 'System', lastName: 'Administrator', phone: '+263771000001', role: 'admin', permissions: rolePermissions.admin, status: 'active', emailVerified: true, phoneVerified: true, mfaEnabled: false, loginAttempts: 0, assignedPatients: [], lastLogin: { timestamp: hoursAgo(4), ipAddress: '127.0.0.1', userAgent: 'Demo seed' }, createdAt: daysAgo(30), updatedAt: now },
    { _id: ids.chw, email: 'chw1@chengeto.health', password: hashedPassword, firstName: 'Nyasha', lastName: 'Mukamuri', phone: '+263771000011', role: 'chw', permissions: rolePermissions.chw, status: 'active', emailVerified: true, phoneVerified: true, mfaEnabled: false, loginAttempts: 0, assignedPatients: ids.patients, ward: 'Ward 16', district: 'Harare', lastLogin: { timestamp: hoursAgo(6), ipAddress: '127.0.0.1', userAgent: 'Demo seed' }, createdAt: daysAgo(28), updatedAt: now },
    { _id: ids.caregiver, email: 'caregiver1@example.com', password: hashedPassword, firstName: 'Tariro', lastName: 'Moyo', phone: '+263771000021', role: 'caregiver', permissions: rolePermissions.caregiver, status: 'active', emailVerified: true, phoneVerified: true, mfaEnabled: false, loginAttempts: 0, assignedPatients: ids.patients, isPrimaryCaregiver: true, specializations: ['Medication adherence', 'Home visits'], lastLogin: { timestamp: hoursAgo(3), ipAddress: '127.0.0.1', userAgent: 'Demo seed' }, createdAt: daysAgo(21), updatedAt: now },
    { _id: ids.clinician, email: 'clinician1@chengeto.health', password: hashedPassword, firstName: 'Dr. Farai', lastName: 'Mlambo', phone: '+263771000031', role: 'clinician', permissions: rolePermissions.clinician, status: 'active', emailVerified: true, phoneVerified: true, mfaEnabled: false, loginAttempts: 0, specializations: ['Geriatrics'], lastLogin: { timestamp: hoursAgo(8), ipAddress: '127.0.0.1', userAgent: 'Demo seed' }, createdAt: daysAgo(35), updatedAt: now },
    { _id: ids.family, email: 'family1@example.com', password: hashedPassword, firstName: 'Kudzai', lastName: 'Moyo', phone: '+263771000041', role: 'family', permissions: rolePermissions.family, status: 'active', emailVerified: true, phoneVerified: true, mfaEnabled: false, loginAttempts: 0, linkedPatients: ids.patients.map((patient) => ({ patient, relationship: 'child', accessLevel: 'full' })), lastLogin: { timestamp: daysAgo(2), ipAddress: '127.0.0.1', userAgent: 'Demo seed' }, createdAt: daysAgo(18), updatedAt: now },
    { _id: ids.auditor, email: 'auditor@chengeto.health', password: hashedPassword, firstName: 'Audit', lastName: 'Officer', phone: '+263771000051', role: 'auditor', permissions: rolePermissions.auditor, status: 'active', emailVerified: true, phoneVerified: true, mfaEnabled: false, loginAttempts: 0, lastLogin: { timestamp: daysAgo(5), ipAddress: '127.0.0.1', userAgent: 'Demo seed' }, createdAt: daysAgo(40), updatedAt: now }
  ];

  const patientConfigs = [
    { _id: ids.patients[0], patientId: 'CHG-2026-00001', firstName: 'Chengetai', lastName: 'Moyo', gender: 'female', dob: new Date('1948-06-12T00:00:00Z'), phone: '+263771100001', district: 'Borrowdale', province: 'Harare', coords: { latitude: -17.788, longitude: 31.053 }, riskLevel: 'high', summary: 'Blood pressure and glucose monitoring required.', battery: 84, heartRate: 78, oxygen: 97, systolic: 134, diastolic: 84, temperature: 36.8, condition: 'Hypertension', medication: 'Amlodipine', functionalBaseline: { mobility: 'assisted', gait: 'slow', balance: 'needs_support', assistiveDevice: 'cane', vision: 'adequate', hearing: 'adequate', continence: 'occasional_issues', weightLossRisk: 'low', frailty: 'pre_frail', homeSafety: 'needs_minor_changes', recentFalls: { count: 1, lastFallAt: daysAgo(42), injuryFromLastFall: false }, notes: 'Needs supervision outdoors.' } },
    { _id: ids.patients[1], patientId: 'CHG-2026-00002', firstName: 'Tendai', lastName: 'Ndlovu', gender: 'male', dob: new Date('1951-11-03T00:00:00Z'), phone: '+263771100002', district: 'Hillside', province: 'Bulawayo', coords: { latitude: -20.149, longitude: 28.596 }, riskLevel: 'moderate', summary: 'Respiratory support and mobility assistance.', battery: 68, heartRate: 83, oxygen: 92, systolic: 138, diastolic: 86, temperature: 36.9, condition: 'COPD', medication: 'Salbutamol Inhaler', functionalBaseline: { mobility: 'assisted', gait: 'unsteady', balance: 'needs_support', assistiveDevice: 'walker', vision: 'impaired', hearing: 'adequate', continence: 'occasional_issues', weightLossRisk: 'moderate', frailty: 'frail', homeSafety: 'needs_minor_changes', recentFalls: { count: 2, lastFallAt: daysAgo(18), injuryFromLastFall: false }, notes: 'Needs escort when fatigued.' } },
    { _id: ids.patients[2], patientId: 'CHG-2026-00003', firstName: 'Rutendo', lastName: 'Chiwenga', gender: 'female', dob: new Date('1944-01-27T00:00:00Z'), phone: '+263771100003', district: 'Murambi', province: 'Manicaland', coords: { latitude: -18.970, longitude: 32.670 }, riskLevel: 'critical', summary: 'Post-stroke recovery with elevated vitals follow-up.', battery: 39, heartRate: 124, oxygen: 89, systolic: 158, diastolic: 96, temperature: 37.9, condition: 'Stroke Recovery', medication: 'Metoprolol', functionalBaseline: { mobility: 'wheelchair', gait: 'shuffling', balance: 'unstable', assistiveDevice: 'wheelchair', vision: 'adequate', hearing: 'impaired', continence: 'occasional_issues', weightLossRisk: 'high', frailty: 'frail', homeSafety: 'unsafe', recentFalls: { count: 3, lastFallAt: daysAgo(10), injuryFromLastFall: true }, notes: 'Two-person assist for transfers.' } }
  ];

  const patients = patientConfigs.map((patient, index) => ({
    _id: patient._id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dob,
    gender: patient.gender,
    phone: patient.phone,
    address: { village: patient.district, ward: `Ward ${index + 4}`, district: patient.district, province: patient.province, country: 'Zimbabwe', coordinates: patient.coords },
    medicalSummary: patient.summary,
    medicalConditions: [{ condition: patient.condition, diagnosedDate: new Date('2022-01-01T00:00:00Z'), status: 'active' }],
    allergies: [{ allergen: 'None known', severity: 'mild', reaction: 'No recorded allergy' }],
    currentMedications: [
      {
        name: patient.medication,
        dosage: index === 1 ? '2 puffs' : index === 2 ? '25mg' : '5mg',
        unit: index === 1 ? 'puffs' : 'mg',
        frequency: index === 2 ? 'Twice daily' : 'Daily',
        startDate: new Date('2023-01-01T00:00:00Z'),
        prescribedBy: 'Dr. Mlambo',
        refillDueDate: daysAgo(-14 + index * 3),
        refillWindowDays: index === 2 ? 5 : 7,
        adherenceRule: index === 1 ? 'as_needed' : 'required',
        sideEffectPrompts: index === 2
          ? ['Dizziness', 'Fatigue', 'Slow heartbeat']
          : index === 0
            ? ['Swollen ankles', 'Headache']
            : ['Wheezing', 'Palpitations'],
        confirmationSource: index === 1 ? 'patient' : 'caregiver'
      }
    ],
    primaryCaregiver: ids.caregiver,
    assignedCHW: ids.chw,
    assignedClinician: ids.clinician,
    emergencyContacts: [{ name: `${patient.firstName} Family`, relationship: 'child', phone: '+263772200001', isPrimary: true, priority: 1 }],
    familyMembers: [{ user: ids.family, relationship: 'child', accessLevel: 'full', approvedAt: daysAgo(15) }],
    iotDevice: { deviceId: `PM-${String(index + 1).padStart(3, '0')}`, paired: true, pairedAt: daysAgo(12), lastSeen: minutesAgo(index === 0 ? 2 : index === 1 ? 6 : 18), firmwareVersion: '1.4.2', batteryLevel: patient.battery, status: patient.battery < 45 ? 'maintenance' : 'online' },
    status: 'active',
    riskLevel: patient.riskLevel,
    functionalBaseline: patient.functionalBaseline,
    compliance: { checkinAdherence: 92 - index * 4, medicationAdherence: 94 - index * 3, missedCheckins: index === 2 ? 1 : 0, lastCheckin: hoursAgo(index + 3), consecutiveMissedCheckins: 0 },
    consent: { dataCollection: true, familyAccess: true, emergencyDataSharing: true, consentDate: daysAgo(20), consentedBy: `${patient.firstName} ${patient.lastName}`, consentVersion: '1.0' },
    enrolledBy: ids.admin,
    enrolledAt: daysAgo(20 - index),
    lastUpdatedBy: ids.chw,
    createdAt: daysAgo(20 - index),
    updatedAt: now
  }));

  const devices = patientConfigs.map((patient, index) => ({
    _id: ids.devices[index],
    deviceId: `PM-${String(index + 1).padStart(3, '0')}`,
    serialNumber: `CHG-PM-${202600 + index + 1}`,
    deviceType: 'patient_monitor',
    type: 'patient_monitor',
    patient: patient._id,
    assignedPatient: patient._id,
    assignedCaregiver: ids.caregiver,
    owner: ids.caregiver,
    status: patient.battery < 45 ? 'maintenance' : 'active',
    capabilities: ['heart_rate', 'motion', 'fall_detection', 'location', 'panic_button', 'ble', 'nfc'],
    network: { bleAddress: `BLE-${index + 1}`, nfcId: `NFC-${index + 1}`, supportedProtocols: ['mqtt', 'ble', 'nfc'] },
    connection: { online: patient.battery >= 45, lastOnline: minutesAgo(index === 0 ? 2 : index === 1 ? 6 : 18), connectionType: 'cellular', signalStrength: -60 - index * 4, mqttClientId: `device-${index + 1}` },
    power: { batteryLevel: patient.battery, batteryStatus: patient.battery < 45 ? 'low' : 'discharging', lastCharged: daysAgo(1), estimatedBatteryLife: patient.battery < 45 ? 5 : 24 },
    provisionedBy: ids.admin,
    provisionedAt: daysAgo(18),
    activatedAt: daysAgo(17),
    createdAt: daysAgo(18),
    updatedAt: now
  }));

  const telemetry = patientConfigs.flatMap((patient, index) => [120, 60, 15].map((offset, sampleIndex) => ({
    _id: oid(),
    deviceId: devices[index].deviceId,
    patient: patient._id,
    timestamp: minutesAgo(offset),
    heartRate: { value: sampleIndex === 2 ? patient.heartRate : patient.heartRate - 4, unit: 'bpm', status: sampleIndex === 2 && index === 2 ? 'abnormal' : 'normal', confidence: 94, source: 'ppg' },
    bloodPressure: { systolic: { value: sampleIndex === 2 ? patient.systolic : patient.systolic - 6, status: sampleIndex === 2 && index === 2 ? 'abnormal' : 'normal' }, diastolic: { value: sampleIndex === 2 ? patient.diastolic : patient.diastolic - 4, status: sampleIndex === 2 && index === 2 ? 'abnormal' : 'normal' }, unit: 'mmHg', measuredAt: minutesAgo(offset) },
    oxygenSaturation: { value: sampleIndex === 2 ? patient.oxygen : patient.oxygen + (index === 2 ? 1 : 0), unit: '%', status: sampleIndex === 2 && patient.oxygen < 90 ? 'critical' : 'normal' },
    temperature: { value: sampleIndex === 2 ? patient.temperature : patient.temperature - 0.2, unit: 'C', location: 'wrist', status: sampleIndex === 2 && index === 2 ? 'abnormal' : 'normal' },
    motion: { detected: true, type: sampleIndex === 0 ? 'walking' : sampleIndex === 1 ? 'sitting' : 'lying', intensity: sampleIndex === 0 ? 'medium' : 'low', duration: 120, accelerometer: { x: 0.2, y: 0.3, z: 0.7 }, gyroscope: { x: 0.1, y: 0.1, z: 0.2 } },
    fall: { detected: index === 1 && sampleIndex === 1, confidence: index === 1 && sampleIndex === 1 ? 84 : 0, impactForce: index === 1 && sampleIndex === 1 ? 2.5 : 0, fallType: index === 1 && sampleIndex === 1 ? 'lateral' : 'unknown', recoveryDetected: true },
    inactivity: { duration: sampleIndex === 2 ? 70 : 10, lastMotionTime: minutesAgo(offset + 5), threshold: 240, alertTriggered: false },
    activity: { steps: 1200 + sampleIndex * 400, distance: 700 + sampleIndex * 150, calories: 120 + sampleIndex * 20, activeMinutes: 20 + sampleIndex * 5, sedentaryMinutes: 30 },
    deviceStatus: { batteryLevel: patient.battery - sampleIndex, charging: false, signalStrength: -62, firmwareVersion: '1.4.2', lastSync: minutesAgo(offset - 1), status: patient.battery < 45 ? 'low_battery' : 'online', errors: [] },
    location: { latitude: patient.coords.latitude, longitude: patient.coords.longitude, accuracy: 8, indoor: true, zone: 'home' },
    processed: true,
    processedAt: minutesAgo(offset - 1),
    alertGenerated: sampleIndex === 2 && index === 2,
    createdAt: minutesAgo(offset),
    updatedAt: minutesAgo(offset)
  })));

  const checkins = [
    { _id: ids.checkins[0], checkinId: 'CHK-20260402-0001', patient: ids.patients[0], caregiver: ids.caregiver, verificationMethod: 'nfc', type: 'scheduled', scheduledTime: hoursAgo(6), actualTime: hoursAgo(5.5), status: 'completed', proximityVerification: { method: 'nfc', verified: true, verifiedAt: hoursAgo(5.5), deviceIds: ['NFC-1'], distance: 0.3 }, wellness: { overallStatus: 'good', mobility: 'normal', mood: 'happy', appearance: 'normal', consciousness: 'alert', pain: { present: false, level: 0 } }, functionalStatus: { changedSinceLastVisit: false, mobility: 'assisted', gait: 'slow', balance: 'needs_support', assistiveDevice: 'cane', frailty: 'pre_frail', walkingDifficulty: 'mild', visionConcern: false, hearingConcern: false, continenceConcern: false, confusionChange: false, appetiteConcern: false, weightConcern: false, homeSafetyConcern: false, recentFall: false, nearFall: false, fallInjury: false, fearOfFalling: true, frailtySigns: ['slower walking'], caregiverObservations: [] }, vitals: { heartRate: { value: 78, abnormal: false }, bloodPressure: { systolic: 134, diastolic: 84, abnormal: false }, temperature: { value: 36.8, abnormal: false }, oxygenSaturation: { value: 97, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Routine visit completed.', concerns: [], highlights: ['Medication taken'] }, duration: 20, createdAt: hoursAgo(5.5), updatedAt: hoursAgo(5.5) },
    { _id: ids.checkins[1], checkinId: 'CHK-20260402-0002', patient: ids.patients[1], caregiver: ids.caregiver, verificationMethod: 'ble', type: 'scheduled', scheduledTime: hoursAgo(18), actualTime: hoursAgo(17.4), status: 'completed', proximityVerification: { method: 'ble', verified: true, verifiedAt: hoursAgo(17.4), deviceIds: ['BLE-2'], signalStrength: -58, distance: 0.9 }, wellness: { overallStatus: 'fair', mobility: 'limited', mood: 'neutral', appearance: 'normal', consciousness: 'alert', pain: { present: true, level: 3 } }, functionalStatus: { changedSinceLastVisit: true, changeNotes: 'Needs more support when walking from bed to chair.', mobility: 'assisted', gait: 'unsteady', balance: 'needs_support', assistiveDevice: 'walker', frailty: 'frail', walkingDifficulty: 'moderate', visionConcern: false, hearingConcern: false, continenceConcern: true, confusionChange: false, appetiteConcern: false, weightConcern: true, homeSafetyConcern: true, recentFall: false, nearFall: true, fallInjury: false, fearOfFalling: true, frailtySigns: ['fatigue', 'slower walking'], caregiverObservations: ['Needs escort after inhaler use'] }, vitals: { heartRate: { value: 83, abnormal: false }, bloodPressure: { systolic: 138, diastolic: 86, abnormal: false }, oxygenSaturation: { value: 92, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Breathing stable after inhaler.', concerns: ['Monitor overnight'], highlights: [] }, duration: 25, createdAt: hoursAgo(17.4), updatedAt: hoursAgo(17.4) },
    { _id: ids.checkins[2], checkinId: 'CHK-20260402-0003', patient: ids.patients[2], caregiver: ids.caregiver, verificationMethod: 'manual_override', type: 'follow_up', scheduledTime: hoursAgo(4), actualTime: hoursAgo(3.1), status: 'completed', proximityVerification: { method: 'manual_override', verified: true, verifiedAt: hoursAgo(3.1), gpsCoordinates: { latitude: -18.97, longitude: 32.67, accuracy: 7 } }, wellness: { overallStatus: 'poor', mobility: 'needs_assistance', mood: 'anxious', appearance: 'concerning', consciousness: 'alert', pain: { present: true, level: 5 } }, functionalStatus: { changedSinceLastVisit: true, changeNotes: 'Caregiver reports weaker transfers and a recent fall from bed to chair.', mobility: 'wheelchair', gait: 'unsteady', balance: 'unstable', assistiveDevice: 'wheelchair', frailty: 'frail', walkingDifficulty: 'severe', visionConcern: false, hearingConcern: true, continenceConcern: true, confusionChange: true, appetiteConcern: true, weightConcern: true, homeSafetyConcern: true, recentFall: true, nearFall: true, fallInjury: true, fearOfFalling: true, frailtySigns: ['weak transfers', 'weight loss', 'fatigue'], caregiverObservations: ['Requires two-person transfer support'] }, vitals: { heartRate: { value: 124, abnormal: true }, bloodPressure: { systolic: 158, diastolic: 96, abnormal: true }, temperature: { value: 37.9, abnormal: true }, oxygenSaturation: { value: 89, abnormal: true } }, medication: { adherence: 'partial' }, notes: { caregiver: 'Escalated for clinician review.', concerns: ['Oxygen saturation low'], highlights: [] }, duration: 34, followUp: { required: true, reason: 'Urgent review', scheduledFor: minutesFromNow(90), priority: 'urgent' }, createdAt: hoursAgo(3.1), updatedAt: hoursAgo(3.1) },
    { _id: ids.checkins[3], checkinId: 'CHK-20260402-0004', patient: ids.patients[0], caregiver: ids.caregiver, verificationMethod: 'ble', type: 'scheduled', scheduledTime: hoursAgo(30), actualTime: hoursAgo(29.5), status: 'completed', proximityVerification: { method: 'ble', verified: true, verifiedAt: hoursAgo(29.5), deviceIds: ['BLE-1'], signalStrength: -55, distance: 0.8 }, wellness: { overallStatus: 'good', mobility: 'normal', mood: 'neutral', appearance: 'normal', consciousness: 'alert', pain: { present: false, level: 0 } }, functionalStatus: { changedSinceLastVisit: false, mobility: 'assisted', gait: 'slow', balance: 'needs_support', assistiveDevice: 'cane', frailty: 'pre_frail', walkingDifficulty: 'mild', visionConcern: false, hearingConcern: false, continenceConcern: false, confusionChange: false, appetiteConcern: false, weightConcern: false, homeSafetyConcern: false, recentFall: false, nearFall: false, fallInjury: false, fearOfFalling: false, frailtySigns: [], caregiverObservations: [] }, vitals: { heartRate: { value: 80, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Evening check-in complete.', concerns: [], highlights: [] }, duration: 18, createdAt: hoursAgo(29.5), updatedAt: hoursAgo(29.5) }
  ];

  const alerts = [
    { _id: ids.alerts[0], alertId: 'ALT-20260402-0001', patient: ids.patients[2], type: 'vital_sign', severity: 'critical', title: 'Critical vital signs detected', message: 'Heart rate and oxygen saturation crossed the configured threshold.', source: { type: 'sensor', deviceId: devices[2].deviceId, sensorType: 'wearable', triggerValue: { heartRate: 124, oxygenSaturation: 89 } }, vitalSnapshot: { heartRate: 124, bloodPressure: { systolic: 158, diastolic: 96 }, oxygenSaturation: 89, temperature: 37.9, lastMotion: minutesAgo(16) }, status: 'escalated', escalation: { currentLevel: 2, history: [{ level: 1, escalatedAt: minutesAgo(35), escalatedTo: ids.caregiver, role: 'caregiver', reason: 'Initial alert', notificationSent: true, channels: ['push'] }, { level: 2, escalatedAt: minutesAgo(20), escalatedTo: ids.clinician, role: 'clinician', reason: 'Persistent abnormal readings', notificationSent: true, channels: ['push', 'sms'] }], nextEscalationAt: minutesFromNow(10) }, relatedCheckin: ids.checkins[2], createdAt: minutesAgo(36), updatedAt: minutesAgo(20) },
    { _id: ids.alerts[1], alertId: 'ALT-20260402-0002', patient: ids.patients[1], type: 'fall_detected', severity: 'high', title: 'Possible fall detected', message: 'Wearable recorded an impact pattern consistent with a fall.', source: { type: 'sensor', deviceId: devices[1].deviceId, sensorType: 'accelerometer', triggerValue: { impactForce: 2.5 } }, status: 'resolved', acknowledgements: [{ acknowledgedBy: ids.caregiver, role: 'caregiver', acknowledgedAt: minutesAgo(90), responseTime: 180, notes: 'Patient found stable.', actionTaken: 'On-site assessment' }], resolution: { resolvedBy: ids.caregiver, resolvedAt: minutesAgo(82), resolutionType: 'resolved', resolutionNotes: 'No injury confirmed.', followUpRequired: false, outcome: 'Stable' }, createdAt: minutesAgo(96), updatedAt: minutesAgo(82) },
    { _id: ids.alerts[2], alertId: 'ALT-20260402-0003', patient: ids.patients[0], type: 'medication_missed', severity: 'medium', title: 'Medication reminder overdue', message: 'Evening medication has not been confirmed.', source: { type: 'schedule', sensorType: 'medication_reminder', triggerValue: { overdueMinutes: 45 } }, status: 'pending', escalation: { currentLevel: 0, history: [], nextEscalationAt: minutesFromNow(25) }, createdAt: minutesAgo(42), updatedAt: minutesAgo(42) }
  ];

  const schedules = patientConfigs.map((patient, index) => ({
    _id: ids.schedules[index],
    scheduleId: `SCH-2026-${String(index + 1).padStart(5, '0')}`,
    patient: patient._id,
    title: `${patient.firstName} ${patient.lastName} care plan`,
    scheduledFor: minutesFromNow(1440),
    assignedTo: ids.caregiver,
    status: 'active',
    effectiveDate: daysAgo(10),
    checkinWindows: [
      { name: 'morning', startTime: '08:00', endTime: '10:00', gracePeriod: 20, required: true, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], assignedCaregiver: ids.caregiver },
      { name: 'evening', startTime: '18:00', endTime: '20:00', gracePeriod: 20, required: true, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], assignedCaregiver: ids.caregiver }
    ],
    medicationReminders: index === 1
      ? [
          {
            medication: patient.medication,
            dosage: '2 puffs',
            unit: 'puffs',
            time: '07:30',
            withFood: false,
            instructions: 'Use when shortness of breath occurs. Confirm usage during visits.',
            active: true,
            adherenceRule: 'as_needed',
            confirmationSource: 'patient',
            refillDueDate: daysAgo(-9),
            refillWindowDays: 7,
            sideEffectPrompts: ['Tremor', 'Fast heartbeat'],
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            startDate: daysAgo(10)
          }
        ]
      : [
          {
            medication: patient.medication,
            dosage: index === 2 ? '25mg' : '5mg',
            unit: 'mg',
            time: '08:30',
            withFood: true,
            instructions: 'Morning dose',
            active: true,
            adherenceRule: 'required',
            confirmationSource: 'caregiver',
            refillDueDate: daysAgo(index === 2 ? -4 : -12),
            refillWindowDays: index === 2 ? 5 : 7,
            sideEffectPrompts: index === 2
              ? ['Dizziness', 'Fatigue', 'Slow heartbeat']
              : ['Swollen ankles', 'Headache'],
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            startDate: daysAgo(10)
          },
          ...(index === 2
            ? [
                {
                  medication: patient.medication,
                  dosage: '25mg',
                  unit: 'mg',
                  time: '19:30',
                  withFood: true,
                  instructions: 'Evening dose',
                  active: true,
                  adherenceRule: 'required',
                  confirmationSource: 'caregiver',
                  refillDueDate: daysAgo(-4),
                  refillWindowDays: 5,
                  sideEffectPrompts: ['Dizziness', 'Fatigue', 'Slow heartbeat'],
                  days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                  startDate: daysAgo(10)
                }
              ]
            : [])
        ],
    weeklyActivities: [{ type: 'checkup', day: 'monday', time: '09:00', duration: 30, assignedTo: ids.chw, notes: 'Routine home visit', active: true }],
    vitalThresholds: [{ vitalType: 'heartRate', min: 50, max: index === 2 ? 115 : 120, unit: 'bpm', alertLevel: index === 2 ? 'critical' : 'medium', actions: ['Notify caregiver'] }],
    escalationRules: { level1: { timeoutMinutes: 5, notify: [ids.caregiver], channels: ['push'] }, level2: { timeoutMinutes: 10, notify: [ids.chw], channels: ['push', 'sms'] }, level3: { timeoutMinutes: 15, notify: [ids.clinician, ids.admin], channels: ['push', 'sms', 'call'] } },
    version: 1,
    previousVersions: [],
    createdBy: ids.admin,
    lastModifiedBy: ids.chw,
    createdAt: daysAgo(10),
    updatedAt: now
  }));

  const transitionDischargeDate = daysAgo(5);
  const transitions = [
    {
      _id: ids.transitions[0],
      transitionId: 'TRN-2026-00001',
      patient: ids.patients[2],
      createdBy: ids.clinician,
      assignedCaregiver: ids.caregiver,
      assignedCHW: ids.chw,
      assignedClinician: ids.clinician,
      status: 'active',
      transitionType: 'hospital_discharge',
      dischargeDate: transitionDischargeDate,
      dischargeReason: 'Recent stroke-related admission requiring close home follow-up.',
      dischargeFacility: 'Parirenyatwa Referral Hospital',
      diagnosisSummary: 'Post-stroke recovery with blood pressure, oxygen saturation, and mobility monitoring.',
      medicationChanges: [
        {
          name: 'Metoprolol',
          dosage: '25mg twice daily',
          changeType: 'changed',
          instructions: 'Monitor dizziness and blood pressure after each dose.'
        },
        {
          name: 'Aspirin',
          dosage: '75mg daily',
          changeType: 'started',
          instructions: 'Confirm adherence during every post-discharge visit.'
        }
      ],
      redFlags: [
        'New weakness or slurred speech',
        'Oxygen saturation below 90%',
        'Missed blood pressure medication',
        'Any new fall during transfers'
      ],
      followUpTasks: buildTransitionTaskPayload(
        [
          {
            title: 'Clinician review medication changes',
            description: 'Confirm blood pressure plan and stroke secondary prevention.',
            ownerRole: 'clinician',
            dueDate: new Date(transitionDischargeDate.getTime() + 2 * 86400000),
            priority: 'high',
            status: 'pending'
          },
          {
            title: 'CHW home visit and functional reassessment',
            description: 'Repeat mobility, balance, and home safety review after discharge.',
            ownerRole: 'chw',
            dueDate: new Date(transitionDischargeDate.getTime() + 3 * 86400000),
            priority: 'urgent',
            status: 'pending'
          },
          {
            title: 'Caregiver confirm medication supply and family update',
            description: 'Make sure new medications are available and family understands warning signs.',
            ownerRole: 'caregiver',
            dueDate: new Date(transitionDischargeDate.getTime() + 7 * 86400000),
            priority: 'high',
            status: 'pending'
          }
        ],
        transitionDischargeDate
      ),
      checkpoints: buildDefaultTransitionCheckpoints(transitionDischargeDate, {
        day7: { status: 'pending' },
        day14: { status: 'pending' },
        day30: { status: 'pending' }
      }),
      nextReviewDate: new Date(transitionDischargeDate.getTime() + 7 * 86400000),
      lastContactAt: hoursAgo(18),
      createdAt: transitionDischargeDate,
      updatedAt: now
    }
  ];

  const auditLogs = [
    buildAuditLog('AUD-20260402-0001', AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.admin, 'admin@chengeto.health', 'admin'), { type: 'user', id: ids.admin, model: 'User', description: 'Admin login' }, { message: 'Administrator reviewed deployment health.' }, hoursAgo(12)),
    buildAuditLog('AUD-20260402-0002', AUDIT_ACTIONS.PATIENT_CREATE, 'patient_management', actor(ids.admin, 'admin@chengeto.health', 'admin'), { type: 'patient', id: ids.patients[0], model: 'Patient', description: 'Patient enrolled' }, { message: 'Seeded patient profile.' }, daysAgo(18)),
    buildAuditLog('AUD-20260402-0003', AUDIT_ACTIONS.DEVICE_REGISTER, 'device', actor(ids.admin, 'admin@chengeto.health', 'admin'), { type: 'device', id: ids.devices[0], model: 'IoTDevice', description: devices[0].deviceId }, { message: 'Wearable provisioned.' }, daysAgo(17)),
    buildAuditLog('AUD-20260402-0004', AUDIT_ACTIONS.CHECKIN_CREATE, 'checkin', actor(ids.caregiver, 'caregiver1@example.com', 'caregiver'), { type: 'checkin', id: ids.checkins[0], model: 'CheckIn', description: 'Morning check-in' }, { message: 'Routine visit completed.' }, hoursAgo(5.5)),
    buildAuditLog('AUD-20260402-0005', AUDIT_ACTIONS.ALERT_TRIGGER, 'alert', actor(ids.admin, 'admin@chengeto.health', 'admin'), { type: 'alert', id: ids.alerts[0], model: 'Alert', description: 'Critical vitals alert' }, { message: 'Telemetry anomaly created alert.' }, minutesAgo(36)),
    buildAuditLog('AUD-20260402-0006', AUDIT_ACTIONS.ALERT_ESCALATE, 'alert', actor(ids.caregiver, 'caregiver1@example.com', 'caregiver'), { type: 'alert', id: ids.alerts[0], model: 'Alert', description: 'Escalated to clinician' }, { message: 'Escalated after persistent abnormal readings.' }, minutesAgo(20)),
    buildAuditLog('AUD-20260402-0007', AUDIT_ACTIONS.DATA_ACCESS, 'data_access', actor(ids.clinician, 'clinician1@chengeto.health', 'clinician'), { type: 'patient', id: ids.patients[2], model: 'Patient', description: 'Critical patient review' }, { message: 'Clinician opened patient record.' }, minutesAgo(15)),
    buildAuditLog('AUD-20260402-0008', AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.family, 'family1@example.com', 'family'), { type: 'user', id: ids.family, model: 'User', description: 'Family portal login' }, { message: 'Family member accessed dashboard.' }, daysAgo(2))
  ];

  await User.collection.insertMany(users);
  await Patient.collection.insertMany(patients);
  await IoTDevice.collection.insertMany(devices);
  await IoTTelemetry.collection.insertMany(telemetry);
  await CheckIn.collection.insertMany(checkins);
  await Alert.collection.insertMany(alerts);
  await CareSchedule.collection.insertMany(schedules);
  await CareTransition.insertMany(transitions);
  await AuditLog.collection.insertMany(auditLogs);

  const counts = {
    users: await User.countDocuments(),
    patients: await Patient.countDocuments(),
    devices: await IoTDevice.countDocuments(),
    telemetry: await IoTTelemetry.countDocuments(),
    checkins: await CheckIn.countDocuments(),
    alerts: await Alert.countDocuments(),
    schedules: await CareSchedule.countDocuments(),
    transitions: await CareTransition.countDocuments(),
    auditLogs: await AuditLog.countDocuments()
  };

  console.log('Demo data seeded successfully');
  console.log(JSON.stringify(counts, null, 2));
  console.log(`Admin: admin@chengeto.health / ${DEMO_PASSWORD}`);
  console.log(`CHW: chw1@chengeto.health / ${DEMO_PASSWORD}`);
  console.log(`Caregiver: caregiver1@example.com / ${DEMO_PASSWORD}`);
  console.log(`Clinician: clinician1@chengeto.health / ${DEMO_PASSWORD}`);
  console.log(`Family: family1@example.com / ${DEMO_PASSWORD}`);
  console.log(`Auditor: auditor@chengeto.health / ${DEMO_PASSWORD}`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error('Database seeding failed:', error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });

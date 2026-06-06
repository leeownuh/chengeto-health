import mongoose from 'mongoose';
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
import { USER_STATUS } from '../models/User.js';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@123456';
const DEFAULT_SEED_DATE = new Date().toISOString().slice(0, 10);
const DEMO_SEED_DATE = process.env.QUALITY_SEED_DATE || process.env.DEMO_SEED_DATE || DEFAULT_SEED_DATE;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://admin:chengeto_secure_2024@127.0.0.1:27017/chengeto_health?authSource=admin';

const ENTITY_ORDER = [
  'users',
  'patients',
  'devices',
  'telemetry',
  'checkins',
  'alerts',
  'schedules',
  'transitions',
  'auditLogs'
];

const ENTITY_DEPENDENCIES = {
  users: [],
  patients: ['users'],
  devices: ['users', 'patients'],
  telemetry: ['patients', 'devices'],
  checkins: ['users', 'patients'],
  alerts: ['users', 'patients', 'devices', 'checkins'],
  schedules: ['users', 'patients'],
  transitions: ['users', 'patients'],
  auditLogs: ['users', 'patients', 'devices', 'checkins', 'alerts', 'schedules', 'transitions']
};

const MODEL_BY_ENTITY = {
  users: User,
  patients: Patient,
  devices: IoTDevice,
  telemetry: IoTTelemetry,
  checkins: CheckIn,
  alerts: Alert,
  schedules: CareSchedule,
  transitions: CareTransition,
  auditLogs: AuditLog
};

const rolePermissions = {
  admin: ['read:patients', 'write:patients', 'delete:patients', 'read:alerts', 'write:alerts', 'acknowledge:alerts', 'escalate:alerts', 'read:checkins', 'write:checkins', 'verify:checkins', 'read:devices', 'write:devices', 'provision:devices', 'read:audit', 'export:audit', 'manage:users', 'manage:schedules', 'manage:system', 'access:admin', 'access:reports'],
  chw: ['read:patients', 'write:patients', 'read:alerts', 'acknowledge:alerts', 'escalate:alerts', 'read:checkins', 'write:checkins', 'verify:checkins', 'read:devices', 'access:reports'],
  caregiver: ['read:patients', 'read:alerts', 'acknowledge:alerts', 'read:checkins', 'write:checkins', 'read:devices'],
  clinician: ['read:patients', 'write:patients', 'read:alerts', 'acknowledge:alerts', 'escalate:alerts', 'read:checkins', 'read:devices', 'access:reports'],
  family: ['read:alerts', 'read:checkins'],
  auditor: ['read:patients', 'read:alerts', 'read:checkins', 'read:devices', 'read:audit', 'export:audit']
};

const oid = () => new mongoose.Types.ObjectId();
const baseNow = new Date(`${DEMO_SEED_DATE}T12:00:00.000Z`);
const baseNowMs = baseNow.getTime();
const rel = (ms) => new Date(baseNowMs + ms);
const daysAgo = (days) => rel(-days * 86400000);
const hoursAgo = (hours) => rel(-hours * 3600000);
const minutesAgo = (minutes) => rel(-minutes * 60000);
const minutesFromNow = (minutes) => rel(minutes * 60000);

const yyyymmddUTC = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const seedStamp = yyyymmddUTC(baseNow);
const makeStampedId = (prefix, seq) => `${prefix}-${seedStamp}-${String(seq).padStart(4, '0')}`;
const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const parseEntitySelection = (selection) => {
  if (!selection || String(selection).trim().toLowerCase() === 'all') {
    return null;
  }

  return String(selection)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

function parseArgs(argv) {
  const args = {
    entities: null,
    fresh: false,
    listEntities: false
  };

  for (const arg of argv) {
    if (arg === '--fresh') {
      args.fresh = true;
      continue;
    }

    if (arg === '--list-entities') {
      args.listEntities = true;
      continue;
    }

    if (arg.startsWith('--entities=')) {
      args.entities = arg
        .slice('--entities='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  return args;
}

function resolveEntities(selectedEntities) {
  if (!selectedEntities || selectedEntities.length === 0) {
    return [...ENTITY_ORDER];
  }

  const resolved = new Set();
  const visit = (entity) => {
    if (!ENTITY_ORDER.includes(entity)) {
      throw new Error(`Unknown seed entity "${entity}". Use --list-entities to inspect valid names.`);
    }
    if (resolved.has(entity)) {
      return;
    }
    for (const dependency of ENTITY_DEPENDENCIES[entity]) {
      visit(dependency);
    }
    resolved.add(entity);
  };

  for (const entity of selectedEntities) {
    visit(entity);
  }

  return ENTITY_ORDER.filter((entity) => resolved.has(entity));
}

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
      userAgent: 'CHENGETO quality seed'
    },
    details
  };
}

function buildSeedDataset() {
  const ids = {
    adminPrimary: oid(),
    adminOperations: oid(),
    chwHarare: oid(),
    chwBulawayo: oid(),
    caregiverNorth: oid(),
    caregiverSouth: oid(),
    clinicianGeriatrics: oid(),
    clinicianRehab: oid(),
    familyMoyo: oid(),
    familyNdlovu: oid(),
    auditorClinical: oid(),
    auditorOps: oid(),
    patients: [oid(), oid(), oid(), oid(), oid()],
    devices: [oid(), oid(), oid(), oid(), oid()],
    alerts: [oid(), oid(), oid(), oid(), oid()],
    checkins: [oid(), oid(), oid(), oid(), oid(), oid(), oid()],
    schedules: [oid(), oid(), oid(), oid(), oid()],
    transitions: [oid(), oid()]
  };

  const actor = (id, email, role) => ({ userId: id, email, role });

  const staffUsers = [
    {
      _id: ids.adminPrimary,
      email: 'admin@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+263771000001',
      role: 'admin',
      permissions: rolePermissions.admin,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      mfaEnabled: false,
      loginAttempts: 0,
      requiresPasswordReset: false,
      lastLogin: { timestamp: hoursAgo(4), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(45),
      updatedAt: baseNow
    },
    {
      _id: ids.adminOperations,
      email: 'ops-admin@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Nomusa',
      lastName: 'Chikafu',
      phone: '+263771000002',
      role: 'admin',
      permissions: rolePermissions.admin,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      mfaEnabled: false,
      loginAttempts: 0,
      qualification: 'Health Informatics MSc',
      specialization: 'Operational oversight',
      lastLogin: { timestamp: hoursAgo(9), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(39),
      updatedAt: baseNow
    },
    {
      _id: ids.chwHarare,
      email: 'chw1@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Nyasha',
      lastName: 'Mukamuri',
      phone: '+263771000011',
      role: 'chw',
      permissions: rolePermissions.chw,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      ward: 'Ward 16',
      district: 'Harare',
      assignedPatients: [ids.patients[0], ids.patients[2], ids.patients[4]],
      qualification: 'CHW Certificate',
      specialization: 'Community follow-up',
      lastLogin: { timestamp: hoursAgo(6), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(28),
      updatedAt: baseNow
    },
    {
      _id: ids.chwBulawayo,
      email: 'chw2@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Sipho',
      lastName: 'Ncube',
      phone: '+263771000012',
      role: 'chw',
      permissions: rolePermissions.chw,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      ward: 'Ward 7',
      district: 'Bulawayo',
      assignedPatients: [ids.patients[1], ids.patients[3]],
      qualification: 'Community Rehabilitation Certificate',
      specialization: 'Home safety reviews',
      lastLogin: { timestamp: hoursAgo(14), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(24),
      updatedAt: baseNow
    },
    {
      _id: ids.caregiverNorth,
      email: 'caregiver1@example.com',
      password: DEMO_PASSWORD,
      firstName: 'Tariro',
      lastName: 'Moyo',
      phone: '+263771000021',
      role: 'caregiver',
      permissions: rolePermissions.caregiver,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      assignedPatients: [ids.patients[0], ids.patients[2], ids.patients[4]],
      isPrimaryCaregiver: true,
      specializations: ['Medication adherence', 'Home visits', 'Mobility support'],
      certificationNumber: 'CG-2026-001',
      lastLogin: { timestamp: hoursAgo(3), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(21),
      updatedAt: baseNow
    },
    {
      _id: ids.caregiverSouth,
      email: 'caregiver2@example.com',
      password: DEMO_PASSWORD,
      firstName: 'Rumbidzai',
      lastName: 'Dube',
      phone: '+263771000022',
      role: 'caregiver',
      permissions: rolePermissions.caregiver,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      assignedPatients: [ids.patients[1], ids.patients[3]],
      isPrimaryCaregiver: false,
      specializations: ['Respiratory support', 'Fall recovery observation'],
      certificationNumber: 'CG-2026-002',
      lastLogin: { timestamp: hoursAgo(5), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(17),
      updatedAt: baseNow
    },
    {
      _id: ids.clinicianGeriatrics,
      email: 'clinician1@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Dr. Farai',
      lastName: 'Mlambo',
      phone: '+263771000031',
      role: 'clinician',
      permissions: rolePermissions.clinician,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      specializations: ['Geriatrics'],
      qualification: 'MBChB, MMed Geriatrics',
      lastLogin: { timestamp: hoursAgo(8), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(35),
      updatedAt: baseNow
    },
    {
      _id: ids.clinicianRehab,
      email: 'clinician2@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Dr. Chipo',
      lastName: 'Mushonga',
      phone: '+263771000032',
      role: 'clinician',
      permissions: rolePermissions.clinician,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      specializations: ['Rehabilitation Medicine', 'Stroke follow-up'],
      qualification: 'MBChB, Rehabilitation Fellowship',
      lastLogin: { timestamp: hoursAgo(13), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(31),
      updatedAt: baseNow
    },
    {
      _id: ids.familyMoyo,
      email: 'family1@example.com',
      password: DEMO_PASSWORD,
      firstName: 'Kudzai',
      lastName: 'Moyo',
      phone: '+263771000041',
      role: 'family',
      permissions: rolePermissions.family,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      linkedPatients: [
        { patient: ids.patients[0], relationship: 'child', accessLevel: 'full' },
        { patient: ids.patients[2], relationship: 'child', accessLevel: 'full' }
      ],
      lastLogin: { timestamp: daysAgo(2), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(18),
      updatedAt: baseNow
    },
    {
      _id: ids.familyNdlovu,
      email: 'family2@example.com',
      password: DEMO_PASSWORD,
      firstName: 'Thabiso',
      lastName: 'Ndlovu',
      phone: '+263771000042',
      role: 'family',
      permissions: rolePermissions.family,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      linkedPatients: [
        { patient: ids.patients[1], relationship: 'spouse', accessLevel: 'full' },
        { patient: ids.patients[3], relationship: 'relative', accessLevel: 'limited' }
      ],
      lastLogin: { timestamp: daysAgo(4), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(16),
      updatedAt: baseNow
    },
    {
      _id: ids.auditorClinical,
      email: 'auditor@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Audit',
      lastName: 'Officer',
      phone: '+263771000051',
      role: 'auditor',
      permissions: rolePermissions.auditor,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      qualification: 'BCom Audit',
      specialization: 'Clinical compliance',
      lastLogin: { timestamp: daysAgo(5), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(40),
      updatedAt: baseNow
    },
    {
      _id: ids.auditorOps,
      email: 'auditor.ops@chengeto.health',
      password: DEMO_PASSWORD,
      firstName: 'Prudence',
      lastName: 'Maphosa',
      phone: '+263771000052',
      role: 'auditor',
      permissions: rolePermissions.auditor,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      qualification: 'Information Systems Audit',
      specialization: 'Operational controls',
      lastLogin: { timestamp: daysAgo(6), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(42),
      updatedAt: baseNow
    }
  ];

  const patientConfigs = [
    { _id: ids.patients[0], patientId: 'CHG-2026-00001', firstName: 'Chengetai', lastName: 'Moyo', gender: 'female', dob: new Date('1948-06-12T00:00:00Z'), phone: '+263771100001', district: 'Borrowdale', province: 'Harare', coords: { latitude: -17.788, longitude: 31.053 }, riskLevel: 'high', summary: 'Blood pressure and glucose monitoring required.', battery: 84, heartRate: 78, oxygen: 97, systolic: 134, diastolic: 84, temperature: 36.8, condition: 'Hypertension', medication: 'Amlodipine', caregiverId: ids.caregiverNorth, chwId: ids.chwHarare, clinicianId: ids.clinicianGeriatrics, familyIds: [ids.familyMoyo], functionalBaseline: { mobility: 'assisted', gait: 'slow', balance: 'needs_support', assistiveDevice: 'cane', vision: 'adequate', hearing: 'adequate', continence: 'occasional_issues', weightLossRisk: 'low', frailty: 'pre_frail', homeSafety: 'needs_minor_changes', recentFalls: { count: 1, lastFallAt: daysAgo(42), injuryFromLastFall: false }, notes: 'Needs supervision outdoors.' } },
    { _id: ids.patients[1], patientId: 'CHG-2026-00002', firstName: 'Tendai', lastName: 'Ndlovu', gender: 'male', dob: new Date('1951-11-03T00:00:00Z'), phone: '+263771100002', district: 'Hillside', province: 'Bulawayo', coords: { latitude: -20.149, longitude: 28.596 }, riskLevel: 'moderate', summary: 'Respiratory support and mobility assistance.', battery: 68, heartRate: 83, oxygen: 92, systolic: 138, diastolic: 86, temperature: 36.9, condition: 'COPD', medication: 'Salbutamol Inhaler', caregiverId: ids.caregiverSouth, chwId: ids.chwBulawayo, clinicianId: ids.clinicianGeriatrics, familyIds: [ids.familyNdlovu], functionalBaseline: { mobility: 'assisted', gait: 'unsteady', balance: 'needs_support', assistiveDevice: 'walker', vision: 'impaired', hearing: 'adequate', continence: 'occasional_issues', weightLossRisk: 'moderate', frailty: 'frail', homeSafety: 'needs_minor_changes', recentFalls: { count: 2, lastFallAt: daysAgo(18), injuryFromLastFall: false }, notes: 'Needs escort when fatigued.' } },
    { _id: ids.patients[2], patientId: 'CHG-2026-00003', firstName: 'Rutendo', lastName: 'Chiwenga', gender: 'female', dob: new Date('1944-01-27T00:00:00Z'), phone: '+263771100003', district: 'Murambi', province: 'Manicaland', coords: { latitude: -18.970, longitude: 32.670 }, riskLevel: 'critical', summary: 'Post-stroke recovery with elevated vitals follow-up.', battery: 39, heartRate: 124, oxygen: 89, systolic: 158, diastolic: 96, temperature: 37.9, condition: 'Stroke Recovery', medication: 'Metoprolol', caregiverId: ids.caregiverNorth, chwId: ids.chwHarare, clinicianId: ids.clinicianRehab, familyIds: [ids.familyMoyo], functionalBaseline: { mobility: 'wheelchair', gait: 'shuffling', balance: 'unstable', assistiveDevice: 'wheelchair', vision: 'adequate', hearing: 'impaired', continence: 'occasional_issues', weightLossRisk: 'high', frailty: 'frail', homeSafety: 'unsafe', recentFalls: { count: 3, lastFallAt: daysAgo(10), injuryFromLastFall: true }, notes: 'Two-person assist for transfers.' } },
    { _id: ids.patients[3], patientId: 'CHG-2026-00004', firstName: 'Josiah', lastName: 'Dube', gender: 'male', dob: new Date('1947-09-16T00:00:00Z'), phone: '+263771100004', district: 'Luveve', province: 'Bulawayo', coords: { latitude: -20.188, longitude: 28.545 }, riskLevel: 'high', summary: 'Diabetes and foot-care monitoring with early renal risk.', battery: 57, heartRate: 91, oxygen: 95, systolic: 146, diastolic: 88, temperature: 36.7, condition: 'Type 2 Diabetes', medication: 'Metformin', caregiverId: ids.caregiverSouth, chwId: ids.chwBulawayo, clinicianId: ids.clinicianGeriatrics, familyIds: [ids.familyNdlovu], functionalBaseline: { mobility: 'independent', gait: 'steady', balance: 'stable', assistiveDevice: 'none', vision: 'impaired', hearing: 'adequate', continence: 'independent', weightLossRisk: 'moderate', frailty: 'pre_frail', homeSafety: 'safe', recentFalls: { count: 0, lastFallAt: null, injuryFromLastFall: false }, notes: 'Needs meal planning support.' } },
    { _id: ids.patients[4], patientId: 'CHG-2026-00005', firstName: 'Agnes', lastName: 'Sibanda', gender: 'female', dob: new Date('1942-03-08T00:00:00Z'), phone: '+263771100005', district: 'Chitungwiza', province: 'Harare', coords: { latitude: -18.012, longitude: 31.075 }, riskLevel: 'moderate', summary: 'Arthritis and mild cognitive decline with social support needs.', battery: 73, heartRate: 76, oxygen: 98, systolic: 132, diastolic: 82, temperature: 36.5, condition: 'Osteoarthritis', medication: 'Paracetamol', caregiverId: ids.caregiverNorth, chwId: ids.chwHarare, clinicianId: ids.clinicianRehab, familyIds: [ids.familyMoyo], functionalBaseline: { mobility: 'assisted', gait: 'slow', balance: 'needs_support', assistiveDevice: 'cane', vision: 'adequate', hearing: 'impaired', continence: 'independent', weightLossRisk: 'low', frailty: 'pre_frail', homeSafety: 'safe', recentFalls: { count: 1, lastFallAt: daysAgo(75), injuryFromLastFall: false }, notes: 'Benefits from reminder prompts.' } }
  ];

  const patients = patientConfigs.map((patient, index) => ({
    _id: patient._id,
    patientId: patient.patientId,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dob,
    gender: patient.gender,
    phone: patient.phone,
    address: {
      village: patient.district,
      ward: `Ward ${index + 4}`,
      district: patient.district,
      province: patient.province,
      country: 'Zimbabwe',
      coordinates: patient.coords
    },
    medicalSummary: patient.summary,
    medicalConditions: [{ condition: patient.condition, diagnosedDate: new Date('2022-01-01T00:00:00Z'), status: 'active' }],
    allergies: [{ allergen: 'None known', severity: 'mild', reaction: 'No recorded allergy' }],
    currentMedications: [
      {
        name: patient.medication,
        dosage: index === 1 ? '2 puffs' : index === 2 ? '25mg' : index === 3 ? '500mg' : '5mg',
        unit: index === 1 ? 'puffs' : 'mg',
        frequency: index === 2 ? 'Twice daily' : 'Daily',
        startDate: new Date('2023-01-01T00:00:00Z'),
        prescribedBy: index === 2 || index === 4 ? 'Dr. Mushonga' : 'Dr. Mlambo',
        refillDueDate: daysAgo(-12 + index * 2),
        refillWindowDays: index === 2 ? 5 : 7,
        adherenceRule: index === 1 ? 'as_needed' : 'required',
        sideEffectPrompts: index === 2
          ? ['Dizziness', 'Fatigue', 'Slow heartbeat']
          : index === 3
            ? ['Stomach upset', 'Reduced appetite']
            : ['Swollen ankles', 'Headache'],
        confirmationSource: index === 1 ? 'patient' : 'caregiver'
      }
    ],
    primaryCaregiver: patient.caregiverId,
    assignedCHW: patient.chwId,
    assignedClinician: patient.clinicianId,
    emergencyContacts: [{ name: `${patient.firstName} Family`, relationship: 'child', phone: `+26377220000${index + 1}`, isPrimary: true, priority: 1 }],
    familyMembers: patient.familyIds.map((userId, familyIndex) => ({
      user: userId,
      relationship: familyIndex === 0 ? 'child' : 'relative',
      accessLevel: familyIndex === 0 ? 'full' : 'limited',
      approvedAt: daysAgo(15)
    })),
    iotDevice: {
      deviceId: `PM-${String(index + 1).padStart(3, '0')}`,
      paired: true,
      pairedAt: daysAgo(12),
      lastSeen: minutesAgo(index === 0 ? 2 : index === 1 ? 6 : index === 2 ? 18 : index === 3 ? 7 : 11),
      firmwareVersion: '1.4.2',
      batteryLevel: patient.battery,
      status: patient.battery < 45 ? 'maintenance' : 'online'
    },
    status: 'active',
    riskLevel: patient.riskLevel,
    functionalBaseline: patient.functionalBaseline,
    compliance: {
      checkinAdherence: 92 - index * 4,
      medicationAdherence: 94 - index * 3,
      missedCheckins: index === 2 ? 1 : 0,
      lastCheckin: hoursAgo(index + 3),
      consecutiveMissedCheckins: 0
    },
    carePlan: {
      goals: [
        { title: 'Maintain daily medication adherence', targetDate: daysAgo(-30), status: 'active' },
        { title: 'Reduce unplanned escalations', targetDate: daysAgo(-45), status: 'active' }
      ],
      riskProfile: {
        summary: patient.summary,
        fallRisk: patient.riskLevel === 'critical' ? 'critical' : patient.riskLevel === 'high' ? 'high' : 'moderate',
        medicationRisk: patient.riskLevel === 'critical' ? 'high' : 'moderate',
        cognitiveRisk: index === 4 ? 'moderate' : 'low',
        socialRisk: index === 4 ? 'high' : 'moderate',
        caregiverInstructions: 'Escalate any rapid change in mobility, vitals, or confusion.'
      },
      visitCadence: {
        frequency: patient.riskLevel === 'critical' ? 'twice-daily' : 'daily',
        preferredWindow: index % 2 === 0 ? 'morning' : 'afternoon',
        preferredDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        notes: 'Routine home support'
      },
      escalationPreferences: {
        primaryResponderRole: 'caregiver',
        notifyFamily: true,
        notifyClinicianOnHighRisk: true,
        maxResponseMinutes: patient.riskLevel === 'critical' ? 15 : 30
      },
      consentSettings: {
        familyAccessLevel: 'limited',
        familyUpdates: true,
        emergencySharing: true,
        dataCollection: true
      },
      review: {
        lastReviewedAt: daysAgo(6),
        nextReviewDate: daysAgo(-21),
        notes: 'Seeded care-plan review state'
      }
    },
    consent: {
      dataCollection: true,
      familyAccess: true,
      emergencyDataSharing: true,
      consentDate: daysAgo(20),
      consentedBy: `${patient.firstName} ${patient.lastName}`,
      consentVersion: '1.0'
    },
    enrolledBy: ids.adminPrimary,
    enrolledAt: daysAgo(20 - index),
    lastUpdatedBy: patient.chwId,
    createdAt: daysAgo(20 - index),
    updatedAt: baseNow
  }));

  const devices = patientConfigs.map((patient, index) => ({
    _id: ids.devices[index],
    deviceId: `PM-${String(index + 1).padStart(3, '0')}`,
    serialNumber: `CHG-PM-${202600 + index + 1}`,
    deviceType: 'patient_monitor',
    model: index === 2 ? 'Guardian Pro' : 'Guardian Lite',
    manufacturer: 'CHENGETO Labs',
    firmwareVersion: '1.4.2',
    capabilities: ['heart_rate', 'motion', 'fall_detection', 'location', 'panic_button', 'ble', 'nfc'],
    owner: patient.caregiverId,
    assignedPatient: patient._id,
    assignedCaregiver: patient.caregiverId,
    status: patient.battery < 45 ? 'maintenance' : 'active',
    pairing: {
      isPaired: true,
      pairedAt: daysAgo(12),
      pairingCode: `PAIR-${index + 1}`
    },
    network: { bleAddress: `BLE-${index + 1}`, nfcId: `NFC-${index + 1}`, supportedProtocols: ['mqtt', 'ble', 'nfc'] },
    connection: {
      online: patient.battery >= 45,
      lastOnline: minutesAgo(index === 0 ? 2 : index === 1 ? 6 : index === 2 ? 18 : index === 3 ? 7 : 11),
      connectionType: 'cellular',
      signalStrength: -60 - index * 4,
      mqttClientId: `device-${index + 1}`
    },
    power: {
      batteryLevel: patient.battery,
      batteryStatus: patient.battery < 45 ? 'low' : 'discharging',
      lastCharged: daysAgo(1),
      estimatedBatteryLife: patient.battery < 45 ? 5 : 24
    },
    provisionedBy: ids.adminPrimary,
    provisionedAt: daysAgo(18),
    activatedAt: daysAgo(17),
    alerts: {
      lowBatteryThreshold: 20,
      offlineAlertThreshold: 30,
      vitalAlertEnabled: true,
      fallAlertEnabled: true,
      inactivityAlertEnabled: true
    },
    createdAt: daysAgo(18),
    updatedAt: baseNow
  }));

  const telemetry = patientConfigs.flatMap((patient, index) =>
    [180, 90, 20].map((offset, sampleIndex) => ({
      _id: oid(),
      deviceId: `PM-${String(index + 1).padStart(3, '0')}`,
      patient: patient._id,
      timestamp: minutesAgo(offset),
      heartRate: {
        value: sampleIndex === 2 ? patient.heartRate : patient.heartRate - 4,
        unit: 'bpm',
        status: sampleIndex === 2 && patient.riskLevel === 'critical' ? 'abnormal' : 'normal',
        confidence: 94,
        source: 'ppg'
      },
      bloodPressure: {
        systolic: { value: sampleIndex === 2 ? patient.systolic : patient.systolic - 6, status: sampleIndex === 2 && patient.riskLevel === 'critical' ? 'abnormal' : 'normal' },
        diastolic: { value: sampleIndex === 2 ? patient.diastolic : patient.diastolic - 4, status: sampleIndex === 2 && patient.riskLevel === 'critical' ? 'abnormal' : 'normal' },
        unit: 'mmHg',
        measuredAt: minutesAgo(offset)
      },
      oxygenSaturation: {
        value: sampleIndex === 2 ? patient.oxygen : patient.oxygen + (patient.riskLevel === 'critical' ? 1 : 0),
        unit: '%',
        status: sampleIndex === 2 && patient.oxygen < 90 ? 'critical' : 'normal'
      },
      temperature: {
        value: sampleIndex === 2 ? patient.temperature : patient.temperature - 0.2,
        unit: 'C',
        location: 'wrist',
        status: sampleIndex === 2 && patient.riskLevel === 'critical' ? 'abnormal' : 'normal'
      },
      motion: {
        detected: true,
        type: sampleIndex === 0 ? 'walking' : sampleIndex === 1 ? 'sitting' : 'lying',
        intensity: sampleIndex === 0 ? 'medium' : 'low',
        duration: 120,
        accelerometer: { x: 0.2, y: 0.3, z: 0.7 },
        gyroscope: { x: 0.1, y: 0.1, z: 0.2 }
      },
      fall: {
        detected: index === 1 && sampleIndex === 1,
        confidence: index === 1 && sampleIndex === 1 ? 84 : 0,
        impactForce: index === 1 && sampleIndex === 1 ? 2.5 : 0,
        fallType: index === 1 && sampleIndex === 1 ? 'lateral' : 'unknown',
        recoveryDetected: true
      },
      inactivity: {
        duration: sampleIndex === 2 ? 70 : 10,
        lastMotionTime: minutesAgo(offset + 5),
        threshold: 240,
        alertTriggered: false
      },
      activity: {
        steps: 1200 + sampleIndex * 400,
        distance: 700 + sampleIndex * 150,
        calories: 120 + sampleIndex * 20,
        activeMinutes: 20 + sampleIndex * 5,
        sedentaryMinutes: 30
      },
      deviceStatus: {
        batteryLevel: patient.battery - sampleIndex,
        charging: false,
        signalStrength: -62,
        firmwareVersion: '1.4.2',
        lastSync: minutesAgo(offset - 1),
        status: patient.battery < 45 ? 'low_battery' : 'online',
        errors: []
      },
      location: {
        latitude: patient.coords.latitude,
        longitude: patient.coords.longitude,
        accuracy: 8,
        indoor: true,
        zone: 'home'
      },
      processed: true,
      processedAt: minutesAgo(offset - 1),
      alertGenerated: sampleIndex === 2 && patient.riskLevel === 'critical',
      createdAt: minutesAgo(offset),
      updatedAt: minutesAgo(offset)
    }))
  );

  const checkins = [
    { _id: ids.checkins[0], checkinId: makeStampedId('CHK', 1), patient: ids.patients[0], caregiver: ids.caregiverNorth, verificationMethod: 'nfc', type: 'scheduled', scheduledTime: hoursAgo(6), actualTime: hoursAgo(5.5), status: 'completed', proximityVerification: { method: 'nfc', verified: true, verifiedAt: hoursAgo(5.5), deviceIds: ['NFC-1'], distance: 0.3 }, wellness: { overallStatus: 'good', mobility: 'normal', mood: 'happy', appearance: 'normal', consciousness: 'alert', pain: { present: false, level: 0 } }, vitals: { heartRate: { value: 78, abnormal: false }, bloodPressure: { systolic: 134, diastolic: 84, abnormal: false }, temperature: { value: 36.8, abnormal: false }, oxygenSaturation: { value: 97, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Routine visit completed.', concerns: [], highlights: ['Medication taken'] }, duration: 20, createdAt: hoursAgo(5.5), updatedAt: hoursAgo(5.5) },
    { _id: ids.checkins[1], checkinId: makeStampedId('CHK', 2), patient: ids.patients[1], caregiver: ids.caregiverSouth, verificationMethod: 'ble', type: 'scheduled', scheduledTime: hoursAgo(18), actualTime: hoursAgo(17.4), status: 'completed', proximityVerification: { method: 'ble', verified: true, verifiedAt: hoursAgo(17.4), deviceIds: ['BLE-2'], signalStrength: -58, distance: 0.9 }, wellness: { overallStatus: 'fair', mobility: 'limited', mood: 'neutral', appearance: 'normal', consciousness: 'alert', pain: { present: true, level: 3 } }, vitals: { heartRate: { value: 83, abnormal: false }, bloodPressure: { systolic: 138, diastolic: 86, abnormal: false }, oxygenSaturation: { value: 92, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Breathing stable after inhaler.', concerns: ['Monitor overnight'], highlights: [] }, duration: 25, createdAt: hoursAgo(17.4), updatedAt: hoursAgo(17.4) },
    { _id: ids.checkins[2], checkinId: makeStampedId('CHK', 3), patient: ids.patients[2], caregiver: ids.caregiverNorth, verificationMethod: 'manual_override', type: 'follow_up', scheduledTime: hoursAgo(4), actualTime: hoursAgo(3.1), status: 'completed', proximityVerification: { method: 'manual_override', verified: true, verifiedAt: hoursAgo(3.1), gpsCoordinates: { latitude: -18.97, longitude: 32.67, accuracy: 7 } }, wellness: { overallStatus: 'poor', mobility: 'needs_assistance', mood: 'anxious', appearance: 'concerning', consciousness: 'alert', pain: { present: true, level: 5 } }, vitals: { heartRate: { value: 124, abnormal: true }, bloodPressure: { systolic: 158, diastolic: 96, abnormal: true }, temperature: { value: 37.9, abnormal: true }, oxygenSaturation: { value: 89, abnormal: true } }, medication: { adherence: 'partial' }, notes: { caregiver: 'Escalated for clinician review.', concerns: ['Oxygen saturation low'], highlights: [] }, duration: 34, followUp: { required: true, reason: 'Urgent review', scheduledFor: minutesFromNow(90), priority: 'urgent' }, createdAt: hoursAgo(3.1), updatedAt: hoursAgo(3.1) },
    { _id: ids.checkins[3], checkinId: makeStampedId('CHK', 4), patient: ids.patients[3], caregiver: ids.caregiverSouth, verificationMethod: 'ble', type: 'scheduled', scheduledTime: hoursAgo(30), actualTime: hoursAgo(29.5), status: 'completed', proximityVerification: { method: 'ble', verified: true, verifiedAt: hoursAgo(29.5), deviceIds: ['BLE-4'], signalStrength: -55, distance: 0.8 }, wellness: { overallStatus: 'fair', mobility: 'normal', mood: 'neutral', appearance: 'normal', consciousness: 'alert', pain: { present: false, level: 0 } }, vitals: { heartRate: { value: 91, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Blood sugar diary reviewed.', concerns: ['Meal planning follow-up'], highlights: [] }, duration: 18, createdAt: hoursAgo(29.5), updatedAt: hoursAgo(29.5) },
    { _id: ids.checkins[4], checkinId: makeStampedId('CHK', 5), patient: ids.patients[4], caregiver: ids.caregiverNorth, verificationMethod: 'nfc', type: 'scheduled', scheduledTime: hoursAgo(12), actualTime: hoursAgo(11.3), status: 'completed', proximityVerification: { method: 'nfc', verified: true, verifiedAt: hoursAgo(11.3), deviceIds: ['NFC-5'], distance: 0.2 }, wellness: { overallStatus: 'good', mobility: 'limited', mood: 'happy', appearance: 'normal', consciousness: 'alert', pain: { present: true, level: 2 } }, vitals: { heartRate: { value: 76, abnormal: false }, bloodPressure: { systolic: 132, diastolic: 82, abnormal: false } }, medication: { adherence: 'taken' }, notes: { caregiver: 'Prompted meal and pain medication reminders.', concerns: [], highlights: ['Engaged well with family update'] }, duration: 22, createdAt: hoursAgo(11.3), updatedAt: hoursAgo(11.3) },
    { _id: ids.checkins[5], checkinId: makeStampedId('CHK', 6), patient: ids.patients[0], caregiver: ids.caregiverNorth, verificationMethod: 'ble', type: 'scheduled', scheduledTime: hoursAgo(44), actualTime: hoursAgo(43.5), status: 'completed', proximityVerification: { method: 'ble', verified: true, verifiedAt: hoursAgo(43.5), deviceIds: ['BLE-1'], signalStrength: -57, distance: 0.7 }, wellness: { overallStatus: 'good', mobility: 'normal', mood: 'neutral', appearance: 'normal', consciousness: 'alert', pain: { present: false, level: 0 } }, medication: { adherence: 'taken' }, duration: 19, createdAt: hoursAgo(43.5), updatedAt: hoursAgo(43.5) },
    { _id: ids.checkins[6], checkinId: makeStampedId('CHK', 7), patient: ids.patients[2], caregiver: ids.caregiverNorth, verificationMethod: 'manual_override', type: 'emergency', scheduledTime: hoursAgo(1.5), actualTime: hoursAgo(1.2), status: 'completed', proximityVerification: { method: 'manual_override', verified: true, verifiedAt: hoursAgo(1.2), gpsCoordinates: { latitude: -18.97, longitude: 32.67, accuracy: 5 } }, wellness: { overallStatus: 'critical', mobility: 'needs_assistance', mood: 'anxious', appearance: 'concerning', consciousness: 'alert', pain: { present: true, level: 6 } }, vitals: { heartRate: { value: 118, abnormal: true }, oxygenSaturation: { value: 90, abnormal: true } }, medication: { adherence: 'partial' }, notes: { caregiver: 'Urgent reassessment after escalation.' }, duration: 28, createdAt: hoursAgo(1.2), updatedAt: hoursAgo(1.2) }
  ];

  const alerts = [
    { _id: ids.alerts[0], alertId: makeStampedId('ALT', 1), patient: ids.patients[2], type: 'vital_sign', severity: 'critical', title: 'Critical vital signs detected', message: 'Heart rate and oxygen saturation crossed the configured threshold.', source: { type: 'sensor', deviceId: 'PM-003', sensorType: 'wearable', triggerValue: { heartRate: 124, oxygenSaturation: 89 } }, vitalSnapshot: { heartRate: 124, bloodPressure: { systolic: 158, diastolic: 96 }, oxygenSaturation: 89, temperature: 37.9, lastMotion: minutesAgo(16) }, status: 'escalated', escalation: { currentLevel: 2, history: [{ level: 1, escalatedAt: minutesAgo(35), escalatedTo: ids.caregiverNorth, role: 'caregiver', reason: 'Initial alert', notificationSent: true, channels: ['push'] }, { level: 2, escalatedAt: minutesAgo(20), escalatedTo: ids.clinicianRehab, role: 'clinician', reason: 'Persistent abnormal readings', notificationSent: true, channels: ['push', 'sms'] }], nextEscalationAt: minutesFromNow(10) }, relatedCheckin: ids.checkins[2], createdAt: minutesAgo(36), updatedAt: minutesAgo(20) },
    { _id: ids.alerts[1], alertId: makeStampedId('ALT', 2), patient: ids.patients[1], type: 'fall_detected', severity: 'high', title: 'Possible fall detected', message: 'Wearable recorded an impact pattern consistent with a fall.', source: { type: 'sensor', deviceId: 'PM-002', sensorType: 'accelerometer', triggerValue: { impactForce: 2.5 } }, status: 'resolved', acknowledgements: [{ acknowledgedBy: ids.caregiverSouth, role: 'caregiver', acknowledgedAt: minutesAgo(90), responseTime: 180, notes: 'Patient found stable.', actionTaken: 'On-site assessment' }], resolution: { resolvedBy: ids.caregiverSouth, resolvedAt: minutesAgo(82), resolutionType: 'resolved', resolutionNotes: 'No injury confirmed.', followUpRequired: false, outcome: 'Stable' }, createdAt: minutesAgo(96), updatedAt: minutesAgo(82) },
    { _id: ids.alerts[2], alertId: makeStampedId('ALT', 3), patient: ids.patients[0], type: 'medication_missed', severity: 'medium', title: 'Medication reminder overdue', message: 'Evening medication has not been confirmed.', source: { type: 'schedule', sensorType: 'medication_reminder', triggerValue: { overdueMinutes: 45 } }, status: 'pending', escalation: { currentLevel: 0, history: [], nextEscalationAt: minutesFromNow(25) }, createdAt: minutesAgo(42), updatedAt: minutesAgo(42) },
    { _id: ids.alerts[3], alertId: makeStampedId('ALT', 4), patient: ids.patients[3], type: 'device_offline', severity: 'medium', title: 'Device connectivity degraded', message: 'Patient monitor has intermittent signal dropouts.', source: { type: 'system', deviceId: 'PM-004', sensorType: 'mqtt', triggerValue: { offlineMinutes: 18 } }, status: 'acknowledged', acknowledgements: [{ acknowledgedBy: ids.chwBulawayo, role: 'chw', acknowledgedAt: minutesAgo(12), responseTime: 240, notes: 'Will inspect during next visit.', actionTaken: 'Monitor connection' }], createdAt: minutesAgo(30), updatedAt: minutesAgo(12) },
    { _id: ids.alerts[4], alertId: makeStampedId('ALT', 5), patient: ids.patients[4], type: 'missed_checkin', severity: 'low', title: 'Check-in completed late', message: 'Morning check-in was completed outside the preferred window.', source: { type: 'schedule', sensorType: 'checkin_window', triggerValue: { gracePeriodMinutes: 20 } }, status: 'closed', resolution: { resolvedBy: ids.chwHarare, resolvedAt: hoursAgo(8), resolutionType: 'no_action_needed', resolutionNotes: 'Late arrival due to transport issue.', followUpRequired: false, outcome: 'Late but safe' }, createdAt: hoursAgo(10), updatedAt: hoursAgo(8) }
  ];

  const schedules = patientConfigs.map((patient, index) => ({
    _id: ids.schedules[index],
    scheduleId: `SCH-2026-${String(index + 1).padStart(5, '0')}`,
    patient: patient._id,
    title: `${patient.firstName} ${patient.lastName} care plan`,
    assignedTo: patient.caregiverId,
    status: 'active',
    effectiveDate: daysAgo(10),
    checkinWindows: [
      { name: 'morning', startTime: '08:00', endTime: '10:00', gracePeriod: 20, required: true, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], assignedCaregiver: patient.caregiverId },
      { name: 'evening', startTime: '18:00', endTime: '20:00', gracePeriod: 20, required: true, days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], assignedCaregiver: patient.caregiverId }
    ],
    medicationReminders: [
      {
        medication: patient.medication,
        dosage: index === 1 ? '2 puffs' : index === 2 ? '25mg' : index === 3 ? '500mg' : '5mg',
        unit: index === 1 ? 'puffs' : 'mg',
        time: '08:30',
        withFood: index !== 1,
        instructions: index === 1 ? 'Use when shortness of breath occurs.' : 'Morning dose',
        active: true,
        adherenceRule: index === 1 ? 'as_needed' : 'required',
        confirmationSource: index === 1 ? 'patient' : 'caregiver',
        refillDueDate: daysAgo(-10 + index),
        refillWindowDays: index === 2 ? 5 : 7,
        sideEffectPrompts: index === 2 ? ['Dizziness', 'Fatigue'] : ['Headache'],
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        startDate: daysAgo(10)
      }
    ],
    weeklyActivities: [{ type: 'checkup', day: 'monday', time: '09:00', duration: 30, assignedTo: patient.chwId, notes: 'Routine home visit', active: true }],
    vitalThresholds: [{ vitalType: 'heartRate', min: 50, max: patient.riskLevel === 'critical' ? 115 : 120, unit: 'bpm', alertLevel: patient.riskLevel === 'critical' ? 'critical' : 'medium', actions: ['Notify caregiver'] }],
    escalationRules: {
      level1: { timeoutMinutes: 5, notify: [patient.caregiverId], channels: ['push'] },
      level2: { timeoutMinutes: 10, notify: [patient.chwId], channels: ['push', 'sms'] },
      level3: { timeoutMinutes: 15, notify: [patient.clinicianId, ids.adminPrimary], channels: ['push', 'sms', 'call'] }
    },
    version: 1,
    previousVersions: [],
    createdBy: ids.adminPrimary,
    lastModifiedBy: patient.chwId,
    createdAt: daysAgo(10),
    updatedAt: baseNow
  }));

  const transitions = [
    {
      _id: ids.transitions[0],
      transitionId: 'TRN-2026-00001',
      patient: ids.patients[2],
      createdBy: ids.clinicianRehab,
      assignedCaregiver: ids.caregiverNorth,
      assignedCHW: ids.chwHarare,
      assignedClinician: ids.clinicianRehab,
      status: 'active',
      transitionType: 'hospital_discharge',
      dischargeDate: daysAgo(5),
      dischargeReason: 'Recent stroke-related admission requiring close home follow-up.',
      dischargeFacility: 'Parirenyatwa Referral Hospital',
      diagnosisSummary: 'Post-stroke recovery with blood pressure, oxygen saturation, and mobility monitoring.',
      medicationChanges: [
        { name: 'Metoprolol', dosage: '25mg twice daily', changeType: 'changed', instructions: 'Monitor dizziness and blood pressure.' },
        { name: 'Aspirin', dosage: '75mg daily', changeType: 'started', instructions: 'Confirm adherence during every visit.' }
      ],
      redFlags: ['New weakness or slurred speech', 'Oxygen saturation below 90%', 'Any new fall during transfers'],
      followUpTasks: buildTransitionTaskPayload([
        { title: 'Clinician review medication changes', description: 'Confirm blood pressure plan.', ownerRole: 'clinician', dueDate: daysAgo(-2), priority: 'high', status: 'pending' },
        { title: 'CHW home visit and functional reassessment', description: 'Repeat mobility and home safety review.', ownerRole: 'chw', dueDate: daysAgo(-1), priority: 'urgent', status: 'pending' }
      ], daysAgo(5)),
      checkpoints: buildDefaultTransitionCheckpoints(daysAgo(5), { day7: { status: 'pending' }, day14: { status: 'pending' }, day30: { status: 'pending' } }),
      nextReviewDate: daysAgo(-2),
      lastContactAt: hoursAgo(18),
      createdAt: daysAgo(5),
      updatedAt: baseNow
    },
    {
      _id: ids.transitions[1],
      transitionId: 'TRN-2026-00002',
      patient: ids.patients[3],
      createdBy: ids.clinicianGeriatrics,
      assignedCaregiver: ids.caregiverSouth,
      assignedCHW: ids.chwBulawayo,
      assignedClinician: ids.clinicianGeriatrics,
      status: 'active',
      transitionType: 'post_acute',
      dischargeDate: daysAgo(12),
      dischargeReason: 'Post-clinic medication adjustment for glycaemic control.',
      dischargeFacility: 'Mpilo Central Hospital Outpatient Clinic',
      diagnosisSummary: 'Type 2 diabetes requiring adherence and foot-care monitoring.',
      medicationChanges: [
        { name: 'Metformin', dosage: '500mg daily', changeType: 'continued', instructions: 'Take after breakfast.' }
      ],
      redFlags: ['Foot wound', 'Missed meals with medication', 'Dizziness or weakness'],
      followUpTasks: buildTransitionTaskPayload([
        { title: 'Caregiver confirm diet plan', description: 'Review meal and medication timing.', ownerRole: 'caregiver', dueDate: daysAgo(-4), priority: 'medium', status: 'pending' }
      ], daysAgo(12)),
      checkpoints: buildDefaultTransitionCheckpoints(daysAgo(12), { day7: { status: 'completed', completedAt: daysAgo(5), completedBy: ids.chwBulawayo } }),
      nextReviewDate: daysAgo(-5),
      lastContactAt: daysAgo(1),
      createdAt: daysAgo(12),
      updatedAt: baseNow
    }
  ];

  const auditLogs = [
    buildAuditLog(makeStampedId('AUD', 1), AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.adminPrimary, 'admin@chengeto.health', 'admin'), { type: 'user', id: ids.adminPrimary, model: 'User', description: 'Admin login' }, { message: 'Administrator reviewed deployment health.' }, hoursAgo(12)),
    buildAuditLog(makeStampedId('AUD', 2), AUDIT_ACTIONS.PATIENT_CREATE, 'patient_management', actor(ids.adminPrimary, 'admin@chengeto.health', 'admin'), { type: 'patient', id: ids.patients[0], model: 'Patient', description: 'Patient enrolled' }, { message: 'Seeded patient profile.' }, daysAgo(18)),
    buildAuditLog(makeStampedId('AUD', 3), AUDIT_ACTIONS.DEVICE_REGISTER, 'device', actor(ids.adminPrimary, 'admin@chengeto.health', 'admin'), { type: 'device', id: ids.devices[0], model: 'IoTDevice', description: 'PM-001' }, { message: 'Wearable provisioned.' }, daysAgo(17)),
    buildAuditLog(makeStampedId('AUD', 4), AUDIT_ACTIONS.CHECKIN_CREATE, 'checkin', actor(ids.caregiverNorth, 'caregiver1@example.com', 'caregiver'), { type: 'checkin', id: ids.checkins[0], model: 'CheckIn', description: 'Morning check-in' }, { message: 'Routine visit completed.' }, hoursAgo(5.5)),
    buildAuditLog(makeStampedId('AUD', 5), AUDIT_ACTIONS.ALERT_TRIGGER, 'alert', actor(ids.adminOperations, 'ops-admin@chengeto.health', 'admin'), { type: 'alert', id: ids.alerts[0], model: 'Alert', description: 'Critical vitals alert' }, { message: 'Telemetry anomaly created alert.' }, minutesAgo(36)),
    buildAuditLog(makeStampedId('AUD', 6), AUDIT_ACTIONS.ALERT_ESCALATE, 'alert', actor(ids.caregiverNorth, 'caregiver1@example.com', 'caregiver'), { type: 'alert', id: ids.alerts[0], model: 'Alert', description: 'Escalated to clinician' }, { message: 'Escalated after persistent abnormal readings.' }, minutesAgo(20)),
    buildAuditLog(makeStampedId('AUD', 7), AUDIT_ACTIONS.DATA_ACCESS, 'data_access', actor(ids.clinicianRehab, 'clinician2@chengeto.health', 'clinician'), { type: 'patient', id: ids.patients[2], model: 'Patient', description: 'Critical patient review' }, { message: 'Clinician opened patient record.' }, minutesAgo(15)),
    buildAuditLog(makeStampedId('AUD', 8), AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.familyMoyo, 'family1@example.com', 'family'), { type: 'user', id: ids.familyMoyo, model: 'User', description: 'Family portal login' }, { message: 'Family member accessed dashboard.' }, daysAgo(2)),
    buildAuditLog(makeStampedId('AUD', 9), AUDIT_ACTIONS.SCHEDULE_CHANGE, 'system', actor(ids.adminOperations, 'ops-admin@chengeto.health', 'admin'), { type: 'schedule', id: ids.schedules[3], model: 'CareSchedule', description: 'Diabetes care plan' }, { message: 'Created care schedule with medication reminders.' }, daysAgo(10)),
    buildAuditLog(makeStampedId('AUD', 10), AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.auditorClinical, 'auditor@chengeto.health', 'auditor'), { type: 'user', id: ids.auditorClinical, model: 'User', description: 'Audit portal login' }, { message: 'Auditor exported oversight metrics.' }, daysAgo(5))
  ];

  return {
    users: staffUsers,
    patients,
    devices,
    telemetry,
    checkins,
    alerts,
    schedules,
    transitions,
    auditLogs
  };
}

async function purgeEntity(entity) {
  const Model = MODEL_BY_ENTITY[entity];
  if (entity === 'auditLogs') {
    await Model.collection.deleteMany({});
    return;
  }
  await Model.deleteMany({});
}

async function replaceEntityDocuments(entity, docs) {
  const Model = MODEL_BY_ENTITY[entity];

  if (!docs || docs.length === 0) {
    return;
  }

  const ids = docs.map((doc) => doc._id).filter(Boolean);

  if (ids.length > 0) {
    if (entity === 'auditLogs') {
      await Model.collection.deleteMany({ _id: { $in: ids } });
    } else {
      await Model.deleteMany({ _id: { $in: ids } });
    }
  }

  if (entity === 'auditLogs') {
    await Model.create(docs);
    return;
  }

  await Model.create(docs);
}

async function collectCounts(entities) {
  const counts = {};
  for (const entity of entities) {
    counts[entity] = await MODEL_BY_ENTITY[entity].countDocuments();
  }
  return counts;
}

function printEntityList() {
  console.log('Available seed entities:');
  for (const entity of ENTITY_ORDER) {
    const deps = ENTITY_DEPENDENCIES[entity];
    console.log(`- ${entity}${deps.length ? ` (depends on: ${deps.join(', ')})` : ''}`);
  }
}

export const getQualitySeedOptionsFromEnv = (env = process.env) => {
  const rawMode = String(env.QUALITY_SEED_MODE || '').trim().toLowerCase();
  const mode = rawMode === 'apply' ? 'apply' : rawMode === 'dry-run' ? 'dry-run' : 'off';

  return {
    mode,
    selectedEntities: parseEntitySelection(env.QUALITY_SEED_ENTITIES),
    fresh: toBoolean(env.QUALITY_SEED_FRESH),
    writeSummary: !toBoolean(env.QUALITY_SEED_SILENT)
  };
};

export async function runQualitySeed(options = {}) {
  const resolvedOptions = {
    mode: options.mode || 'dry-run',
    selectedEntities: options.selectedEntities || null,
    fresh: Boolean(options.fresh),
    writeSummary: options.writeSummary !== false
  };

  if (!['dry-run', 'apply'].includes(resolvedOptions.mode)) {
    throw new Error(`Unsupported quality seed mode: ${resolvedOptions.mode}`);
  }

  const entities = resolveEntities(resolvedOptions.selectedEntities);
  const dataset = buildSeedDataset();
  const plannedCounts = Object.fromEntries(entities.map((entity) => [entity, dataset[entity]?.length || 0]));
  const existingCounts = await collectCounts(entities);
  const report = {
    dryRun: resolvedOptions.mode !== 'apply',
    entities,
    fresh: resolvedOptions.fresh,
    plannedCounts,
    existingCounts
  };

  if (resolvedOptions.mode !== 'apply') {
    return { report, applied: null };
  }

  if (resolvedOptions.fresh) {
    for (const entity of [...entities].reverse()) {
      await purgeEntity(entity);
    }
  }

  for (const entity of entities) {
    await replaceEntityDocuments(entity, dataset[entity]);
  }

  const resultingCounts = await collectCounts(entities);

  return {
    report,
    applied: {
      counts: resultingCounts
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.listEntities) {
    printEntityList();
    return;
  }

  const entities = resolveEntities(args.entities);

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log(`Seeding entities: ${entities.join(', ')}`);

  const seedResult = await runQualitySeed({
    mode: 'apply',
    selectedEntities: args.entities,
    fresh: args.fresh
  });
  const counts = seedResult.applied?.counts || {};

  console.log('Quality seed data applied successfully');
  console.log(JSON.stringify(counts, null, 2));
  console.log('Seeded demo principals: admin@chengeto.health, caregiver1@example.com, caregiver2@example.com, chw1@chengeto.health, chw2@chengeto.health, clinician2@chengeto.health');
  console.log('Use DEMO_PASSWORD from the secure runtime environment when validating seeded accounts.');
  console.log('Use --entities=users,patients or --entities=alerts and --fresh for entity-by-entity reseeding.');
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main()
    .then(async () => {
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error('Database seeding failed:', error);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}

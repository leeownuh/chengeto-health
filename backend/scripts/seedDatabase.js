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
  const patientCount = 24;
  const ids = {
    adminPrimary: oid(),
    adminOperations: oid(),
    auditorClinical: oid(),
    auditorOps: oid(),
    chws: Array.from({ length: 4 }, () => oid()),
    caregivers: Array.from({ length: 6 }, () => oid()),
    clinicians: Array.from({ length: 4 }, () => oid()),
    families: Array.from({ length: 12 }, () => oid()),
    patients: Array.from({ length: patientCount }, () => oid()),
    devices: Array.from({ length: patientCount }, () => oid())
  };

  const actor = (id, email, role) => ({ userId: id, email, role });

  const districtDirectory = {
    borrowdale: { district: 'Borrowdale', province: 'Harare', ward: 'Ward 16', region: 'north', coords: { latitude: -17.788, longitude: 31.053 } },
    chitungwiza: { district: 'Chitungwiza', province: 'Harare', ward: 'Ward 4', region: 'north', coords: { latitude: -18.012, longitude: 31.075 } },
    epworth: { district: 'Epworth', province: 'Harare', ward: 'Ward 6', region: 'north', coords: { latitude: -17.890, longitude: 31.147 } },
    mbare: { district: 'Mbare', province: 'Harare', ward: 'Ward 12', region: 'north', coords: { latitude: -17.870, longitude: 31.045 } },
    hillside: { district: 'Hillside', province: 'Bulawayo', ward: 'Ward 7', region: 'south', coords: { latitude: -20.149, longitude: 28.596 } },
    luveve: { district: 'Luveve', province: 'Bulawayo', ward: 'Ward 15', region: 'south', coords: { latitude: -20.188, longitude: 28.545 } },
    nkulumane: { district: 'Nkulumane', province: 'Bulawayo', ward: 'Ward 18', region: 'south', coords: { latitude: -20.191, longitude: 28.536 } },
    cowdray: { district: 'Cowdray Park', province: 'Bulawayo', ward: 'Ward 28', region: 'south', coords: { latitude: -20.220, longitude: 28.486 } },
    murambi: { district: 'Murambi', province: 'Manicaland', ward: 'Ward 5', region: 'east', coords: { latitude: -18.970, longitude: 32.670 } },
    sakubva: { district: 'Sakubva', province: 'Manicaland', ward: 'Ward 3', region: 'east', coords: { latitude: -18.997, longitude: 32.658 } },
    dangamvura: { district: 'Dangamvura', province: 'Manicaland', ward: 'Ward 8', region: 'east', coords: { latitude: -18.954, longitude: 32.632 } },
    chipinge: { district: 'Chipinge', province: 'Manicaland', ward: 'Ward 11', region: 'east', coords: { latitude: -20.188, longitude: 32.623 } },
    mucheke: { district: 'Mucheke', province: 'Masvingo', ward: 'Ward 10', region: 'central', coords: { latitude: -20.063, longitude: 30.823 } },
    rujeko: { district: 'Rujeko', province: 'Masvingo', ward: 'Ward 7', region: 'central', coords: { latitude: -20.082, longitude: 30.838 } },
    mkoba: { district: 'Mkoba', province: 'Midlands', ward: 'Ward 9', region: 'central', coords: { latitude: -19.462, longitude: 29.811 } },
    gweru: { district: 'Gweru', province: 'Midlands', ward: 'Ward 1', region: 'central', coords: { latitude: -19.450, longitude: 29.817 } }
  };

  const archetypes = {
    hypertension: {
      riskLevel: 'moderate',
      summary: 'Blood pressure monitoring with medication adherence support.',
      condition: 'Hypertension',
      medication: 'Amlodipine',
      dosage: '5mg',
      unit: 'mg',
      frequency: 'Daily',
      heartRate: 79,
      oxygen: 97,
      systolic: 136,
      diastolic: 84,
      temperature: 36.7,
      battery: 82,
      mobility: 'assisted',
      gait: 'slow',
      balance: 'needs_support',
      assistiveDevice: 'cane',
      frailty: 'pre_frail'
    },
    diabetes: {
      riskLevel: 'high',
      summary: 'Glycaemic control, foot-care review, and nutrition adherence required.',
      condition: 'Type 2 Diabetes',
      medication: 'Metformin',
      dosage: '500mg',
      unit: 'mg',
      frequency: 'Twice daily',
      heartRate: 88,
      oxygen: 95,
      systolic: 145,
      diastolic: 89,
      temperature: 36.8,
      battery: 71,
      mobility: 'independent',
      gait: 'steady',
      balance: 'stable',
      assistiveDevice: 'none',
      frailty: 'pre_frail'
    },
    copd: {
      riskLevel: 'high',
      summary: 'Respiratory support, inhaler adherence, and mobility pacing needed.',
      condition: 'COPD',
      medication: 'Salbutamol Inhaler',
      dosage: '2 puffs',
      unit: 'puffs',
      frequency: 'As needed',
      heartRate: 92,
      oxygen: 91,
      systolic: 139,
      diastolic: 86,
      temperature: 36.9,
      battery: 67,
      mobility: 'assisted',
      gait: 'unsteady',
      balance: 'needs_support',
      assistiveDevice: 'walker',
      frailty: 'frail'
    },
    stroke: {
      riskLevel: 'critical',
      summary: 'Post-stroke recovery with elevated vitals and transfer support needs.',
      condition: 'Stroke Recovery',
      medication: 'Metoprolol',
      dosage: '25mg',
      unit: 'mg',
      frequency: 'Twice daily',
      heartRate: 121,
      oxygen: 88,
      systolic: 159,
      diastolic: 97,
      temperature: 37.8,
      battery: 44,
      mobility: 'wheelchair',
      gait: 'shuffling',
      balance: 'unstable',
      assistiveDevice: 'wheelchair',
      frailty: 'frail'
    },
    heartFailure: {
      riskLevel: 'critical',
      summary: 'Fluid balance, cardiac rhythm, and shortness-of-breath surveillance required.',
      condition: 'Congestive Heart Failure',
      medication: 'Furosemide',
      dosage: '40mg',
      unit: 'mg',
      frequency: 'Daily',
      heartRate: 116,
      oxygen: 90,
      systolic: 151,
      diastolic: 92,
      temperature: 36.9,
      battery: 52,
      mobility: 'assisted',
      gait: 'slow',
      balance: 'needs_support',
      assistiveDevice: 'walker',
      frailty: 'frail'
    },
    ckd: {
      riskLevel: 'high',
      summary: 'Renal monitoring with medication review and hydration oversight.',
      condition: 'Chronic Kidney Disease',
      medication: 'Losartan',
      dosage: '50mg',
      unit: 'mg',
      frequency: 'Daily',
      heartRate: 86,
      oxygen: 95,
      systolic: 148,
      diastolic: 90,
      temperature: 36.7,
      battery: 64,
      mobility: 'assisted',
      gait: 'slow',
      balance: 'needs_support',
      assistiveDevice: 'cane',
      frailty: 'frail'
    },
    dementia: {
      riskLevel: 'high',
      summary: 'Cognitive prompts, wander-risk supervision, and caregiver coordination needed.',
      condition: 'Dementia',
      medication: 'Donepezil',
      dosage: '10mg',
      unit: 'mg',
      frequency: 'Nightly',
      heartRate: 76,
      oxygen: 97,
      systolic: 132,
      diastolic: 80,
      temperature: 36.5,
      battery: 74,
      mobility: 'assisted',
      gait: 'slow',
      balance: 'stable',
      assistiveDevice: 'cane',
      frailty: 'pre_frail'
    },
    arthritis: {
      riskLevel: 'moderate',
      summary: 'Pain management, mobility support, and social engagement prompts.',
      condition: 'Osteoarthritis',
      medication: 'Paracetamol',
      dosage: '1g',
      unit: 'g',
      frequency: 'Twice daily',
      heartRate: 75,
      oxygen: 98,
      systolic: 130,
      diastolic: 81,
      temperature: 36.4,
      battery: 78,
      mobility: 'assisted',
      gait: 'slow',
      balance: 'needs_support',
      assistiveDevice: 'cane',
      frailty: 'pre_frail'
    },
    parkinsons: {
      riskLevel: 'high',
      summary: 'Tremor variability, medication timing, and fall prevention oversight needed.',
      condition: 'Parkinsonism',
      medication: 'Levodopa',
      dosage: '100mg',
      unit: 'mg',
      frequency: 'Three times daily',
      heartRate: 82,
      oxygen: 96,
      systolic: 137,
      diastolic: 84,
      temperature: 36.6,
      battery: 69,
      mobility: 'assisted',
      gait: 'shuffling',
      balance: 'needs_support',
      assistiveDevice: 'walker',
      frailty: 'frail'
    },
    asthma: {
      riskLevel: 'moderate',
      summary: 'Inhaler adherence and exertional breathing surveillance.',
      condition: 'Asthma',
      medication: 'Budesonide Inhaler',
      dosage: '2 puffs',
      unit: 'puffs',
      frequency: 'Twice daily',
      heartRate: 80,
      oxygen: 94,
      systolic: 129,
      diastolic: 79,
      temperature: 36.6,
      battery: 76,
      mobility: 'independent',
      gait: 'steady',
      balance: 'stable',
      assistiveDevice: 'none',
      frailty: 'pre_frail'
    },
    fractureRehab: {
      riskLevel: 'moderate',
      summary: 'Rehabilitation progress and transfer-safety monitoring.',
      condition: 'Hip Fracture Recovery',
      medication: 'Ibuprofen',
      dosage: '400mg',
      unit: 'mg',
      frequency: 'Daily',
      heartRate: 84,
      oxygen: 96,
      systolic: 134,
      diastolic: 82,
      temperature: 36.7,
      battery: 73,
      mobility: 'assisted',
      gait: 'unsteady',
      balance: 'needs_support',
      assistiveDevice: 'walker',
      frailty: 'pre_frail'
    },
    depression: {
      riskLevel: 'moderate',
      summary: 'Social isolation, appetite, and adherence follow-up required.',
      condition: 'Depression with frailty',
      medication: 'Sertraline',
      dosage: '50mg',
      unit: 'mg',
      frequency: 'Daily',
      heartRate: 78,
      oxygen: 97,
      systolic: 128,
      diastolic: 78,
      temperature: 36.5,
      battery: 80,
      mobility: 'independent',
      gait: 'steady',
      balance: 'stable',
      assistiveDevice: 'none',
      frailty: 'pre_frail'
    }
  };

  const clinicianDefs = [
    { _id: ids.clinicians[0], email: 'clinician1@chengeto.health', firstName: 'Dr. Farai', lastName: 'Mlambo', phone: '+263771000031', specializations: ['Geriatrics'], qualification: 'MBChB, MMed Geriatrics' },
    { _id: ids.clinicians[1], email: 'clinician2@chengeto.health', firstName: 'Dr. Chipo', lastName: 'Mushonga', phone: '+263771000032', specializations: ['Rehabilitation Medicine', 'Stroke follow-up'], qualification: 'MBChB, Rehabilitation Fellowship' },
    { _id: ids.clinicians[2], email: 'clinician3@chengeto.health', firstName: 'Dr. Rudo', lastName: 'Sithole', phone: '+263771000033', specializations: ['Cardiometabolic Care'], qualification: 'MBChB, Internal Medicine' },
    { _id: ids.clinicians[3], email: 'clinician4@chengeto.health', firstName: 'Dr. Tawanda', lastName: 'Hove', phone: '+263771000034', specializations: ['Family Medicine', 'Respiratory Care'], qualification: 'MBChB, Family Medicine' }
  ];

  const chwDefs = [
    { _id: ids.chws[0], email: 'chw1@chengeto.health', firstName: 'Nyasha', lastName: 'Mukamuri', phone: '+263771000011', ward: 'Ward 16', district: 'Harare', qualification: 'CHW Certificate', specialization: 'Community follow-up' },
    { _id: ids.chws[1], email: 'chw2@chengeto.health', firstName: 'Sipho', lastName: 'Ncube', phone: '+263771000012', ward: 'Ward 7', district: 'Bulawayo', qualification: 'Community Rehabilitation Certificate', specialization: 'Home safety reviews' },
    { _id: ids.chws[2], email: 'chw3@chengeto.health', firstName: 'Loveness', lastName: 'Gumbo', phone: '+263771000013', ward: 'Ward 5', district: 'Mutare', qualification: 'CHW Certificate', specialization: 'Post-discharge follow-up' },
    { _id: ids.chws[3], email: 'chw4@chengeto.health', firstName: 'Bhekinkosi', lastName: 'Moyo', phone: '+263771000014', ward: 'Ward 10', district: 'Masvingo', qualification: 'CHW Diploma', specialization: 'Longitudinal chronic-care visits' }
  ];

  const caregiverDefs = [
    { _id: ids.caregivers[0], email: 'caregiver1@example.com', firstName: 'Tariro', lastName: 'Moyo', phone: '+263771000021', isPrimaryCaregiver: true, specializations: ['Medication adherence', 'Mobility support'], certificationNumber: 'CG-2026-001' },
    { _id: ids.caregivers[1], email: 'caregiver2@example.com', firstName: 'Rumbidzai', lastName: 'Dube', phone: '+263771000022', isPrimaryCaregiver: false, specializations: ['Respiratory support', 'Fall recovery observation'], certificationNumber: 'CG-2026-002' },
    { _id: ids.caregivers[2], email: 'caregiver3@chengeto.health', firstName: 'Tatenda', lastName: 'Chari', phone: '+263771000023', isPrimaryCaregiver: true, specializations: ['Dementia prompts', 'Family coordination'], certificationNumber: 'CG-2026-003' },
    { _id: ids.caregivers[3], email: 'caregiver4@chengeto.health', firstName: 'Fadzai', lastName: 'Nkomo', phone: '+263771000024', isPrimaryCaregiver: true, specializations: ['Diabetes coaching', 'Nutrition adherence'], certificationNumber: 'CG-2026-004' },
    { _id: ids.caregivers[4], email: 'caregiver5@chengeto.health', firstName: 'Memory', lastName: 'Chitiyo', phone: '+263771000025', isPrimaryCaregiver: true, specializations: ['Post-stroke home care', 'Transfer support'], certificationNumber: 'CG-2026-005' },
    { _id: ids.caregivers[5], email: 'caregiver6@chengeto.health', firstName: 'Mandla', lastName: 'Sibanda', phone: '+263771000026', isPrimaryCaregiver: true, specializations: ['Rural follow-up', 'Rehabilitation support'], certificationNumber: 'CG-2026-006' }
  ];

  const familyDefs = [
    { _id: ids.families[0], email: 'family1@example.com', firstName: 'Kudzai', lastName: 'Moyo' },
    { _id: ids.families[1], email: 'family2@example.com', firstName: 'Thabiso', lastName: 'Ndlovu' },
    { _id: ids.families[2], email: 'family3@chengeto.health', firstName: 'Mildred', lastName: 'Dube' },
    { _id: ids.families[3], email: 'family4@chengeto.health', firstName: 'Rutendo', lastName: 'Sibanda' },
    { _id: ids.families[4], email: 'family5@chengeto.health', firstName: 'Eliah', lastName: 'Mutasa' },
    { _id: ids.families[5], email: 'family6@chengeto.health', firstName: 'Tafadzwa', lastName: 'Mhlanga' },
    { _id: ids.families[6], email: 'family7@chengeto.health', firstName: 'Ropafadzo', lastName: 'Chiwenga' },
    { _id: ids.families[7], email: 'family8@chengeto.health', firstName: 'Nhlanhla', lastName: 'Ncube' },
    { _id: ids.families[8], email: 'family9@chengeto.health', firstName: 'Vimbai', lastName: 'Gumbo' },
    { _id: ids.families[9], email: 'family10@chengeto.health', firstName: 'Innocent', lastName: 'Mpofu' },
    { _id: ids.families[10], email: 'family11@chengeto.health', firstName: 'Makanaka', lastName: 'Chikore' },
    { _id: ids.families[11], email: 'family12@chengeto.health', firstName: 'Sanelisiwe', lastName: 'Moyo' }
  ];

  const regionTeams = {
    north: { chws: [chwDefs[0]], caregivers: [caregiverDefs[0], caregiverDefs[2]], clinicians: [clinicianDefs[0], clinicianDefs[2]] },
    south: { chws: [chwDefs[1]], caregivers: [caregiverDefs[1], caregiverDefs[3]], clinicians: [clinicianDefs[0], clinicianDefs[3]] },
    east: { chws: [chwDefs[2]], caregivers: [caregiverDefs[4]], clinicians: [clinicianDefs[1], clinicianDefs[2]] },
    central: { chws: [chwDefs[3]], caregivers: [caregiverDefs[5]], clinicians: [clinicianDefs[1], clinicianDefs[3]] }
  };

  const patientBlueprints = [
    { firstName: 'Chengetai', lastName: 'Moyo', gender: 'female', dob: '1948-06-12', districtKey: 'borrowdale', archetype: 'hypertension' },
    { firstName: 'Tendai', lastName: 'Ndlovu', gender: 'male', dob: '1951-11-03', districtKey: 'hillside', archetype: 'copd' },
    { firstName: 'Rutendo', lastName: 'Chiwenga', gender: 'female', dob: '1944-01-27', districtKey: 'murambi', archetype: 'stroke' },
    { firstName: 'Josiah', lastName: 'Dube', gender: 'male', dob: '1947-09-16', districtKey: 'luveve', archetype: 'diabetes' },
    { firstName: 'Agnes', lastName: 'Sibanda', gender: 'female', dob: '1942-03-08', districtKey: 'chitungwiza', archetype: 'arthritis' },
    { firstName: 'Jabulani', lastName: 'Mhlanga', gender: 'male', dob: '1940-12-02', districtKey: 'cowdray', archetype: 'heartFailure' },
    { firstName: 'Memory', lastName: 'Mutasa', gender: 'female', dob: '1946-04-15', districtKey: 'sakubva', archetype: 'dementia' },
    { firstName: 'Petros', lastName: 'Gumbo', gender: 'male', dob: '1950-08-24', districtKey: 'mucheke', archetype: 'ckd' },
    { firstName: 'Sibusisiwe', lastName: 'Nkomo', gender: 'female', dob: '1955-02-11', districtKey: 'nkulumane', archetype: 'asthma' },
    { firstName: 'Obert', lastName: 'Mpofu', gender: 'male', dob: '1949-07-09', districtKey: 'epworth', archetype: 'parkinsons' },
    { firstName: 'Rudo', lastName: 'Chari', gender: 'female', dob: '1943-10-18', districtKey: 'rujeko', archetype: 'fractureRehab' },
    { firstName: 'Themba', lastName: 'Moyo', gender: 'male', dob: '1952-03-14', districtKey: 'gweru', archetype: 'depression' },
    { firstName: 'Nyasha', lastName: 'Sithole', gender: 'female', dob: '1945-05-22', districtKey: 'mbare', archetype: 'hypertension' },
    { firstName: 'Farai', lastName: 'Ncube', gender: 'male', dob: '1941-01-30', districtKey: 'mkoba', archetype: 'heartFailure' },
    { firstName: 'Mavis', lastName: 'Chikore', gender: 'female', dob: '1947-12-27', districtKey: 'dangamvura', archetype: 'diabetes' },
    { firstName: 'Abel', lastName: 'Hove', gender: 'male', dob: '1953-09-02', districtKey: 'chipinge', archetype: 'ckd' },
    { firstName: 'Tsitsi', lastName: 'Mlambo', gender: 'female', dob: '1946-06-06', districtKey: 'borrowdale', archetype: 'dementia' },
    { firstName: 'Bhekinkosi', lastName: 'Dlamini', gender: 'male', dob: '1944-11-19', districtKey: 'luveve', archetype: 'copd' },
    { firstName: 'Nomsa', lastName: 'Muchengeti', gender: 'female', dob: '1950-01-08', districtKey: 'murambi', archetype: 'stroke' },
    { firstName: 'Tafadzwa', lastName: 'Mare', gender: 'male', dob: '1948-08-28', districtKey: 'mucheke', archetype: 'parkinsons' },
    { firstName: 'Loveness', lastName: 'Chibanda', gender: 'female', dob: '1954-10-05', districtKey: 'chitungwiza', archetype: 'arthritis' },
    { firstName: 'Witness', lastName: 'Sibeko', gender: 'male', dob: '1943-02-13', districtKey: 'cowdray', archetype: 'fractureRehab' },
    { firstName: 'Tariro', lastName: 'Mukoni', gender: 'female', dob: '1949-04-29', districtKey: 'sakubva', archetype: 'asthma' },
    { firstName: 'Elton', lastName: 'Zhou', gender: 'male', dob: '1951-07-17', districtKey: 'gweru', archetype: 'depression' }
  ];

  const patientConfigs = patientBlueprints.map((blueprint, index) => {
    const district = districtDirectory[blueprint.districtKey];
    const profile = archetypes[blueprint.archetype];
    const family = familyDefs[Math.floor(index / 2)];
    const team = regionTeams[district.region];
    const caregiver = team.caregivers[index % team.caregivers.length];
    const chw = team.chws[index % team.chws.length];
    const clinician = team.clinicians[index % team.clinicians.length];
    const batteryAdjustment = (index % 5) * 6;
    const battery = Math.max(34, Math.min(92, profile.battery - batteryAdjustment + (index % 3) * 4));

    return {
      _id: ids.patients[index],
      deviceId: `PM-${String(index + 1).padStart(3, '0')}`,
      patientId: `CHG-2026-${String(index + 1).padStart(5, '0')}`,
      firstName: blueprint.firstName,
      lastName: blueprint.lastName,
      gender: blueprint.gender,
      dob: new Date(`${blueprint.dob}T00:00:00Z`),
      phone: `+2637711${String(index + 1).padStart(5, '0')}`,
      district: district.district,
      province: district.province,
      ward: district.ward,
      region: district.region,
      coords: district.coords,
      riskLevel: profile.riskLevel,
      summary: profile.summary,
      condition: profile.condition,
      medication: profile.medication,
      dosage: profile.dosage,
      unit: profile.unit,
      frequency: profile.frequency,
      battery,
      heartRate: profile.heartRate + (index % 4) - 1,
      oxygen: profile.oxygen - (index % 2),
      systolic: profile.systolic + (index % 3) * 2,
      diastolic: profile.diastolic + (index % 2),
      temperature: Number((profile.temperature + ((index % 3) * 0.1)).toFixed(1)),
      caregiverId: caregiver._id,
      caregiverEmail: caregiver.email,
      chwId: chw._id,
      chwEmail: chw.email,
      clinicianId: clinician._id,
      clinicianEmail: clinician.email,
      familyIds: [family._id],
      familyEmail: family.email,
      functionalBaseline: {
        mobility: profile.mobility,
        gait: profile.gait,
        balance: profile.balance,
        assistiveDevice: profile.assistiveDevice,
        vision: index % 4 === 0 ? 'impaired' : 'adequate',
        hearing: index % 5 === 0 ? 'impaired' : 'adequate',
        continence: index % 6 === 0 ? 'occasional_issues' : 'independent',
        weightLossRisk: profile.riskLevel === 'critical' ? 'high' : profile.riskLevel === 'high' ? 'moderate' : 'low',
        frailty: profile.frailty,
        homeSafety: profile.riskLevel === 'critical' ? 'unsafe' : index % 3 === 0 ? 'needs_minor_changes' : 'safe',
        recentFalls: {
          count: profile.riskLevel === 'critical' ? 2 + (index % 2) : index % 4 === 0 ? 1 : 0,
          lastFallAt: profile.riskLevel === 'critical' ? daysAgo(12 + index) : index % 4 === 0 ? daysAgo(45 + index) : null,
          injuryFromLastFall: profile.riskLevel === 'critical'
        },
        notes: `${profile.condition} follow-up coordinated through ${district.district}.`
      }
    };
  });

  const patientsByUser = (userId, field) => patientConfigs.filter((patient) => String(patient[field]) === String(userId)).map((patient) => patient._id);

  const familyUsers = familyDefs.map((family, index) => {
    const linkedPatients = patientConfigs
      .filter((patient) => patient.familyIds.includes(family._id))
      .map((patient, patientIndex) => ({
        patient: patient._id,
        relationship: patientIndex === 0 ? 'child' : 'relative',
        accessLevel: patientIndex === 0 ? 'full' : 'limited'
      }));

    return {
      _id: family._id,
      email: family.email,
      password: DEMO_PASSWORD,
      firstName: family.firstName,
      lastName: family.lastName,
      phone: `+2637710000${String(41 + index).padStart(2, '0')}`,
      role: 'family',
      permissions: rolePermissions.family,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      linkedPatients,
      lastLogin: { timestamp: daysAgo(1 + (index % 5)), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(15 + index),
      updatedAt: baseNow
    };
  });

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
      createdAt: daysAgo(60),
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
      qualification: 'Health Informatics MSc',
      specialization: 'Operational oversight',
      lastLogin: { timestamp: hoursAgo(7), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(54),
      updatedAt: baseNow
    },
    ...chwDefs.map((chw, index) => ({
      ...chw,
      password: DEMO_PASSWORD,
      role: 'chw',
      permissions: rolePermissions.chw,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      assignedPatients: patientsByUser(chw._id, 'chwId'),
      lastLogin: { timestamp: hoursAgo(6 + index * 2), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(36 - index * 2),
      updatedAt: baseNow
    })),
    ...caregiverDefs.map((caregiver, index) => ({
      ...caregiver,
      password: DEMO_PASSWORD,
      role: 'caregiver',
      permissions: rolePermissions.caregiver,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      assignedPatients: patientsByUser(caregiver._id, 'caregiverId'),
      lastLogin: { timestamp: hoursAgo(2 + index), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(28 - index),
      updatedAt: baseNow
    })),
    ...clinicianDefs.map((clinician, index) => ({
      ...clinician,
      password: DEMO_PASSWORD,
      role: 'clinician',
      permissions: rolePermissions.clinician,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      phoneVerified: true,
      lastLogin: { timestamp: hoursAgo(5 + index * 3), ipAddress: '127.0.0.1', userAgent: 'Quality seed' },
      createdAt: daysAgo(40 - index),
      updatedAt: baseNow
    })),
    ...familyUsers,
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
      createdAt: daysAgo(50),
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
      createdAt: daysAgo(52),
      updatedAt: baseNow
    }
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
      ward: patient.ward,
      district: patient.district,
      province: patient.province,
      country: 'Zimbabwe',
      coordinates: patient.coords
    },
    medicalSummary: patient.summary,
    medicalConditions: [{ condition: patient.condition, diagnosedDate: daysAgo(420 + index * 4), status: 'active' }],
    allergies: [{ allergen: 'None known', severity: 'mild', reaction: 'No recorded allergy' }],
    currentMedications: [
      {
        name: patient.medication,
        dosage: patient.dosage,
        unit: patient.unit,
        frequency: patient.frequency,
        startDate: daysAgo(480 - index * 3),
        prescribedBy: patient.clinicianEmail.includes('2') ? 'Dr. Mushonga' : patient.clinicianEmail.includes('3') ? 'Dr. Sithole' : patient.clinicianEmail.includes('4') ? 'Dr. Hove' : 'Dr. Mlambo',
        refillDueDate: daysAgo(-7 + (index % 6)),
        refillWindowDays: patient.riskLevel === 'critical' ? 5 : 7,
        adherenceRule: patient.unit === 'puffs' ? 'as_needed' : 'required',
        sideEffectPrompts: patient.condition.includes('Stroke')
          ? ['Dizziness', 'Fatigue']
          : patient.condition.includes('Diabetes')
            ? ['Reduced appetite', 'Stomach upset']
            : ['Headache'],
        confirmationSource: patient.unit === 'puffs' ? 'patient' : 'caregiver'
      }
    ],
    primaryCaregiver: patient.caregiverId,
    assignedCHW: patient.chwId,
    assignedClinician: patient.clinicianId,
    emergencyContacts: [{ name: `${patient.firstName} Family`, relationship: 'child', phone: `+2637722${String(index + 1).padStart(5, '0')}`, isPrimary: true, priority: 1 }],
    familyMembers: patient.familyIds.map((userId, familyIndex) => ({
      user: userId,
      relationship: familyIndex === 0 ? 'child' : 'relative',
      accessLevel: familyIndex === 0 ? 'full' : 'limited',
      approvedAt: daysAgo(30 - index)
    })),
    iotDevice: {
      deviceId: patient.deviceId,
      paired: true,
      pairedAt: daysAgo(22 - (index % 5)),
      lastSeen: minutesAgo(10 + (index % 8) * 7),
      firmwareVersion: patient.riskLevel === 'critical' ? '1.5.0' : '1.4.2',
      batteryLevel: patient.battery,
      status: patient.battery < 45 ? 'maintenance' : 'online'
    },
    status: 'active',
    riskLevel: patient.riskLevel,
    functionalBaseline: patient.functionalBaseline,
    compliance: {
      checkinAdherence: Math.max(68, 94 - (index % 6) * 4),
      medicationAdherence: Math.max(70, 96 - (index % 5) * 5),
      missedCheckins: index % 7 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
      lastCheckin: hoursAgo(1 + (index % 12)),
      consecutiveMissedCheckins: patient.riskLevel === 'critical' ? 1 : 0
    },
    carePlan: {
      goals: [
        { title: 'Maintain medication adherence above 90%', targetDate: daysAgo(-45), status: 'active' },
        { title: 'Reduce unplanned escalations', targetDate: daysAgo(-60), status: 'active' },
        { title: 'Sustain weekly clinician review cadence', targetDate: daysAgo(-30), status: index % 4 === 0 ? 'completed' : 'active' }
      ],
      riskProfile: {
        summary: patient.summary,
        fallRisk: patient.riskLevel === 'critical' ? 'critical' : patient.riskLevel === 'high' ? 'high' : 'moderate',
        medicationRisk: patient.riskLevel === 'critical' ? 'high' : 'moderate',
        cognitiveRisk: ['Dementia', 'Depression with frailty'].includes(patient.condition) ? 'high' : 'low',
        socialRisk: index % 6 === 0 ? 'high' : 'moderate',
        caregiverInstructions: 'Escalate any rapid change in mobility, breathing, vitals, or confusion.'
      },
      visitCadence: {
        frequency: patient.riskLevel === 'critical' ? 'twice-daily' : patient.riskLevel === 'high' ? 'daily' : 'five-times-weekly',
        preferredWindow: index % 2 === 0 ? 'morning' : 'afternoon',
        preferredDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        notes: `Coordinated through ${patient.region} team`
      },
      escalationPreferences: {
        primaryResponderRole: 'caregiver',
        notifyFamily: true,
        notifyClinicianOnHighRisk: true,
        maxResponseMinutes: patient.riskLevel === 'critical' ? 15 : patient.riskLevel === 'high' ? 30 : 45
      },
      consentSettings: {
        familyAccessLevel: 'limited',
        familyUpdates: true,
        emergencySharing: true,
        dataCollection: true
      },
      review: {
        lastReviewedAt: daysAgo(5 + (index % 7)),
        nextReviewDate: daysAgo(-14 + (index % 6)),
        notes: `Quarterly care-plan review due through ${patient.clinicianEmail}.`
      }
    },
    consent: {
      dataCollection: true,
      familyAccess: true,
      emergencyDataSharing: true,
      consentDate: daysAgo(45 - index),
      consentedBy: `${patient.firstName} ${patient.lastName}`,
      consentVersion: '1.1'
    },
    enrolledBy: ids.adminPrimary,
    enrolledAt: daysAgo(80 - index * 2),
    lastUpdatedBy: patient.chwId,
    createdAt: daysAgo(80 - index * 2),
    updatedAt: baseNow
  }));

  const devices = patientConfigs.map((patient, index) => ({
    _id: ids.devices[index],
    deviceId: patient.deviceId,
    serialNumber: `CHG-PM-${202600 + index + 1}`,
    deviceType: 'patient_monitor',
    model: patient.riskLevel === 'critical' ? 'Guardian Pro' : 'Guardian Lite',
    manufacturer: 'CHENGETO Labs',
    firmwareVersion: patient.riskLevel === 'critical' ? '1.5.0' : '1.4.2',
    capabilities: ['heart_rate', 'motion', 'fall_detection', 'location', 'panic_button', 'ble', 'nfc', 'medication_reminders'],
    owner: patient.caregiverId,
    assignedPatient: patient._id,
    assignedCaregiver: patient.caregiverId,
    status: patient.battery < 42 ? 'maintenance' : index % 9 === 0 ? 'inactive' : 'active',
    pairing: {
      isPaired: true,
      pairedAt: daysAgo(70 - index),
      pairingCode: `PAIR-${index + 1}`
    },
    network: {
      bleAddress: `BLE-${index + 1}`,
      nfcId: `NFC-${index + 1}`,
      supportedProtocols: ['mqtt', 'ble', 'nfc']
    },
    connection: {
      online: patient.battery >= 42 && index % 9 !== 0,
      lastOnline: patient.battery < 42 ? minutesAgo(95) : minutesAgo(4 + (index % 6) * 5),
      connectionType: index % 3 === 0 ? 'wifi' : 'cellular',
      signalStrength: -54 - (index % 7) * 3,
      mqttClientId: `device-${index + 1}`
    },
    power: {
      batteryLevel: patient.battery,
      batteryStatus: patient.battery < 42 ? 'low' : 'discharging',
      lastCharged: daysAgo(index % 3),
      estimatedBatteryLife: patient.battery < 42 ? 4 : 26
    },
    provisionedBy: ids.adminPrimary,
    provisionedAt: daysAgo(76 - index),
    activatedAt: daysAgo(74 - index),
    alerts: {
      lowBatteryThreshold: 20,
      offlineAlertThreshold: 30,
      vitalAlertEnabled: true,
      fallAlertEnabled: true,
      inactivityAlertEnabled: true
    },
    createdAt: daysAgo(76 - index),
    updatedAt: baseNow
  }));

  const telemetryOffsets = [30240, 20160, 10080, 4320, 1440, 360, 120, 30];
  const telemetry = patientConfigs.flatMap((patient, index) =>
    telemetryOffsets.map((offset, sampleIndex) => {
      const deterioration = sampleIndex >= telemetryOffsets.length - 2;
      const criticalNow = deterioration && ['critical', 'high'].includes(patient.riskLevel);
      const trend = telemetryOffsets.length - sampleIndex;
      const heartRate = patient.heartRate + (criticalNow ? 6 : 0) - (trend % 5);
      const oxygen = Math.max(84, patient.oxygen - (criticalNow && patient.riskLevel === 'critical' ? 2 : 0) + (sampleIndex % 2));
      const systolic = patient.systolic + (criticalNow ? 4 : 0) - (sampleIndex % 3);
      const diastolic = patient.diastolic + (criticalNow ? 2 : 0) - (sampleIndex % 2);
      const fallDetected = ['stroke', 'fractureRehab', 'parkinsons'].includes(patientBlueprints[index].archetype) && sampleIndex === 6;

      return {
        _id: oid(),
        deviceId: patient.deviceId,
        patient: patient._id,
        timestamp: minutesAgo(offset),
        type: 'vitals',
        heartRate: {
          value: heartRate,
          unit: 'bpm',
          status: criticalNow && heartRate > 112 ? 'abnormal' : 'normal',
          confidence: 93,
          source: 'ppg'
        },
        bloodPressure: {
          systolic: { value: systolic, status: criticalNow && systolic > 150 ? 'abnormal' : 'normal' },
          diastolic: { value: diastolic, status: criticalNow && diastolic > 92 ? 'abnormal' : 'normal' },
          unit: 'mmHg',
          measuredAt: minutesAgo(offset)
        },
        oxygenSaturation: {
          value: oxygen,
          unit: '%',
          status: oxygen <= 89 ? 'critical' : oxygen <= 92 ? 'abnormal' : 'normal'
        },
        temperature: {
          value: Number((patient.temperature + (criticalNow ? 0.4 : 0.1)).toFixed(1)),
          unit: 'C',
          location: 'wrist',
          status: criticalNow && patient.temperature > 37.4 ? 'abnormal' : 'normal'
        },
        motion: {
          detected: true,
          type: fallDetected ? 'falling' : sampleIndex % 3 === 0 ? 'walking' : sampleIndex % 3 === 1 ? 'sitting' : 'lying',
          intensity: fallDetected ? 'high' : sampleIndex % 3 === 0 ? 'medium' : 'low',
          duration: 60 + sampleIndex * 15,
          accelerometer: { x: 0.2, y: 0.3, z: fallDetected ? 2.6 : 0.7 },
          gyroscope: { x: 0.1, y: 0.1, z: fallDetected ? 1.2 : 0.2 }
        },
        fall: {
          detected: fallDetected,
          confidence: fallDetected ? 87 : 0,
          impactForce: fallDetected ? 2.4 : 0,
          fallType: fallDetected ? 'lateral' : 'unknown',
          recoveryDetected: !fallDetected
        },
        inactivity: {
          duration: criticalNow ? 85 : 18 + sampleIndex * 2,
          lastMotionTime: minutesAgo(offset - 5),
          threshold: 240,
          alertTriggered: false
        },
        activity: {
          steps: 900 + sampleIndex * 260 + (index % 4) * 120,
          distance: 650 + sampleIndex * 110,
          calories: 110 + sampleIndex * 18,
          activeMinutes: 18 + sampleIndex * 4,
          sedentaryMinutes: 38
        },
        deviceStatus: {
          batteryLevel: Math.max(18, patient.battery - sampleIndex),
          charging: false,
          signalStrength: -58 - (index % 7) * 2,
          firmwareVersion: patient.riskLevel === 'critical' ? '1.5.0' : '1.4.2',
          lastSync: minutesAgo(offset - 1),
          status: patient.battery < 42 ? 'low_battery' : 'online',
          errors: []
        },
        location: {
          latitude: patient.coords.latitude,
          longitude: patient.coords.longitude,
          accuracy: 8,
          indoor: sampleIndex % 2 === 0,
          zone: sampleIndex % 2 === 0 ? 'home' : 'community'
        },
        processed: true,
        processedAt: minutesAgo(offset - 1),
        alertGenerated: criticalNow && patient.riskLevel === 'critical',
        createdAt: minutesAgo(offset),
        updatedAt: minutesAgo(offset)
      };
    })
  );

  let checkInSeq = 1;
  const checkins = patientConfigs.flatMap((patient, index) => {
    const dayOffsets = [6 + (index % 3), 28 + (index % 5), 74 + (index % 4), 150 + (index % 6)];
    const completedToday = index < 14;

    return dayOffsets.map((hourOffset, sampleIndex) => {
      const isToday = sampleIndex === 0 && completedToday;
      const isLate = sampleIndex === 1 && index % 5 === 0;
      const actual = isToday ? hoursAgo(1 + (index % 8)) : hoursAgo(hourOffset);
      const scheduled = isToday ? hoursAgo(1.4 + (index % 8)) : hoursAgo(hourOffset + 0.6);
      const overallStatus = patient.riskLevel === 'critical' && sampleIndex === 0 ? 'poor' : index % 6 === 0 ? 'fair' : 'good';
      const alertish = ['critical', 'high'].includes(patient.riskLevel) && sampleIndex === 0;

      return {
        _id: oid(),
        checkinId: makeStampedId('CHK', checkInSeq++),
        patient: patient._id,
        caregiver: patient.caregiverId,
        verificationMethod: sampleIndex % 3 === 0 ? 'nfc' : sampleIndex % 3 === 1 ? 'ble' : 'manual_override',
        type: sampleIndex === 2 && patient.riskLevel === 'critical' ? 'follow_up' : 'scheduled',
        scheduledTime: scheduled,
        actualTime: actual,
        status: isLate ? 'late' : 'completed',
        proximityVerification: {
          method: sampleIndex % 3 === 0 ? 'nfc' : sampleIndex % 3 === 1 ? 'ble' : 'manual_override',
          verified: true,
          verifiedAt: actual,
          deviceIds: [patient.deviceId],
          signalStrength: sampleIndex % 3 === 1 ? -58 + (index % 4) : undefined,
          distance: sampleIndex % 3 === 0 ? 0.3 : 0.8,
          gpsCoordinates: sampleIndex % 3 === 2 ? { latitude: patient.coords.latitude, longitude: patient.coords.longitude, accuracy: 7 } : undefined
        },
        wellness: {
          overallStatus,
          mobility: patient.functionalBaseline.mobility === 'wheelchair' ? 'needs_assistance' : patient.functionalBaseline.mobility === 'independent' ? 'normal' : 'limited',
          mood: patient.riskLevel === 'critical' ? 'anxious' : sampleIndex % 2 === 0 ? 'neutral' : 'happy',
          appearance: patient.riskLevel === 'critical' ? 'concerning' : 'normal',
          consciousness: 'alert',
          pain: { present: ['arthritis', 'fractureRehab', 'stroke'].includes(patientBlueprints[index].archetype), level: ['arthritis', 'fractureRehab'].includes(patientBlueprints[index].archetype) ? 3 + (index % 3) : 0 }
        },
        vitals: {
          heartRate: { value: patient.heartRate + (alertish ? 4 : -2), abnormal: alertish && patient.heartRate > 110 },
          bloodPressure: { systolic: patient.systolic + (alertish ? 3 : -2), diastolic: patient.diastolic + (alertish ? 2 : -1), abnormal: alertish && patient.systolic > 150 },
          temperature: { value: patient.temperature + (alertish ? 0.3 : 0), abnormal: alertish && patient.temperature > 37.5 },
          oxygenSaturation: { value: patient.oxygen - (alertish ? 1 : 0), abnormal: alertish && patient.oxygen < 90 }
        },
        medication: { adherence: sampleIndex === 3 && index % 4 === 0 ? 'partial' : 'taken' },
        notes: {
          caregiver: alertish
            ? `Escalated review for ${patient.condition.toLowerCase()} symptoms.`
            : `Routine home visit in ${patient.district}.`,
          concerns: alertish ? ['Monitor overnight', 'Review medication timing'] : [],
          highlights: isLate ? ['Visit completed outside preferred window'] : ['Medication confirmed', 'Home safety reviewed']
        },
        duration: 18 + (index % 4) * 6,
        followUp: alertish
          ? { required: true, reason: `Monitor ${patient.condition}`, scheduledFor: minutesFromNow(60 + (index % 5) * 15), priority: patient.riskLevel === 'critical' ? 'urgent' : 'high' }
          : undefined,
        createdAt: actual,
        updatedAt: actual
      };
    });
  });

  let alertSeq = 1;
  const activeStatuses = ['pending', 'acknowledged', 'escalated'];
  const alerts = patientConfigs.flatMap((patient, index) => {
    const items = [];
    if (['critical', 'high'].includes(patient.riskLevel)) {
      const activeStatus = activeStatuses[index % activeStatuses.length];
      items.push({
        _id: oid(),
        alertId: makeStampedId('ALT', alertSeq++),
        patient: patient._id,
        type: patient.riskLevel === 'critical' ? 'vital_sign' : 'medication_missed',
        severity: patient.riskLevel === 'critical' ? 'critical' : 'high',
        title: patient.riskLevel === 'critical' ? 'Critical vitals follow-up required' : 'Adherence drift detected',
        message: patient.riskLevel === 'critical'
          ? `${patient.firstName} ${patient.lastName} has sustained abnormal vitals requiring rapid follow-up.`
          : `${patient.firstName} ${patient.lastName} has missed or delayed medication confirmation twice this week.`,
        source: {
          type: patient.riskLevel === 'critical' ? 'sensor' : 'schedule',
          deviceId: patient.deviceId,
          sensorType: patient.riskLevel === 'critical' ? 'wearable' : 'medication_reminder',
          triggerValue: patient.riskLevel === 'critical'
            ? { heartRate: patient.heartRate, oxygenSaturation: patient.oxygen }
            : { overdueMinutes: 55 + (index % 4) * 10 }
        },
        vitalSnapshot: patient.riskLevel === 'critical'
          ? {
              heartRate: patient.heartRate,
              bloodPressure: { systolic: patient.systolic, diastolic: patient.diastolic },
              oxygenSaturation: patient.oxygen,
              temperature: patient.temperature,
              lastMotion: minutesAgo(18 + index)
            }
          : undefined,
        status: activeStatus,
        escalation: {
          currentLevel: activeStatus === 'escalated' ? 2 : activeStatus === 'acknowledged' ? 1 : 0,
          history: activeStatus === 'escalated'
            ? [
                { level: 1, escalatedAt: minutesAgo(70 + index), escalatedTo: patient.caregiverId, role: 'caregiver', reason: 'Initial outreach', notificationSent: true, channels: ['push'] },
                { level: 2, escalatedAt: minutesAgo(40 + index), escalatedTo: patient.clinicianId, role: 'clinician', reason: 'Persistent abnormal trend', notificationSent: true, channels: ['push', 'sms'] }
              ]
            : [],
          nextEscalationAt: activeStatus === 'pending' ? minutesFromNow(20 + (index % 5) * 5) : null
        },
        relatedCheckin: checkins.find((checkIn) => String(checkIn.patient) === String(patient._id))?._id,
        createdAt: minutesAgo(110 + index * 6),
        updatedAt: minutesAgo(40 + index * 2)
      });
    }

    if (index % 3 === 0) {
      items.push({
        _id: oid(),
        alertId: makeStampedId('ALT', alertSeq++),
        patient: patient._id,
        type: index % 2 === 0 ? 'fall_detected' : 'device_offline',
        severity: index % 2 === 0 ? 'high' : 'medium',
        title: index % 2 === 0 ? 'Possible fall detected' : 'Device connectivity degraded',
        message: index % 2 === 0
          ? `Wearable recorded an impact pattern for ${patient.firstName} ${patient.lastName}.`
          : `${patient.deviceId} has intermittent signal dropouts in ${patient.district}.`,
        source: {
          type: index % 2 === 0 ? 'sensor' : 'system',
          deviceId: patient.deviceId,
          sensorType: index % 2 === 0 ? 'accelerometer' : 'mqtt',
          triggerValue: index % 2 === 0 ? { impactForce: 2.3 } : { offlineMinutes: 18 + index }
        },
        status: 'resolved',
        acknowledgements: [
          {
            acknowledgedBy: patient.caregiverId,
            role: 'caregiver',
            acknowledgedAt: minutesAgo(180 + index * 4),
            responseTime: 210,
            notes: 'Patient assessed and stabilized.',
            actionTaken: index % 2 === 0 ? 'On-site assessment' : 'Connectivity review'
          }
        ],
        resolution: {
          resolvedBy: patient.caregiverId,
          resolvedAt: minutesAgo(150 + index * 4),
          resolutionType: 'resolved',
          resolutionNotes: index % 2 === 0 ? 'No injury confirmed after assessment.' : 'Signal recovered after battery reseat.',
          followUpRequired: false,
          outcome: 'Stable'
        },
        createdAt: minutesAgo(210 + index * 4),
        updatedAt: minutesAgo(150 + index * 4)
      });
    }

    return items;
  });

  const schedules = patientConfigs.map((patient, index) => ({
    _id: oid(),
    scheduleId: `SCH-2026-${String(index + 1).padStart(5, '0')}`,
    patient: patient._id,
    title: `${patient.firstName} ${patient.lastName} care plan`,
    assignedTo: patient.caregiverId,
    status: 'active',
    effectiveDate: daysAgo(60 - index),
    checkinWindows: [
      {
        name: 'morning',
        startTime: patient.riskLevel === 'critical' ? '07:30' : '08:00',
        endTime: patient.riskLevel === 'critical' ? '09:00' : '10:00',
        gracePeriod: patient.riskLevel === 'critical' ? 15 : 20,
        required: true,
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        assignedCaregiver: patient.caregiverId
      },
      {
        name: patient.riskLevel === 'critical' ? 'afternoon' : 'evening',
        startTime: patient.riskLevel === 'critical' ? '14:00' : '18:00',
        endTime: patient.riskLevel === 'critical' ? '16:00' : '20:00',
        gracePeriod: 20,
        required: patient.riskLevel !== 'moderate' || index % 2 === 0,
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        assignedCaregiver: patient.caregiverId
      }
    ],
    medicationReminders: [
      {
        medication: patient.medication,
        dosage: patient.dosage,
        unit: patient.unit,
        time: '08:30',
        withFood: patient.unit !== 'puffs',
        instructions: patient.unit === 'puffs' ? 'Use when shortness of breath occurs.' : 'Morning dose confirmation',
        active: true,
        adherenceRule: patient.unit === 'puffs' ? 'as_needed' : 'required',
        confirmationSource: patient.unit === 'puffs' ? 'patient' : 'caregiver',
        refillDueDate: daysAgo(-6 + (index % 5)),
        refillWindowDays: patient.riskLevel === 'critical' ? 5 : 7,
        sideEffectPrompts: patient.riskLevel === 'critical' ? ['Dizziness', 'Fatigue'] : ['Headache'],
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        startDate: daysAgo(50 - index)
      }
    ],
    weeklyActivities: [
      {
        type: ['stroke', 'fractureRehab', 'parkinsons'].includes(patientBlueprints[index].archetype) ? 'physical_therapy' : 'checkup',
        day: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'][index % 5],
        time: index % 2 === 0 ? '09:00' : '14:00',
        duration: patient.riskLevel === 'critical' ? 45 : 30,
        assignedTo: patient.chwId,
        notes: `Routine ${patient.condition.toLowerCase()} follow-up`,
        active: true
      }
    ],
    vitalThresholds: [
      {
        vitalType: 'heartRate',
        min: 50,
        max: patient.riskLevel === 'critical' ? 110 : 120,
        unit: 'bpm',
        alertLevel: patient.riskLevel === 'critical' ? 'critical' : patient.riskLevel === 'high' ? 'high' : 'medium',
        actions: ['Notify caregiver', 'Escalate if persistent']
      }
    ],
    escalationRules: {
      level1: { timeoutMinutes: 5, notify: [patient.caregiverId], channels: ['push'] },
      level2: { timeoutMinutes: 10, notify: [patient.chwId], channels: ['push', 'sms'] },
      level3: { timeoutMinutes: 15, notify: [patient.clinicianId, ids.adminPrimary], channels: ['push', 'sms', 'call'] }
    },
    version: 1,
    previousVersions: [],
    createdBy: ids.adminPrimary,
    lastModifiedBy: patient.chwId,
    createdAt: daysAgo(60 - index),
    updatedAt: baseNow
  }));

  const transitionCandidates = patientConfigs.filter((patient) => ['critical', 'high'].includes(patient.riskLevel)).slice(0, 6);
  const transitions = transitionCandidates.map((patient, index) => {
    const transitionType = index % 3 === 0 ? 'hospital_discharge' : index % 3 === 1 ? 'post_acute' : 'ed_followup';
    const dischargeDate = daysAgo(6 + index * 2);

    return {
      _id: oid(),
      transitionId: `TRN-2026-${String(index + 1).padStart(5, '0')}`,
      patient: patient._id,
      createdBy: patient.clinicianId,
      assignedCaregiver: patient.caregiverId,
      assignedCHW: patient.chwId,
      assignedClinician: patient.clinicianId,
      status: index % 4 === 0 ? 'completed' : 'active',
      transitionType,
      dischargeDate,
      dischargeReason: `${patient.condition} follow-up requiring coordinated home monitoring.`,
      dischargeFacility: index % 2 === 0 ? 'Parirenyatwa Referral Hospital' : 'Mpilo Central Hospital',
      diagnosisSummary: patient.summary,
      medicationChanges: [
        { name: patient.medication, dosage: `${patient.dosage} ${patient.frequency.toLowerCase()}`, changeType: index % 2 === 0 ? 'changed' : 'continued', instructions: 'Confirm adherence during every visit.' }
      ],
      redFlags: ['New confusion', 'Breathing difficulty', 'Any fall or missed medication cluster'],
      followUpTasks: buildTransitionTaskPayload([
        { title: 'Clinician medication review', description: 'Confirm post-discharge medication plan.', ownerRole: 'clinician', dueDate: daysAgo(-(2 + index)), priority: patient.riskLevel === 'critical' ? 'urgent' : 'high', status: index % 4 === 0 ? 'completed' : 'pending' },
        { title: 'CHW home reassessment', description: 'Repeat mobility and home safety review.', ownerRole: 'chw', dueDate: daysAgo(-(1 + index)), priority: 'high', status: 'pending' }
      ], dischargeDate),
      checkpoints: buildDefaultTransitionCheckpoints(dischargeDate, {
        day7: { status: index % 4 === 0 ? 'completed' : 'pending', completedAt: index % 4 === 0 ? daysAgo(1) : undefined, completedBy: index % 4 === 0 ? patient.chwId : undefined },
        day14: { status: 'pending' },
        day30: { status: 'pending' }
      }),
      nextReviewDate: daysAgo(-(3 + index)),
      lastContactAt: hoursAgo(12 + index * 6),
      createdAt: dischargeDate,
      updatedAt: baseNow
    };
  });

  const auditLogs = [];
  let auditSeq = 1;
  const makeAudit = (action, category, actorInfo, target, details, timestamp) => {
    auditLogs.push(buildAuditLog(makeStampedId('AUD', auditSeq++), action, category, actorInfo, target, details, timestamp));
  };

  makeAudit(AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.adminPrimary, 'admin@chengeto.health', 'admin'), { type: 'user', id: ids.adminPrimary, model: 'User', description: 'Admin login' }, { message: 'Administrator reviewed cohort refresh and operations dashboard.' }, hoursAgo(10));
  makeAudit(AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.adminOperations, 'ops-admin@chengeto.health', 'admin'), { type: 'user', id: ids.adminOperations, model: 'User', description: 'Operations admin login' }, { message: 'Operations admin reviewed alert queues.' }, hoursAgo(6));

  patients.slice(0, 8).forEach((patient, index) => {
    makeAudit(
      AUDIT_ACTIONS.PATIENT_CREATE,
      'patient_management',
      actor(ids.adminPrimary, 'admin@chengeto.health', 'admin'),
      { type: 'patient', id: patient._id, model: 'Patient', description: patient.patientId },
      { message: `Cohort patient ${patient.patientId} seeded with active care plan.` },
      daysAgo(75 - index)
    );
  });

  devices.slice(0, 8).forEach((device, index) => {
    makeAudit(
      AUDIT_ACTIONS.DEVICE_REGISTER,
      'device',
      actor(ids.adminPrimary, 'admin@chengeto.health', 'admin'),
      { type: 'device', id: device._id, model: 'IoTDevice', description: device.deviceId },
      { message: `Provisioned ${device.deviceId} for active cohort patient.` },
      daysAgo(70 - index)
    );
  });

  checkins.slice(0, 12).forEach((checkIn, index) => {
    const caregiver = caregiverDefs.find((item) => String(item._id) === String(checkIn.caregiver));
    makeAudit(
      AUDIT_ACTIONS.CHECKIN_CREATE,
      'checkin',
      actor(checkIn.caregiver, caregiver?.email || 'caregiver@chengeto.health', 'caregiver'),
      { type: 'checkin', id: checkIn._id, model: 'CheckIn', description: checkIn.checkinId },
      { message: checkIn.notes?.caregiver || 'Routine check-in completed.' },
      checkIn.actualTime || hoursAgo(3 + index)
    );
  });

  alerts.slice(0, 10).forEach((alert, index) => {
    makeAudit(
      AUDIT_ACTIONS.ALERT_TRIGGER,
      'alert',
      actor(ids.adminOperations, 'ops-admin@chengeto.health', 'admin'),
      { type: 'alert', id: alert._id, model: 'Alert', description: alert.alertId },
      { message: alert.message },
      alert.createdAt || minutesAgo(80 + index * 4)
    );
  });

  transitions.slice(0, 6).forEach((transition, index) => {
    const clinician = clinicianDefs.find((item) => String(item._id) === String(transition.createdBy));
    makeAudit(
      AUDIT_ACTIONS.DATA_ACCESS,
      'data_access',
      actor(transition.createdBy, clinician?.email || 'clinician@chengeto.health', 'clinician'),
      { type: 'transition', id: transition._id, model: 'CareTransition', description: transition.transitionId },
      { message: `Reviewed transition workflow for ${transition.transitionType}.` },
      minutesAgo(55 + index * 7)
    );
  });

  schedules.slice(0, 6).forEach((schedule, index) => {
    makeAudit(
      AUDIT_ACTIONS.SCHEDULE_CHANGE,
      'system',
      actor(ids.adminOperations, 'ops-admin@chengeto.health', 'admin'),
      { type: 'schedule', id: schedule._id, model: 'CareSchedule', description: schedule.scheduleId },
      { message: `Adjusted care schedule cadence for cohort segment ${index + 1}.` },
      daysAgo(20 - index)
    );
  });

  familyUsers.slice(0, 4).forEach((family, index) => {
    makeAudit(
      AUDIT_ACTIONS.LOGIN,
      'authentication',
      actor(family._id, family.email, 'family'),
      { type: 'user', id: family._id, model: 'User', description: family.email },
      { message: 'Family portal access used to review patient activity and alerts.' },
      daysAgo(1 + index)
    );
  });

  makeAudit(AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.auditorClinical, 'auditor@chengeto.health', 'auditor'), { type: 'user', id: ids.auditorClinical, model: 'User', description: 'Clinical auditor' }, { message: 'Clinical auditor reviewed oversight metrics.' }, daysAgo(4));
  makeAudit(AUDIT_ACTIONS.LOGIN, 'authentication', actor(ids.auditorOps, 'auditor.ops@chengeto.health', 'auditor'), { type: 'user', id: ids.auditorOps, model: 'User', description: 'Operations auditor' }, { message: 'Operations auditor reviewed alert response times.' }, daysAgo(6));

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

import User, { USER_ROLES, USER_STATUS } from '../models/User.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';

export const DEMO_ACCOUNT_DEFINITIONS = [
  {
    key: 'admin',
    email: 'admin@chengeto.health',
    firstName: 'System',
    lastName: 'Administrator',
    phone: '+263771000001',
    role: USER_ROLES.ADMIN
  },
  {
    key: 'chw',
    email: 'chw1@chengeto.health',
    firstName: 'Nyasha',
    lastName: 'Mukamuri',
    phone: '+263771000011',
    role: USER_ROLES.CHW,
    ward: 'Ward 16',
    district: 'Harare'
  },
  {
    key: 'caregiver',
    email: 'caregiver1@example.com',
    firstName: 'Tariro',
    lastName: 'Moyo',
    phone: '+263771000021',
    role: USER_ROLES.CAREGIVER,
    isPrimaryCaregiver: true,
    specializations: ['Medication adherence', 'Home visits']
  },
  {
    key: 'clinician',
    email: 'clinician1@chengeto.health',
    firstName: 'Dr. Farai',
    lastName: 'Mlambo',
    phone: '+263771000031',
    role: USER_ROLES.CLINICIAN,
    specializations: ['Geriatrics']
  },
  {
    key: 'family',
    email: 'family1@example.com',
    firstName: 'Kudzai',
    lastName: 'Moyo',
    phone: '+263771000041',
    role: USER_ROLES.FAMILY
  },
  {
    key: 'auditor',
    email: 'auditor@chengeto.health',
    firstName: 'Audit',
    lastName: 'Officer',
    phone: '+263771000051',
    role: USER_ROLES.AUDITOR
  }
];

const DEFAULT_PASSWORD = 'Demo@123456';

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

const normalizeSelection = (selection) => {
  if (!selection || selection === 'all') {
    return null;
  }

  return new Set(
    String(selection)
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const getDemoAccountReseedOptionsFromEnv = (env = process.env) => ({
  mode: String(env.DEMO_ACCOUNT_RESEED_MODE || '').trim().toLowerCase() === 'apply' ? 'apply' : String(env.DEMO_ACCOUNT_RESEED_MODE || '').trim().toLowerCase() === 'dry-run' ? 'dry-run' : 'off',
  selected: normalizeSelection(env.DEMO_ACCOUNT_RESEED_SELECTION),
  password: env.DEMO_ACCOUNT_RESEED_PASSWORD || env.DEMO_PASSWORD || DEFAULT_PASSWORD,
  forcePasswordReset: toBoolean(env.DEMO_ACCOUNT_RESEED_FORCE_PASSWORD_RESET),
  writeAudit: !toBoolean(env.DEMO_ACCOUNT_RESEED_DISABLE_AUDIT)
});

const getSelectedDefinitions = (selected) => {
  if (!selected) {
    return DEMO_ACCOUNT_DEFINITIONS;
  }

  return DEMO_ACCOUNT_DEFINITIONS.filter((definition) =>
    selected.has(definition.key) || selected.has(definition.email.toLowerCase())
  );
};

const buildReport = (definitions, existingUsers, options) => ({
  dryRun: options.mode !== 'apply',
  selectedAccounts: definitions.length,
  existingAccounts: existingUsers.length,
  missingAccounts: Math.max(definitions.length - existingUsers.length, 0),
  forcePasswordReset: options.forcePasswordReset
});

async function writeReseedAudit(details) {
  await AuditLog.log({
    action: AUDIT_ACTIONS.USER_UPDATE,
    category: 'system',
    result: AUDIT_RESULT.SUCCESS,
    actor: {
      email: 'system:demo-account-reseed',
      role: 'system'
    },
    target: {
      type: 'user',
      model: 'User',
      description: 'Demo account reseed'
    },
    request: {
      method: 'SCRIPT',
      endpoint: '/maintenance/demo-account-reseed',
      ipAddress: '127.0.0.1',
      userAgent: 'demo-account-reseed'
    },
    details
  });
}

export async function reseedDemoAccounts(options = {}) {
  const resolvedOptions = {
    mode: options.mode || 'dry-run',
    selected: options.selected || null,
    password: options.password || DEFAULT_PASSWORD,
    forcePasswordReset: Boolean(options.forcePasswordReset),
    writeAudit: options.writeAudit !== false
  };

  if (!['dry-run', 'apply'].includes(resolvedOptions.mode)) {
    throw new Error(`Unsupported demo account reseed mode: ${resolvedOptions.mode}`);
  }

  const definitions = getSelectedDefinitions(resolvedOptions.selected);
  const emails = definitions.map((definition) => definition.email);
  const existingUsers = await User.find({ email: { $in: emails } }).select('+password');
  const existingByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const report = buildReport(definitions, existingUsers, resolvedOptions);

  if (resolvedOptions.mode !== 'apply') {
    return { report, applied: null };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let passwordResetCount = 0;

  for (const definition of definitions) {
    const existing = existingByEmail.get(definition.email);

    if (!existing) {
      const user = new User({
        ...definition,
        password: resolvedOptions.password,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: false,
        loginAttempts: 0,
        lastLogin: {
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'demo-account-reseed'
        }
      });

      await user.save();
      createdCount += 1;
      passwordResetCount += 1;
      continue;
    }

    existing.firstName = definition.firstName;
    existing.lastName = definition.lastName;
    existing.phone = definition.phone;
    existing.role = definition.role;
    existing.status = USER_STATUS.ACTIVE;
    existing.emailVerified = true;
    existing.phoneVerified = true;
    existing.loginAttempts = 0;
    existing.lockUntil = undefined;
    existing.isPrimaryCaregiver = definition.isPrimaryCaregiver ?? existing.isPrimaryCaregiver ?? false;
    existing.specializations = definition.specializations ?? existing.specializations ?? [];
    existing.ward = definition.ward ?? existing.ward;
    existing.district = definition.district ?? existing.district;
    existing.setPermissions();

    if (resolvedOptions.forcePasswordReset) {
      existing.password = resolvedOptions.password;
      passwordResetCount += 1;
    }

    await existing.save();
    updatedCount += 1;
  }

  const applied = {
    selectedAccounts: definitions.length,
    createdCount,
    updatedCount,
    passwordResetCount
  };

  if (resolvedOptions.writeAudit) {
    await writeReseedAudit(applied);
  }

  return { report, applied };
}

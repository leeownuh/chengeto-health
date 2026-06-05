import User, { USER_STATUS } from '../models/User.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';

export const DEMO_EMAILS = [
  'admin@chengeto.health',
  'chw1@chengeto.health',
  'caregiver1@example.com',
  'clinician1@chengeto.health',
  'family1@example.com',
  'auditor@chengeto.health'
];

const DEFAULT_DEMO_PASSWORD = 'Demo@123456';

const isValidStatus = (value) => Object.values(USER_STATUS).includes(value);

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

export const getAuthDataRepairOptionsFromEnv = (env = process.env) => {
  const rawMode = String(env.AUTH_DATA_REPAIR_MODE || '').trim().toLowerCase();
  const mode = rawMode === 'apply' ? 'apply' : rawMode === 'dry-run' ? 'dry-run' : 'off';

  return {
    mode,
    resetDemoPasswords: toBoolean(env.AUTH_DATA_REPAIR_RESET_DEMO_PASSWORDS),
    syncIndexes: toBoolean(env.AUTH_DATA_REPAIR_SYNC_INDEXES),
    unsetLegacyFields: !toBoolean(env.AUTH_DATA_REPAIR_KEEP_LEGACY_FIELDS),
    demoPassword: env.AUTH_DATA_REPAIR_DEMO_PASSWORD || env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD,
    writeAudit: !toBoolean(env.AUTH_DATA_REPAIR_DISABLE_AUDIT)
  };
};

const buildUserPatch = (user, { unsetLegacyFields }) => {
  const set = {};
  const unset = {};

  if (!isValidStatus(user.status)) {
    if (user.isActive === false) {
      set.status = USER_STATUS.INACTIVE;
    } else if (user.emailVerified === true || user.isEmailVerified === true || user.lastLogin?.timestamp) {
      set.status = USER_STATUS.ACTIVE;
    } else {
      set.status = USER_STATUS.PENDING;
    }
  }

  if (typeof user.emailVerified !== 'boolean' && typeof user.isEmailVerified === 'boolean') {
    set.emailVerified = user.isEmailVerified;
  }

  if (typeof user.phoneVerified !== 'boolean') {
    set.phoneVerified = false;
  }

  if (unsetLegacyFields) {
    if (Object.prototype.hasOwnProperty.call(user, 'isActive')) {
      unset.isActive = 1;
    }

    if (Object.prototype.hasOwnProperty.call(user, 'isEmailVerified')) {
      unset.isEmailVerified = 1;
    }
  }

  return { set, unset };
};

const summarizeUsers = (users) =>
  users.map((user) => ({
    id: String(user._id),
    email: user.email,
    status: user.status,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    isEmailVerified: user.isEmailVerified
  }));

async function repairUsers(options) {
  const users = await User.collection
    .find({
      $or: [
        { status: { $exists: false } },
        { status: { $nin: Object.values(USER_STATUS) } },
        { emailVerified: { $exists: false } },
        { isActive: { $exists: true } },
        { isEmailVerified: { $exists: true } },
        { phoneVerified: { $exists: false } }
      ]
    })
    .toArray();

  const operations = users
    .map((user) => {
      const patch = buildUserPatch(user, options);
      const update = {};

      if (Object.keys(patch.set).length > 0) {
        update.$set = patch.set;
      }

      if (Object.keys(patch.unset).length > 0) {
        update.$unset = patch.unset;
      }

      if (Object.keys(update).length === 0) {
        return null;
      }

      return {
        updateOne: {
          filter: { _id: user._id },
          update
        }
      };
    })
    .filter(Boolean);

  return {
    candidates: users,
    operations
  };
}

async function resetDemoPasswords(demoPassword) {
  const users = await User.find({ email: { $in: DEMO_EMAILS } }).select('+password');
  const repaired = [];

  for (const user of users) {
    user.password = demoPassword;
    user.status = USER_STATUS.ACTIVE;
    user.emailVerified = true;
    if (typeof user.phoneVerified !== 'boolean') {
      user.phoneVerified = false;
    }
    await user.save();
    repaired.push(user.email);
  }

  return repaired;
}

async function syncIndexes() {
  const results = {};
  results.users = await User.syncIndexes();
  results.auditLogs = await AuditLog.syncIndexes();
  return results;
}

async function writeRepairAudit(details) {
  await AuditLog.log({
    action: AUDIT_ACTIONS.CONFIG_CHANGE,
    category: 'system',
    result: AUDIT_RESULT.SUCCESS,
    actor: {
      email: 'system:auth-data-repair',
      role: 'system'
    },
    target: {
      type: 'system',
      model: 'User',
      description: 'Authentication data repair'
    },
    request: {
      method: 'SCRIPT',
      endpoint: '/maintenance/auth-data-repair',
      ipAddress: '127.0.0.1',
      userAgent: 'auth-data-repair'
    },
    details
  });
}

export async function runAuthDataRepair(options = {}) {
  const resolvedOptions = {
    mode: options.mode || 'dry-run',
    resetDemoPasswords: Boolean(options.resetDemoPasswords),
    syncIndexes: Boolean(options.syncIndexes),
    unsetLegacyFields: options.unsetLegacyFields !== false,
    demoPassword: options.demoPassword || DEFAULT_DEMO_PASSWORD,
    writeAudit: options.writeAudit !== false
  };

  if (!['dry-run', 'apply'].includes(resolvedOptions.mode)) {
    throw new Error(`Unsupported auth data repair mode: ${resolvedOptions.mode}`);
  }

  const userRepair = await repairUsers(resolvedOptions);
  const report = {
    dryRun: resolvedOptions.mode !== 'apply',
    userCandidates: userRepair.candidates.length,
    userOperations: userRepair.operations.length,
    sampleUsers: summarizeUsers(userRepair.candidates).slice(0, 10),
    demoPasswordResetRequested: resolvedOptions.resetDemoPasswords,
    syncIndexesRequested: resolvedOptions.syncIndexes
  };

  if (resolvedOptions.mode !== 'apply') {
    return { report, applied: null };
  }

  let userRepairResult = null;
  if (userRepair.operations.length > 0) {
    userRepairResult = await User.collection.bulkWrite(userRepair.operations, { ordered: false });
  }

  let demoPasswordResetResult = [];
  if (resolvedOptions.resetDemoPasswords) {
    demoPasswordResetResult = await resetDemoPasswords(resolvedOptions.demoPassword);
  }

  let indexSyncResult = null;
  if (resolvedOptions.syncIndexes) {
    indexSyncResult = await syncIndexes();
  }

  const applied = {
    matchedUsers: userRepairResult?.matchedCount || 0,
    modifiedUsers: userRepairResult?.modifiedCount || 0,
    demoPasswordsReset: demoPasswordResetResult,
    indexSyncResult
  };

  if (resolvedOptions.writeAudit) {
    await writeRepairAudit({
      message: 'Authentication data repair executed',
      matchedUsers: applied.matchedUsers,
      modifiedUsers: applied.modifiedUsers,
      demoPasswordsReset: applied.demoPasswordsReset,
      syncedIndexes: Boolean(indexSyncResult)
    });
  }

  return { report, applied };
}

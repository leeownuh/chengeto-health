export const CARE_TRANSITION_STATUSES = ['active', 'completed', 'cancelled'];
export const CARE_TRANSITION_TYPES = ['hospital_discharge', 'ed_followup', 'transfer', 'post_acute'];
export const CARE_TRANSITION_OWNER_ROLES = ['caregiver', 'chw', 'clinician', 'family', 'admin'];
export const CARE_TRANSITION_TASK_STATUSES = ['pending', 'completed', 'skipped', 'overdue'];
export const CARE_TRANSITION_CHECKPOINT_KEYS = ['day7', 'day14', 'day30'];

export const CARE_TRANSITION_CHECKPOINT_CONFIG = {
  day7: { label: '7-day check', days: 7 },
  day14: { label: '14-day check', days: 14 },
  day30: { label: '30-day check', days: 30 }
};

function normalizeString(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeDate(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return fallback;
}

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function normalizeTaskStatus(status, dueDate, now = new Date()) {
  if (CARE_TRANSITION_TASK_STATUSES.includes(status)) {
    return status;
  }

  const normalizedDueDate = normalizeDate(dueDate);
  if (normalizedDueDate && normalizedDueDate < now) {
    return 'overdue';
  }

  return 'pending';
}

export function buildDefaultTransitionCheckpoints(dischargeDate, existing = {}) {
  const discharge = normalizeDate(dischargeDate, new Date());
  const previous = existing && typeof existing === 'object' ? existing : {};

  return CARE_TRANSITION_CHECKPOINT_KEYS.reduce((accumulator, key) => {
    const config = CARE_TRANSITION_CHECKPOINT_CONFIG[key];
    const previousCheckpoint = previous[key] && typeof previous[key] === 'object'
      ? previous[key]
      : {};

    accumulator[key] = {
      dueDate: normalizeDate(previousCheckpoint.dueDate, addDays(discharge, config.days)),
      status: normalizeTaskStatus(previousCheckpoint.status, previousCheckpoint.dueDate, new Date()),
      completedAt: normalizeDate(previousCheckpoint.completedAt),
      completedBy: previousCheckpoint.completedBy || null,
      notes: normalizeString(previousCheckpoint.notes)
    };

    return accumulator;
  }, {});
}

export function buildTransitionTaskPayload(tasks = [], dischargeDate = new Date()) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .map((task, index) => {
      const source = task && typeof task === 'object' ? task : {};
      const dueDate = normalizeDate(source.dueDate, addDays(dischargeDate, index + 1));
      const status = normalizeTaskStatus(source.status, dueDate, new Date());

      return {
        title: normalizeString(source.title),
        description: normalizeString(source.description),
        ownerRole: CARE_TRANSITION_OWNER_ROLES.includes(source.ownerRole)
          ? source.ownerRole
          : 'caregiver',
        dueDate,
        status,
        priority: ['low', 'medium', 'high', 'urgent'].includes(source.priority)
          ? source.priority
          : 'medium',
        notes: normalizeString(source.notes),
        completedAt: normalizeDate(source.completedAt),
        completedBy: source.completedBy || null,
        required: normalizeBoolean(source.required, true)
      };
    })
    .filter((task) => task.title);
}

export function getTransitionTaskEntries(transition, now = new Date()) {
  if (!transition) {
    return [];
  }

  const followUpTasks = (transition.followUpTasks || []).map((task) => ({
    _id: task._id,
    title: task.title,
    description: task.description,
    ownerRole: task.ownerRole,
    dueDate: task.dueDate,
    status: normalizeTaskStatus(task.status, task.dueDate, now),
    priority: task.priority || 'medium',
    notes: task.notes,
    completedAt: task.completedAt,
    type: 'task'
  }));

  const checkpointTasks = CARE_TRANSITION_CHECKPOINT_KEYS.map((key) => {
    const checkpoint = transition.checkpoints?.[key];
    if (!checkpoint) {
      return null;
    }

    return {
      _id: `${transition._id}:${key}`,
      key,
      title: CARE_TRANSITION_CHECKPOINT_CONFIG[key].label,
      description: `Post-discharge ${CARE_TRANSITION_CHECKPOINT_CONFIG[key].label.toLowerCase()}`,
      ownerRole: 'clinician',
      dueDate: checkpoint.dueDate,
      status: normalizeTaskStatus(checkpoint.status, checkpoint.dueDate, now),
      priority: key === 'day7' ? 'high' : 'medium',
      notes: checkpoint.notes,
      completedAt: checkpoint.completedAt,
      type: 'checkpoint'
    };
  }).filter(Boolean);

  return [...followUpTasks, ...checkpointTasks].sort(
    (left, right) => new Date(left.dueDate || 0) - new Date(right.dueDate || 0)
  );
}

export function buildTransitionSummary(transition, now = new Date()) {
  if (!transition) {
    return null;
  }

  const entries = getTransitionTaskEntries(transition, now);
  const completedEntries = entries.filter((entry) => entry.status === 'completed');
  const pendingEntries = entries.filter((entry) => entry.status === 'pending');
  const overdueEntries = entries.filter((entry) => entry.status === 'overdue');
  const progressPercent = entries.length > 0
    ? Math.round((completedEntries.length / entries.length) * 100)
    : 0;

  return {
    _id: transition._id,
    transitionId: transition.transitionId,
    status: transition.status,
    transitionType: transition.transitionType,
    dischargeDate: transition.dischargeDate,
    dischargeReason: transition.dischargeReason,
    dischargeFacility: transition.dischargeFacility,
    diagnosisSummary: transition.diagnosisSummary,
    redFlags: transition.redFlags || [],
    progressPercent,
    totalTasks: entries.length,
    completedTasks: completedEntries.length,
    pendingTasks: pendingEntries.length,
    overdueTasks: overdueEntries.length,
    nextTask: entries.find((entry) => entry.status !== 'completed') || null,
    checkpoints: transition.checkpoints || {},
    medicationChanges: transition.medicationChanges || [],
    followUpTasks: entries
  };
}

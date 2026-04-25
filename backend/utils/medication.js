const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

const MEDICATION_ENTRY_STATUSES = ['taken', 'missed', 'partial', 'not_due'];
const MEDICATION_CONFIRMATION_SOURCES = ['caregiver', 'patient', 'family', 'device', 'system', 'unknown'];
const MEDICATION_ADHERENCE_RULES = ['required', 'optional', 'as_needed'];

function normalizeTrimmedString(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim();
}

function normalizeEnum(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeTrimmedString(entry))
    .filter(Boolean);
}

function getDayName(date = new Date()) {
  return DAYS_OF_WEEK[new Date(date).getDay()];
}

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isSameDay(left, right) {
  if (!left || !right) {
    return false;
  }

  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function normalizeMedicationKeyPart(value) {
  return normalizeTrimmedString(value).toLowerCase();
}

function getMedicationKey(name, dosage = '', dueTime = '') {
  return [
    normalizeMedicationKeyPart(name),
    normalizeMedicationKeyPart(dosage),
    normalizeMedicationKeyPart(dueTime)
  ].join('|');
}

function getMedicationName(reminder = {}, medication = {}) {
  return normalizeTrimmedString(reminder.medication, normalizeTrimmedString(medication.name));
}

function getMedicationReminderDays(reminder = {}) {
  if (!Array.isArray(reminder.days) || reminder.days.length === 0) {
    return [];
  }

  return reminder.days.map((day) => normalizeMedicationKeyPart(day)).filter(Boolean);
}

function isMedicationActive(reminder = {}, date = new Date()) {
  if (normalizeBoolean(reminder.active, true) === false) {
    return false;
  }

  const now = new Date(date);
  const start = normalizeDate(reminder.startDate);
  const end = normalizeDate(reminder.endDate);

  if (start && startOfDay(now) < startOfDay(start)) {
    return false;
  }

  if (end && startOfDay(now) > startOfDay(end)) {
    return false;
  }

  return true;
}

function isMedicationDueToday(reminder = {}, date = new Date()) {
  if (!isMedicationActive(reminder, date)) {
    return false;
  }

  const days = getMedicationReminderDays(reminder);
  if (days.length === 0) {
    return true;
  }

  return days.includes(getDayName(date));
}

function getRefillStatus(refillDueDate, refillWindowDays = 7, date = new Date()) {
  const refillDate = normalizeDate(refillDueDate);
  if (!refillDate) {
    return {
      refillStatus: 'unknown',
      daysUntilRefill: null
    };
  }

  const today = startOfDay(date);
  const refillDay = startOfDay(refillDate);
  const diffDays = Math.ceil((refillDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) {
    return {
      refillStatus: 'overdue',
      daysUntilRefill: diffDays
    };
  }

  if (diffDays <= refillWindowDays) {
    return {
      refillStatus: 'due_soon',
      daysUntilRefill: diffDays
    };
  }

  return {
    refillStatus: 'ok',
    daysUntilRefill: diffDays
  };
}

function buildFallbackMedicationFrequency(reminder = {}) {
  const days = getMedicationReminderDays(reminder);
  if (days.length === 7 || days.length === 0) {
    return 'Daily';
  }

  return `${days.length} times weekly`;
}

function normalizeRecordedMedicationEntry(entry = {}) {
  const status = normalizeEnum(
    entry.status ?? (entry.taken === true ? 'taken' : entry.taken === false ? 'missed' : 'not_due'),
    MEDICATION_ENTRY_STATUSES,
    'not_due'
  );

  const name = normalizeTrimmedString(entry.name);
  const dosage = normalizeTrimmedString(entry.dosage);
  const dueTime = normalizeTrimmedString(entry.dueTime, normalizeTrimmedString(entry.time));
  const sideEffects = normalizeStringArray(entry.sideEffects);

  return {
    reminderId: normalizeTrimmedString(entry.reminderId),
    name,
    dosage,
    dueTime,
    status,
    taken: status === 'taken' || (status === 'partial' && entry.taken !== false),
    dueToday: normalizeBoolean(entry.dueToday, status !== 'not_due'),
    notes: normalizeTrimmedString(entry.notes),
    missedReason: normalizeTrimmedString(entry.missedReason),
    sideEffects,
    refillConcern: normalizeBoolean(entry.refillConcern, false),
    refillNeededSoon: normalizeBoolean(entry.refillNeededSoon, false),
    confirmationSource: normalizeEnum(
      entry.confirmationSource,
      MEDICATION_CONFIRMATION_SOURCES,
      'caregiver'
    ),
    key: getMedicationKey(name, dosage, dueTime)
  };
}

function buildMedicationCatalogItem(reminder = {}, medication = {}, index = 0, date = new Date()) {
  const name = getMedicationName(reminder, medication);
  const dosage = normalizeTrimmedString(reminder.dosage, normalizeTrimmedString(medication.dosage));
  const dueTime = normalizeTrimmedString(reminder.time);
  const refillDueDate = normalizeDate(reminder.refillDueDate, normalizeDate(medication.refillDueDate));
  const refillWindowDays = Number.isFinite(Number(reminder.refillWindowDays))
    ? Number(reminder.refillWindowDays)
    : Number.isFinite(Number(medication.refillWindowDays))
      ? Number(medication.refillWindowDays)
      : 7;
  const refillMeta = getRefillStatus(refillDueDate, refillWindowDays, date);

  return {
    id:
      reminder._id?.toString?.() ??
      medication._id?.toString?.() ??
      `${normalizeMedicationKeyPart(name) || 'medication'}-${index + 1}`,
    reminderId: reminder._id?.toString?.() ?? normalizeTrimmedString(reminder.reminderId),
    key: getMedicationKey(name, dosage, dueTime),
    name,
    dosage,
    frequency: normalizeTrimmedString(
      medication.frequency,
      buildFallbackMedicationFrequency(reminder)
    ),
    status: normalizeTrimmedString(medication.status, 'active'),
    active: normalizeBoolean(reminder.active, true),
    scheduledTime: dueTime || null,
    dueToday: isMedicationDueToday(reminder, date),
    withFood: normalizeBoolean(reminder.withFood, false),
    instructions: normalizeTrimmedString(
      reminder.instructions,
      normalizeTrimmedString(medication.instructions)
    ),
    startDate: normalizeDate(reminder.startDate, normalizeDate(medication.startDate)),
    endDate: normalizeDate(reminder.endDate, normalizeDate(medication.endDate)),
    prescribedBy: normalizeTrimmedString(medication.prescribedBy),
    adherenceRule: normalizeEnum(
      reminder.adherenceRule ?? medication.adherenceRule,
      MEDICATION_ADHERENCE_RULES,
      'required'
    ),
    sideEffectPrompts: normalizeStringArray(
      reminder.sideEffectPrompts ?? medication.sideEffectPrompts
    ),
    refillDueDate,
    refillStatus: refillMeta.refillStatus,
    daysUntilRefill: refillMeta.daysUntilRefill,
    refillWindowDays,
    confirmationSource: normalizeEnum(
      reminder.confirmationSource ?? medication.confirmationSource,
      MEDICATION_CONFIRMATION_SOURCES,
      'caregiver'
    ),
    lastConfirmedAt: normalizeDate(reminder.lastConfirmedAt),
    lastConfirmationStatus: normalizeEnum(
      reminder.lastConfirmationStatus,
      MEDICATION_ENTRY_STATUSES,
      null
    ),
    lastConfirmationSource: normalizeEnum(
      reminder.lastConfirmationSource,
      MEDICATION_CONFIRMATION_SOURCES,
      null
    )
  };
}

export function buildMedicationCatalog(patient = {}, schedule = null, date = new Date()) {
  const medications = Array.isArray(patient.currentMedications) ? patient.currentMedications : [];
  const reminders = Array.isArray(schedule?.medicationReminders)
    ? schedule.medicationReminders
    : Array.isArray(patient.careSchedule?.medicationReminders)
      ? patient.careSchedule.medicationReminders
      : [];
  const items = [];
  const usedMedicationIndexes = new Set();

  reminders.forEach((reminder, index) => {
    const matchingMedicationIndex = medications.findIndex((medication, medicationIndex) => (
      !usedMedicationIndexes.has(medicationIndex) &&
      normalizeMedicationKeyPart(medication?.name) === normalizeMedicationKeyPart(reminder?.medication)
    ));
    const medication = matchingMedicationIndex >= 0 ? medications[matchingMedicationIndex] : {};
    if (matchingMedicationIndex >= 0) {
      usedMedicationIndexes.add(matchingMedicationIndex);
    }

    const item = buildMedicationCatalogItem(reminder, medication, index, date);
    if (item.name) {
      items.push(item);
    }
  });

  medications.forEach((medication, index) => {
    if (usedMedicationIndexes.has(index)) {
      return;
    }

    const item = buildMedicationCatalogItem({}, medication, items.length, date);
    if (item.name) {
      items.push(item);
    }
  });

  return items;
}

function extractMedicationEvents(checkIns = []) {
  return checkIns
    .flatMap((checkIn) => {
      const timestamp = checkIn.actualTime ?? checkIn.createdAt ?? checkIn.timestamp ?? null;
      const entries = Array.isArray(checkIn.medication?.medications)
        ? checkIn.medication.medications
        : [];

      return entries
        .map((entry) => {
          const normalized = normalizeRecordedMedicationEntry(entry);
          if (!normalized.name) {
            return null;
          }

          return {
            ...normalized,
            timestamp,
            checkInId: checkIn._id?.toString?.() ?? null
          };
        })
        .filter(Boolean);
    })
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

export function calculateRecordedMedicationAdherence(checkIns = [], fallback = 0) {
  const events = extractMedicationEvents(checkIns).filter((entry) => entry.status !== 'not_due');
  if (events.length === 0) {
    return fallback;
  }

  const score = events.reduce((total, entry) => {
    if (entry.status === 'taken') {
      return total + 1;
    }

    if (entry.status === 'partial') {
      return total + 0.5;
    }

    return total;
  }, 0);

  return Math.round((score / events.length) * 100);
}

export function buildMedicationSnapshot(patient = {}, schedule = null, checkIns = [], date = new Date()) {
  const catalog = buildMedicationCatalog(patient, schedule, date);
  const events = extractMedicationEvents(checkIns);
  const thirtyDaysAgo = new Date(new Date(date).getTime() - (30 * 24 * 60 * 60 * 1000));
  const recentEvents = events.filter((entry) => entry.timestamp && new Date(entry.timestamp) >= thirtyDaysAgo);
  const adherenceRate = calculateRecordedMedicationAdherence(
    checkIns.filter((entry) => {
      const timestamp = entry.actualTime ?? entry.createdAt ?? entry.timestamp ?? null;
      return timestamp && new Date(timestamp) >= thirtyDaysAgo;
    }),
    patient?.compliance?.medicationAdherence ?? 0
  );

  const medications = catalog.map((item) => {
    const matchingEvents = events.filter((entry) => {
      if (entry.key === item.key) {
        return true;
      }

      return (
        normalizeMedicationKeyPart(entry.name) === normalizeMedicationKeyPart(item.name) &&
        (!item.scheduledTime || !entry.dueTime || item.scheduledTime === entry.dueTime)
      );
    });
    const todayEvents = matchingEvents.filter((entry) => isSameDay(entry.timestamp, date));
    const lastEvent = matchingEvents[0] ?? null;
    const recentMissCount = matchingEvents.filter((entry) => (
      entry.timestamp &&
      new Date(entry.timestamp) >= new Date(new Date(date).getTime() - (14 * 24 * 60 * 60 * 1000)) &&
      entry.status === 'missed'
    )).length;

    const recentSideEffects = Array.from(
      new Set(
        matchingEvents
          .flatMap((entry) => entry.sideEffects || [])
          .map((sideEffect) => normalizeTrimmedString(sideEffect))
          .filter(Boolean)
      )
    );

    const todayStatus = todayEvents[0]?.status ?? null;

    return {
      ...item,
      lastConfirmedAt: lastEvent?.timestamp ?? item.lastConfirmedAt,
      lastConfirmationStatus: todayStatus ?? lastEvent?.status ?? item.lastConfirmationStatus,
      lastConfirmationSource:
        lastEvent?.confirmationSource ?? item.lastConfirmationSource ?? item.confirmationSource,
      takenToday: todayEvents.some((entry) => entry.status === 'taken' || entry.status === 'partial'),
      missedToday: todayEvents.some((entry) => entry.status === 'missed'),
      todayStatus,
      recentMissCount,
      recentSideEffects,
      recentMissReason:
        todayEvents.find((entry) => entry.missedReason)?.missedReason ??
        matchingEvents.find((entry) => entry.missedReason)?.missedReason ??
        '',
      refillConcern:
        item.refillStatus === 'due_soon' ||
        item.refillStatus === 'overdue' ||
        matchingEvents.some((entry) => entry.refillConcern),
      dueNow: item.dueToday
    };
  });

  const dueToday = medications.filter((medication) => medication.dueToday);
  const takenToday = dueToday.filter((medication) => medication.takenToday).length;
  const missedToday = dueToday.filter((medication) => medication.missedToday).length;
  const refillRisks = medications.filter((medication) => medication.refillConcern).length;

  return {
    medications,
    summary: {
      totalActive: medications.filter((medication) => medication.status !== 'stopped').length,
      dueToday: dueToday.length,
      takenToday,
      missedToday,
      refillRisks,
      adherenceRate,
      overdueRefills: medications.filter((medication) => medication.refillStatus === 'overdue').length,
      dueSoonRefills: medications.filter((medication) => medication.refillStatus === 'due_soon').length
    }
  };
}

export function normalizeMedicationCheckInPayload(input = {}, catalog = [], date = new Date()) {
  const todayDueMedications = catalog.filter((medication) => medication.dueToday);
  const incomingEntries = Array.isArray(input?.entries) ? input.entries : [];

  const normalizedEntries = incomingEntries.length > 0
    ? incomingEntries
        .map((entry) => normalizeRecordedMedicationEntry(entry))
        .filter((entry) => entry.name)
    : todayDueMedications.map((medication) =>
        normalizeRecordedMedicationEntry({
          reminderId: medication.reminderId,
          name: medication.name,
          dosage: medication.dosage,
          dueTime: medication.scheduledTime,
          dueToday: medication.dueToday,
          status: input?.taken === false ? 'missed' : 'taken',
          notes: normalizeTrimmedString(input?.notes),
          confirmationSource: 'caregiver'
        })
      );

  const dueEntries = normalizedEntries.filter((entry) => entry.status !== 'not_due');
  const takenCount = dueEntries.filter((entry) => entry.status === 'taken' || entry.status === 'partial').length;
  const missedCount = dueEntries.filter((entry) => entry.status === 'missed').length;
  const sideEffects = Array.from(new Set(
    normalizedEntries.flatMap((entry) => entry.sideEffects || []).filter(Boolean)
  ));

  let adherence = 'not_applicable';
  if (dueEntries.length > 0) {
    if (missedCount === 0) {
      adherence = 'taken';
    } else if (takenCount === 0) {
      adherence = 'missed';
    } else {
      adherence = 'partial';
    }
  }

  return {
    adherence,
    medications: normalizedEntries.map((entry) => ({
      reminderId: entry.reminderId || undefined,
      name: entry.name,
      dosage: entry.dosage || undefined,
      taken: entry.status === 'taken' || entry.status === 'partial',
      status: entry.status,
      dueToday: entry.dueToday,
      dueTime: entry.dueTime || undefined,
      time: normalizeTrimmedString(entry.dueTime, new Date(date).toISOString()),
      notes: entry.notes || undefined,
      missedReason: entry.missedReason || undefined,
      sideEffects: entry.sideEffects,
      refillConcern: entry.refillConcern,
      refillNeededSoon: entry.refillNeededSoon,
      confirmationSource: entry.confirmationSource
    })),
    missedReason:
      normalizeTrimmedString(input?.missedReason) ||
      dueEntries.find((entry) => entry.missedReason)?.missedReason ||
      '',
    notes: normalizeTrimmedString(input?.notes),
    sideEffects,
    refillConcern:
      normalizeBoolean(input?.refillConcern, false) ||
      normalizedEntries.some((entry) => entry.refillConcern),
    dueTodayCount: dueEntries.length,
    takenCount,
    missedCount
  };
}

export function applyMedicationCheckInToSchedule(schedule, medicationPayload = {}, timestamp = new Date()) {
  if (!schedule || !Array.isArray(schedule.medicationReminders)) {
    return schedule;
  }

  const updatesByKey = new Map(
    (medicationPayload.medications || []).map((entry) => {
      const normalized = normalizeRecordedMedicationEntry(entry);
      return [normalized.key, normalized];
    })
  );

  schedule.medicationReminders = schedule.medicationReminders.map((reminder) => {
    const key = getMedicationKey(reminder.medication, reminder.dosage, reminder.time);
    const update = updatesByKey.get(key);
    if (!update) {
      return reminder;
    }

    reminder.lastConfirmedAt = timestamp;
    reminder.lastConfirmationStatus = update.status;
    reminder.lastConfirmationSource = update.confirmationSource;
    return reminder;
  });

  return schedule;
}

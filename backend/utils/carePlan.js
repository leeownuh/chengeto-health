const CARE_PLAN_FREQUENCIES = ['twice-daily', 'daily', 'alternate', 'weekly', 'custom'];
const CARE_PLAN_WINDOWS = ['morning', 'afternoon', 'evening', 'flexible'];
const CARE_PLAN_REVIEW_STATUSES = ['active', 'completed', 'on_hold'];
const CARE_PLAN_RISK_LEVELS = ['low', 'moderate', 'high', 'critical'];
const CARE_PLAN_RESPONDER_ROLES = ['caregiver', 'chw', 'clinician'];
const CARE_PLAN_FAMILY_ACCESS_LEVELS = ['full', 'limited', 'emergency_only'];
const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function normalizeTrimmedString(value, fallback = '') {
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
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

function normalizeEnum(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

function normalizeBoolean(value, fallback) {
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

function normalizeNumber(value, fallback, min = null, max = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (min !== null && parsed < min) {
    return min;
  }

  if (max !== null && parsed > max) {
    return max;
  }

  return parsed;
}

function summarizeUserReference(user) {
  if (!user) {
    return null;
  }

  if (typeof user === 'string') {
    return {
      _id: user,
      id: user,
      name: user
    };
  }

  const id = user._id?.toString?.() ?? user.id?.toString?.() ?? null;
  const firstName = user.firstName ?? '';
  const lastName = user.lastName ?? '';
  const name = [firstName, lastName].filter(Boolean).join(' ').trim() || user.name || id;

  return {
    _id: id,
    id,
    firstName,
    lastName,
    name,
    role: user.role ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null
  };
}

function normalizeGoal(goal = {}, fallbackGoal = {}) {
  const title = normalizeTrimmedString(goal.title, normalizeTrimmedString(fallbackGoal.title));
  const notes = normalizeTrimmedString(goal.notes, normalizeTrimmedString(fallbackGoal.notes));
  const targetDate = normalizeDate(goal.targetDate, normalizeDate(fallbackGoal.targetDate));
  const status = normalizeEnum(
    goal.status ?? fallbackGoal.status,
    CARE_PLAN_REVIEW_STATUSES,
    'active'
  );

  if (!title && !notes && !targetDate) {
    return null;
  }

  return {
    title,
    notes,
    targetDate,
    status
  };
}

export function buildCarePlanPayload(carePlan = {}, existingCarePlan = {}, fallbackFrequency = null) {
  const existingGoals = Array.isArray(existingCarePlan.goals) ? existingCarePlan.goals : [];
  const incomingGoals = Array.isArray(carePlan.goals) ? carePlan.goals : existingGoals;

  const goals = incomingGoals
    .map((goal, index) => normalizeGoal(goal, existingGoals[index]))
    .filter(Boolean);

  const existingRiskProfile = existingCarePlan.riskProfile ?? {};
  const existingVisitCadence = existingCarePlan.visitCadence ?? {};
  const existingEscalationPreferences = existingCarePlan.escalationPreferences ?? {};
  const existingConsentSettings = existingCarePlan.consentSettings ?? {};
  const existingReview = existingCarePlan.review ?? {};
  const riskProfile = carePlan.riskProfile ?? {};
  const visitCadence = carePlan.visitCadence ?? {};
  const escalationPreferences = carePlan.escalationPreferences ?? {};
  const consentSettings = carePlan.consentSettings ?? {};
  const review = carePlan.review ?? {};

  return {
    goals,
    riskProfile: {
      summary: normalizeTrimmedString(riskProfile.summary, normalizeTrimmedString(existingRiskProfile.summary)),
      fallRisk: normalizeEnum(
        riskProfile.fallRisk ?? existingRiskProfile.fallRisk,
        CARE_PLAN_RISK_LEVELS,
        'moderate'
      ),
      medicationRisk: normalizeEnum(
        riskProfile.medicationRisk ?? existingRiskProfile.medicationRisk,
        CARE_PLAN_RISK_LEVELS,
        'moderate'
      ),
      cognitiveRisk: normalizeEnum(
        riskProfile.cognitiveRisk ?? existingRiskProfile.cognitiveRisk,
        CARE_PLAN_RISK_LEVELS,
        'moderate'
      ),
      socialRisk: normalizeEnum(
        riskProfile.socialRisk ?? existingRiskProfile.socialRisk,
        CARE_PLAN_RISK_LEVELS,
        'moderate'
      ),
      caregiverInstructions: normalizeTrimmedString(
        riskProfile.caregiverInstructions,
        normalizeTrimmedString(existingRiskProfile.caregiverInstructions)
      )
    },
    visitCadence: {
      frequency: normalizeEnum(
        visitCadence.frequency ?? fallbackFrequency ?? existingVisitCadence.frequency,
        CARE_PLAN_FREQUENCIES,
        'daily'
      ),
      preferredWindow: normalizeEnum(
        visitCadence.preferredWindow ?? existingVisitCadence.preferredWindow,
        CARE_PLAN_WINDOWS,
        'morning'
      ),
      preferredDays: Array.isArray(visitCadence.preferredDays)
        ? visitCadence.preferredDays.filter((day) => WEEK_DAYS.includes(day))
        : Array.isArray(existingVisitCadence.preferredDays)
          ? existingVisitCadence.preferredDays.filter((day) => WEEK_DAYS.includes(day))
          : [],
      notes: normalizeTrimmedString(
        visitCadence.notes,
        normalizeTrimmedString(existingVisitCadence.notes)
      )
    },
    escalationPreferences: {
      primaryResponderRole: normalizeEnum(
        escalationPreferences.primaryResponderRole ?? existingEscalationPreferences.primaryResponderRole,
        CARE_PLAN_RESPONDER_ROLES,
        'caregiver'
      ),
      notifyFamily: normalizeBoolean(
        escalationPreferences.notifyFamily,
        normalizeBoolean(existingEscalationPreferences.notifyFamily, true)
      ),
      notifyClinicianOnHighRisk: normalizeBoolean(
        escalationPreferences.notifyClinicianOnHighRisk,
        normalizeBoolean(existingEscalationPreferences.notifyClinicianOnHighRisk, true)
      ),
      maxResponseMinutes: normalizeNumber(
        escalationPreferences.maxResponseMinutes,
        normalizeNumber(existingEscalationPreferences.maxResponseMinutes, 30, 5, 1440),
        5,
        1440
      )
    },
    consentSettings: {
      familyAccessLevel: normalizeEnum(
        consentSettings.familyAccessLevel ?? existingConsentSettings.familyAccessLevel,
        CARE_PLAN_FAMILY_ACCESS_LEVELS,
        'limited'
      ),
      familyUpdates: normalizeBoolean(
        consentSettings.familyUpdates,
        normalizeBoolean(existingConsentSettings.familyUpdates, true)
      ),
      emergencySharing: normalizeBoolean(
        consentSettings.emergencySharing,
        normalizeBoolean(existingConsentSettings.emergencySharing, true)
      ),
      dataCollection: normalizeBoolean(
        consentSettings.dataCollection,
        normalizeBoolean(existingConsentSettings.dataCollection, true)
      )
    },
    review: {
      lastReviewedAt: normalizeDate(review.lastReviewedAt, normalizeDate(existingReview.lastReviewedAt)),
      nextReviewDate: normalizeDate(review.nextReviewDate, normalizeDate(existingReview.nextReviewDate)),
      notes: normalizeTrimmedString(review.notes, normalizeTrimmedString(existingReview.notes))
    }
  };
}

export function buildCarePlanResponse(patient) {
  const normalized = buildCarePlanPayload(
    patient?.carePlan ?? {},
    {
      consentSettings: {
        familyAccessLevel:
          patient?.carePlan?.consentSettings?.familyAccessLevel ??
          patient?.familyMembers?.[0]?.accessLevel ??
          (patient?.consent?.familyAccess ? 'limited' : 'emergency_only'),
        familyUpdates:
          patient?.carePlan?.consentSettings?.familyUpdates ??
          Boolean(patient?.consent?.familyAccess),
        emergencySharing:
          patient?.carePlan?.consentSettings?.emergencySharing ??
          Boolean(patient?.consent?.emergencyDataSharing),
        dataCollection:
          patient?.carePlan?.consentSettings?.dataCollection ??
          Boolean(patient?.consent?.dataCollection)
      }
    },
    patient?.carePlan?.visitCadence?.frequency
  );

  const familyContacts = (patient?.familyMembers ?? [])
    .map((member) => ({
      ...summarizeUserReference(member.user),
      relationship: member.relationship ?? '',
      accessLevel: member.accessLevel ?? 'limited',
      approvedAt: member.approvedAt ?? null
    }))
    .filter((member) => member._id || member.name);

  const emergencyContacts = (patient?.emergencyContacts ?? []).map((contact) => ({
    name: contact.name ?? '',
    relationship: contact.relationship ?? '',
    phone: contact.phone ?? '',
    isPrimary: Boolean(contact.isPrimary)
  }));

  return {
    ...normalized,
    careTeam: {
      primaryCaregiver: summarizeUserReference(patient?.primaryCaregiver),
      assignedCHW: summarizeUserReference(patient?.assignedCHW),
      assignedClinician: summarizeUserReference(patient?.assignedClinician)
    },
    familyContacts,
    emergencyContacts
  };
}


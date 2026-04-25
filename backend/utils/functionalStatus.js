const MOBILITY_LEVELS = ['independent', 'assisted', 'wheelchair', 'bedbound'];
const GAIT_LEVELS = ['steady', 'slow', 'shuffling', 'unsteady'];
const BALANCE_LEVELS = ['stable', 'needs_support', 'unstable'];
const ASSISTIVE_DEVICES = ['none', 'cane', 'walker', 'wheelchair', 'bed_rail', 'other'];
const VISION_LEVELS = ['adequate', 'impaired', 'severely_impaired'];
const HEARING_LEVELS = ['adequate', 'impaired', 'severely_impaired'];
const CONTINENCE_LEVELS = ['independent', 'occasional_issues', 'incontinent'];
const WEIGHT_LOSS_RISK_LEVELS = ['low', 'moderate', 'high'];
const FRAILTY_LEVELS = ['robust', 'pre_frail', 'frail'];
const HOME_SAFETY_LEVELS = ['safe', 'needs_minor_changes', 'unsafe'];
const WALKING_DIFFICULTY_LEVELS = ['none', 'mild', 'moderate', 'severe'];

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function pickString(value, fallback) {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function pickBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function pickNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickDate(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function pickStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

export function buildFunctionalBaselinePayload(input = {}, existing = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const previous = existing && typeof existing === 'object' ? existing : {};
  const previousFalls = previous.recentFalls && typeof previous.recentFalls === 'object'
    ? previous.recentFalls
    : {};
  const sourceFalls = source.recentFalls && typeof source.recentFalls === 'object'
    ? source.recentFalls
    : {};

  return {
    mobility: pickEnum(source.mobility, MOBILITY_LEVELS, previous.mobility),
    gait: pickEnum(source.gait, GAIT_LEVELS, previous.gait),
    balance: pickEnum(source.balance, BALANCE_LEVELS, previous.balance),
    assistiveDevice: pickEnum(source.assistiveDevice, ASSISTIVE_DEVICES, previous.assistiveDevice),
    vision: pickEnum(source.vision, VISION_LEVELS, previous.vision),
    hearing: pickEnum(source.hearing, HEARING_LEVELS, previous.hearing),
    continence: pickEnum(source.continence, CONTINENCE_LEVELS, previous.continence),
    weightLossRisk: pickEnum(source.weightLossRisk, WEIGHT_LOSS_RISK_LEVELS, previous.weightLossRisk),
    frailty: pickEnum(source.frailty, FRAILTY_LEVELS, previous.frailty),
    homeSafety: pickEnum(source.homeSafety, HOME_SAFETY_LEVELS, previous.homeSafety),
    recentFalls: {
      count: pickNumber(sourceFalls.count, previousFalls.count ?? 0),
      lastFallAt: pickDate(sourceFalls.lastFallAt, previousFalls.lastFallAt),
      injuryFromLastFall: pickBoolean(
        sourceFalls.injuryFromLastFall,
        previousFalls.injuryFromLastFall ?? false
      )
    },
    notes: pickString(source.notes, previous.notes),
    lastReviewedAt: pickDate(source.lastReviewedAt, previous.lastReviewedAt)
  };
}

export function buildFunctionalAssessmentPayload(input = {}, existing = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const previous = existing && typeof existing === 'object' ? existing : {};

  return {
    changedSinceLastVisit: pickBoolean(source.changedSinceLastVisit, false),
    changeNotes: pickString(source.changeNotes, ''),
    mobility: pickEnum(source.mobility, MOBILITY_LEVELS, previous.mobility),
    gait: pickEnum(source.gait, GAIT_LEVELS, previous.gait),
    balance: pickEnum(source.balance, BALANCE_LEVELS, previous.balance),
    assistiveDevice: pickEnum(source.assistiveDevice, ASSISTIVE_DEVICES, previous.assistiveDevice),
    frailty: pickEnum(source.frailty, FRAILTY_LEVELS, previous.frailty),
    walkingDifficulty: pickEnum(source.walkingDifficulty, WALKING_DIFFICULTY_LEVELS, 'none'),
    visionConcern: pickBoolean(source.visionConcern, false),
    hearingConcern: pickBoolean(source.hearingConcern, false),
    continenceConcern: pickBoolean(source.continenceConcern, false),
    confusionChange: pickBoolean(source.confusionChange, false),
    appetiteConcern: pickBoolean(source.appetiteConcern, false),
    weightConcern: pickBoolean(source.weightConcern, false),
    homeSafetyConcern: pickBoolean(source.homeSafetyConcern, false),
    recentFall: pickBoolean(source.recentFall, false),
    nearFall: pickBoolean(source.nearFall, false),
    fallInjury: pickBoolean(source.fallInjury, false),
    fearOfFalling: pickBoolean(source.fearOfFalling, false),
    frailtySigns: pickStringArray(source.frailtySigns),
    caregiverObservations: pickStringArray(source.caregiverObservations)
  };
}

export {
  ASSISTIVE_DEVICES,
  BALANCE_LEVELS,
  CONTINENCE_LEVELS,
  FRAILTY_LEVELS,
  GAIT_LEVELS,
  HEARING_LEVELS,
  HOME_SAFETY_LEVELS,
  MOBILITY_LEVELS,
  VISION_LEVELS,
  WALKING_DIFFICULTY_LEVELS,
  WEIGHT_LOSS_RISK_LEVELS
};

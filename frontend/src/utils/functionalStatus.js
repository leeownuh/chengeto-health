const LABELS = {
  mobility: {
    independent: 'Independent',
    assisted: 'Needs assistance',
    wheelchair: 'Wheelchair',
    bedbound: 'Bedbound',
    normal: 'Independent',
    limited: 'Limited',
    needs_assistance: 'Needs assistance',
    bedridden: 'Bedbound'
  },
  gait: {
    steady: 'Steady',
    slow: 'Slow',
    shuffling: 'Shuffling',
    unsteady: 'Unsteady'
  },
  balance: {
    stable: 'Stable',
    needs_support: 'Needs support',
    unstable: 'Unstable'
  },
  assistiveDevice: {
    none: 'None',
    cane: 'Cane',
    walker: 'Walker',
    wheelchair: 'Wheelchair',
    bed_rail: 'Bed rail',
    other: 'Other'
  },
  vision: {
    adequate: 'Adequate',
    impaired: 'Impaired',
    severely_impaired: 'Severely impaired'
  },
  hearing: {
    adequate: 'Adequate',
    impaired: 'Impaired',
    severely_impaired: 'Severely impaired'
  },
  continence: {
    independent: 'Independent',
    occasional_issues: 'Occasional issues',
    incontinent: 'Incontinent'
  },
  weightLossRisk: {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High'
  },
  frailty: {
    robust: 'Robust',
    pre_frail: 'Pre-frail',
    frail: 'Frail'
  },
  homeSafety: {
    safe: 'Safe',
    needs_minor_changes: 'Needs minor changes',
    unsafe: 'Unsafe'
  },
  walkingDifficulty: {
    none: 'None',
    mild: 'Mild',
    moderate: 'Moderate',
    severe: 'Severe'
  }
};

const SEVERITY = {
  mobility: { independent: 0, normal: 0, limited: 1, assisted: 1, needs_assistance: 1, wheelchair: 2, bedbound: 3, bedridden: 3 },
  gait: { steady: 0, slow: 1, shuffling: 2, unsteady: 3 },
  balance: { stable: 0, needs_support: 1, unstable: 2 },
  frailty: { robust: 0, pre_frail: 1, frail: 2 },
  walkingDifficulty: { none: 0, mild: 1, moderate: 2, severe: 3 }
};

const labelize = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getSeverity = (field, value) => SEVERITY[field]?.[value] ?? 0;

export function formatFunctionalValue(field, value, fallback = 'Not assessed') {
  if (!value) {
    return fallback;
  }

  return LABELS[field]?.[value] || labelize(value);
}

export function getFunctionalConcernLabels(assessment = {}) {
  const labels = [];

  if (assessment.recentFall) labels.push('Recent fall');
  if (assessment.nearFall) labels.push('Near fall');
  if (assessment.fallInjury) labels.push('Possible injury');
  if (assessment.fearOfFalling) labels.push('Fear of falling');
  if (assessment.changedSinceLastVisit) labels.push('Decline since last visit');
  if (assessment.visionConcern) labels.push('Vision concern');
  if (assessment.hearingConcern) labels.push('Hearing concern');
  if (assessment.continenceConcern) labels.push('Continence concern');
  if (assessment.confusionChange) labels.push('Cognitive change');
  if (assessment.appetiteConcern) labels.push('Appetite concern');
  if (assessment.weightConcern) labels.push('Weight concern');
  if (assessment.homeSafetyConcern) labels.push('Home safety concern');
  if (assessment.walkingDifficulty && assessment.walkingDifficulty !== 'none') {
    labels.push(`Walking difficulty: ${formatFunctionalValue('walkingDifficulty', assessment.walkingDifficulty)}`);
  }

  return labels;
}

export function buildFunctionalSummary(patient, checkIns = []) {
  const baseline = patient?.functionalBaseline || {};
  const assessments = (Array.isArray(checkIns) ? checkIns : [])
    .filter((checkIn) => checkIn?.functionalStatus)
    .map((checkIn) => ({
      timestamp: checkIn.timestamp || checkIn.createdAt || checkIn.actualTime,
      assessment: checkIn.functionalStatus
    }))
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));

  const latest = assessments[0]?.assessment || null;
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const recentEvents = assessments.filter((entry) => {
    const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
    return timestamp >= now - thirtyDaysMs;
  });
  const recentFalls30Days = recentEvents.filter((entry) => entry.assessment.recentFall).length;
  const nearFalls30Days = recentEvents.filter((entry) => entry.assessment.nearFall).length;
  const concernLabels = getFunctionalConcernLabels(latest || {});

  const declineSignals = [];
  if (latest?.changedSinceLastVisit) {
    declineSignals.push('Reported decline since last visit');
  }
  if (getSeverity('mobility', latest?.mobility) > getSeverity('mobility', baseline.mobility)) {
    declineSignals.push('Mobility is worse than baseline');
  }
  if (getSeverity('gait', latest?.gait) > getSeverity('gait', baseline.gait)) {
    declineSignals.push('Gait has worsened');
  }
  if (getSeverity('balance', latest?.balance) > getSeverity('balance', baseline.balance)) {
    declineSignals.push('Balance has worsened');
  }
  if (getSeverity('frailty', latest?.frailty) > getSeverity('frailty', baseline.frailty)) {
    declineSignals.push('Frailty has increased');
  }
  if ((latest?.frailtySigns || []).length > 0) {
    declineSignals.push(`Frailty signs: ${latest.frailtySigns.join(', ')}`);
  }

  let riskLevel = patient?.carePlan?.riskProfile?.fallRisk || 'moderate';
  if (
    latest?.recentFall ||
    latest?.fallInjury ||
    latest?.balance === 'unstable' ||
    latest?.walkingDifficulty === 'severe'
  ) {
    riskLevel = 'high';
  } else if (
    latest?.nearFall ||
    latest?.fearOfFalling ||
    latest?.balance === 'needs_support' ||
    latest?.walkingDifficulty === 'moderate'
  ) {
    riskLevel = 'moderate';
  } else if (latest || baseline.mobility || baseline.gait || baseline.balance) {
    riskLevel = 'low';
  }

  let trend = 'not_assessed';
  if (latest) {
    trend = declineSignals.length > 0 || concernLabels.length > 0 ? 'worsening' : 'stable';
  } else if (baseline.mobility || baseline.gait || baseline.balance) {
    trend = 'baseline_only';
  }

  return {
    baseline,
    latest,
    riskLevel,
    trend,
    recentFalls30Days,
    nearFalls30Days,
    concernLabels,
    declineSignals,
    currentMobility: formatFunctionalValue('mobility', latest?.mobility || baseline.mobility),
    currentGait: formatFunctionalValue('gait', latest?.gait || baseline.gait),
    currentBalance: formatFunctionalValue('balance', latest?.balance || baseline.balance),
    currentAssistiveDevice: formatFunctionalValue('assistiveDevice', latest?.assistiveDevice || baseline.assistiveDevice),
    currentFrailty: formatFunctionalValue('frailty', latest?.frailty || baseline.frailty),
    history: assessments.slice(0, 5).map((entry) => ({
      timestamp: entry.timestamp,
      mobility: formatFunctionalValue('mobility', entry.assessment.mobility),
      gait: formatFunctionalValue('gait', entry.assessment.gait),
      balance: formatFunctionalValue('balance', entry.assessment.balance),
      concerns: getFunctionalConcernLabels(entry.assessment)
    }))
  };
}

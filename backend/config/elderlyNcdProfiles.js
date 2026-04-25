export const ELDERLY_NCD_PROFILES = {
  hypertension: {
    label: 'Hypertension',
    category: 'cardiometabolic',
    monitoringLevel: 'direct_device',
    recommendedSignals: ['bloodPressure', 'heartRate'],
    recommendedDevices: ['upper_arm_bp_monitor'],
    thresholdDomains: ['systolic', 'diastolic', 'heartRate'],
    notes: 'Home upper-arm blood pressure monitoring is a core device-supported signal.'
  },
  coronary_artery_disease: {
    label: 'Coronary Artery Disease',
    category: 'cardiometabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['bloodPressure', 'heartRate', 'oxygenSaturation', 'activity'],
    recommendedDevices: ['upper_arm_bp_monitor', 'wearable_heart_rate_tracker', 'pulse_oximeter'],
    thresholdDomains: ['systolic', 'diastolic', 'heartRate', 'spo2'],
    notes: 'Device data supports trend monitoring, but chest pain and exertional symptoms still require clinical review.'
  },
  heart_failure: {
    label: 'Heart Failure',
    category: 'cardiometabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['weight', 'bloodPressure', 'heartRate', 'oxygenSaturation', 'respiratoryRate'],
    recommendedDevices: ['digital_weight_scale', 'upper_arm_bp_monitor', 'pulse_oximeter', 'wearable_heart_rate_tracker'],
    thresholdDomains: ['weight', 'systolic', 'diastolic', 'heartRate', 'spo2', 'respiratoryRate'],
    notes: 'Daily weight, breathing status, and oxygenation are important home-monitoring inputs alongside symptoms like swelling.'
  },
  atrial_fibrillation: {
    label: 'Atrial Fibrillation / Arrhythmia',
    category: 'cardiometabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['heartRate', 'rhythmIrregularity', 'bloodPressure'],
    recommendedDevices: ['wearable_ecg_or_ppg', 'upper_arm_bp_monitor'],
    thresholdDomains: ['heartRate', 'systolic', 'diastolic'],
    notes: 'Wearables can flag irregular rhythm, but they are screening tools and do not replace diagnostic ECG review.'
  },
  stroke_history: {
    label: 'Stroke / TIA History',
    category: 'neurologic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['bloodPressure', 'heartRate', 'activity', 'fallDetection'],
    recommendedDevices: ['upper_arm_bp_monitor', 'wearable_heart_rate_tracker', 'fall_detector'],
    thresholdDomains: ['systolic', 'diastolic', 'heartRate'],
    notes: 'Blood pressure and mobility trends are device-friendly, while new neurologic deficits remain symptom-driven.'
  },
  type_2_diabetes: {
    label: 'Type 2 Diabetes',
    category: 'metabolic',
    monitoringLevel: 'direct_device',
    recommendedSignals: ['bloodGlucose', 'weight', 'activity'],
    recommendedDevices: ['glucometer_or_cgm', 'digital_weight_scale', 'activity_tracker'],
    thresholdDomains: ['bloodGlucose', 'weight'],
    notes: 'Use a glucometer or CGM for glucose data; consumer watches and rings should not be treated as glucose monitors.'
  },
  chronic_kidney_disease: {
    label: 'Chronic Kidney Disease',
    category: 'metabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['bloodPressure', 'weight', 'heartRate'],
    recommendedDevices: ['upper_arm_bp_monitor', 'digital_weight_scale'],
    thresholdDomains: ['systolic', 'diastolic', 'weight'],
    notes: 'Blood pressure and fluid-related weight trends are useful at home, while kidney function staging still depends on lab testing.'
  },
  copd: {
    label: 'COPD',
    category: 'respiratory',
    monitoringLevel: 'mixed',
    recommendedSignals: ['oxygenSaturation', 'respiratoryRate', 'heartRate', 'activity'],
    recommendedDevices: ['pulse_oximeter', 'respiratory_monitor', 'wearable_heart_rate_tracker'],
    thresholdDomains: ['spo2', 'respiratoryRate', 'heartRate'],
    notes: 'Pulse oximetry and breathing rate can help with trend monitoring, but worsening breathlessness still needs symptom escalation.'
  },
  asthma: {
    label: 'Asthma',
    category: 'respiratory',
    monitoringLevel: 'mixed',
    recommendedSignals: ['oxygenSaturation', 'respiratoryRate', 'heartRate'],
    recommendedDevices: ['pulse_oximeter', 'respiratory_monitor'],
    thresholdDomains: ['spo2', 'respiratoryRate', 'heartRate'],
    notes: 'Respiratory trends are useful, and peak flow can be added later as a manual or device-supported input.'
  },
  dementia_alzheimers: {
    label: 'Dementia / Alzheimer’s Disease',
    category: 'cognitive',
    monitoringLevel: 'proxy_only',
    recommendedSignals: ['activity', 'sleep', 'fallDetection', 'locationSafety'],
    recommendedDevices: ['activity_tracker', 'fall_detector', 'location_wearable'],
    thresholdDomains: ['activity'],
    notes: 'Cognition is not directly measured by home medical devices; safety, wandering risk, sleep, and falls are proxy monitoring targets.'
  },
  parkinsons_disease: {
    label: 'Parkinson’s Disease',
    category: 'neurologic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['activity', 'fallDetection', 'gaitMobility', 'sleep', 'heartRate'],
    recommendedDevices: ['activity_tracker', 'fall_detector', 'wearable_heart_rate_tracker'],
    thresholdDomains: ['heartRate', 'activity'],
    notes: 'Wearables help with gait, mobility, falls, and sleep trends, but symptom severity still requires clinical assessment.'
  },
  osteoarthritis: {
    label: 'Osteoarthritis',
    category: 'musculoskeletal',
    monitoringLevel: 'proxy_only',
    recommendedSignals: ['activity', 'gaitMobility', 'painScore'],
    recommendedDevices: ['activity_tracker'],
    thresholdDomains: ['activity'],
    notes: 'Pain and function are the main monitoring targets; device support is best used for mobility and activity trends.'
  },
  osteoporosis_frailty: {
    label: 'Osteoporosis / Frailty',
    category: 'musculoskeletal',
    monitoringLevel: 'mixed',
    recommendedSignals: ['fallDetection', 'activity', 'weight', 'gaitMobility'],
    recommendedDevices: ['fall_detector', 'activity_tracker', 'digital_weight_scale'],
    thresholdDomains: ['weight', 'activity'],
    notes: 'Fall detection, mobility decline, and unintended weight loss are useful home-monitoring signals.'
  },
  cancer_survivorship: {
    label: 'Cancer / Survivorship',
    category: 'other',
    monitoringLevel: 'proxy_only',
    recommendedSignals: ['weight', 'temperature', 'activity'],
    recommendedDevices: ['digital_weight_scale', 'thermometer', 'activity_tracker'],
    thresholdDomains: ['weight', 'temperature'],
    notes: 'Home devices can track treatment-tolerance proxies like fever, activity, and weight, but not cancer status itself.'
  },
  other: {
    label: 'Other Chronic Condition',
    category: 'other',
    monitoringLevel: 'mixed',
    recommendedSignals: ['heartRate', 'bloodPressure', 'activity'],
    recommendedDevices: ['wearable_heart_rate_tracker', 'upper_arm_bp_monitor'],
    thresholdDomains: ['heartRate', 'systolic', 'diastolic'],
    notes: 'Use this when the condition is chronic but not yet mapped; tailor device inputs clinically.'
  }
};

export const ELDERLY_NCD_TYPES = Object.keys(ELDERLY_NCD_PROFILES);

export const SIGNAL_LABELS = {
  bloodPressure: 'Blood pressure',
  heartRate: 'Heart rate',
  oxygenSaturation: 'SpO2',
  temperature: 'Temperature',
  respiratoryRate: 'Respiratory rate',
  bloodGlucose: 'Blood glucose',
  weight: 'Weight',
  activity: 'Activity / steps',
  fallDetection: 'Fall detection',
  sleep: 'Sleep',
  locationSafety: 'Location / wandering safety',
  gaitMobility: 'Gait / mobility',
  painScore: 'Pain score',
  rhythmIrregularity: 'Irregular rhythm flag'
};

export function getElderlyNcdProfile(type) {
  return ELDERLY_NCD_PROFILES[type] ?? ELDERLY_NCD_PROFILES.other;
}

export function normalizeNcdConditions(input = []) {
  return (input ?? [])
    .map((entry) => {
      if (!entry) {
        return null;
      }

      if (typeof entry === 'string') {
        return {
          type: ELDERLY_NCD_PROFILES[entry] ? entry : 'other',
          severity: 'controlled'
        };
      }

      const type = ELDERLY_NCD_PROFILES[entry.type] ? entry.type : 'other';
      return {
        type,
        diagnosedYear: entry.diagnosedYear,
        severity: entry.severity ?? 'controlled',
        lastReviewDate: entry.lastReviewDate
      };
    })
    .filter(Boolean);
}

export function buildMonitoringSummary(ncdConditions = []) {
  const conditionTypes = normalizeNcdConditions(ncdConditions).map((entry) => entry.type);
  const profiles = [...new Set(conditionTypes)].map((type) => getElderlyNcdProfile(type));

  const monitoringLevel =
    profiles.some((profile) => profile.monitoringLevel === 'direct_device')
      ? 'direct_device'
      : profiles.some((profile) => profile.monitoringLevel === 'mixed')
        ? 'mixed'
        : profiles.length
          ? 'proxy_only'
          : 'mixed';

  return {
    conditionTypes,
    conditionLabels: profiles.map((profile) => profile.label),
    monitoringLevel,
    recommendedSignals: [...new Set(profiles.flatMap((profile) => profile.recommendedSignals))],
    recommendedSignalLabels: [
      ...new Set(
        profiles.flatMap((profile) => profile.recommendedSignals.map((signal) => SIGNAL_LABELS[signal] ?? signal))
      )
    ],
    signalLabels: [
      ...new Set(
        profiles.flatMap((profile) => profile.recommendedSignals.map((signal) => SIGNAL_LABELS[signal] ?? signal))
      )
    ],
    recommendedDevices: [...new Set(profiles.flatMap((profile) => profile.recommendedDevices))],
    thresholdDomains: [...new Set(profiles.flatMap((profile) => profile.thresholdDomains))],
    notes: profiles.map((profile) => profile.notes).filter(Boolean)
  };
}

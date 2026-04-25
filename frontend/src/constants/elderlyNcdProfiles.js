export const ELDERLY_NCD_PROFILES = {
  hypertension: {
    label: 'Hypertension',
    category: 'cardiometabolic',
    monitoringLevel: 'direct_device',
    recommendedSignals: ['bloodPressure', 'heartRate'],
    thresholdDomains: ['systolic', 'diastolic', 'heartRate'],
    notes: 'Home upper-arm blood pressure monitoring is a core device-supported signal.'
  },
  coronary_artery_disease: {
    label: 'Coronary Artery Disease',
    category: 'cardiometabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['bloodPressure', 'heartRate', 'oxygenSaturation', 'activity'],
    thresholdDomains: ['systolic', 'diastolic', 'heartRate', 'spo2'],
    notes: 'Device trends are useful, but chest pain and exertional symptoms still need clinical review.'
  },
  heart_failure: {
    label: 'Heart Failure',
    category: 'cardiometabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['weight', 'bloodPressure', 'heartRate', 'oxygenSaturation', 'respiratoryRate'],
    thresholdDomains: ['weight', 'systolic', 'diastolic', 'heartRate', 'spo2', 'respiratoryRate'],
    notes: 'Daily weight, breathing status, and oxygenation are priority home-monitoring inputs.'
  },
  atrial_fibrillation: {
    label: 'Atrial Fibrillation / Arrhythmia',
    category: 'cardiometabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['heartRate', 'rhythmIrregularity', 'bloodPressure'],
    thresholdDomains: ['heartRate', 'systolic', 'diastolic'],
    notes: 'Wearables can flag irregular rhythm, but they do not replace diagnostic ECG review.'
  },
  stroke_history: {
    label: 'Stroke / TIA History',
    category: 'neurologic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['bloodPressure', 'heartRate', 'activity', 'fallDetection'],
    thresholdDomains: ['systolic', 'diastolic', 'heartRate'],
    notes: 'Blood pressure and mobility are device-friendly, while new neurologic deficits remain symptom-driven.'
  },
  type_2_diabetes: {
    label: 'Type 2 Diabetes',
    category: 'metabolic',
    monitoringLevel: 'direct_device',
    recommendedSignals: ['bloodGlucose', 'weight', 'activity'],
    thresholdDomains: ['bloodGlucose', 'weight'],
    notes: 'Use a glucometer or CGM for glucose data; consumer watches and rings should not be treated as glucose monitors.'
  },
  chronic_kidney_disease: {
    label: 'Chronic Kidney Disease',
    category: 'metabolic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['bloodPressure', 'weight', 'heartRate'],
    thresholdDomains: ['systolic', 'diastolic', 'weight'],
    notes: 'Blood pressure and fluid-related weight trends are useful at home, while kidney function still depends on lab testing.'
  },
  copd: {
    label: 'COPD',
    category: 'respiratory',
    monitoringLevel: 'mixed',
    recommendedSignals: ['oxygenSaturation', 'respiratoryRate', 'heartRate', 'activity'],
    thresholdDomains: ['spo2', 'respiratoryRate', 'heartRate'],
    notes: 'Pulse oximetry and breathing rate can help with trend monitoring, but worsening breathlessness still needs escalation.'
  },
  asthma: {
    label: 'Asthma',
    category: 'respiratory',
    monitoringLevel: 'mixed',
    recommendedSignals: ['oxygenSaturation', 'respiratoryRate', 'heartRate'],
    thresholdDomains: ['spo2', 'respiratoryRate', 'heartRate'],
    notes: 'Respiratory trends are useful, and peak flow can be added later as a manual or device-supported input.'
  },
  dementia_alzheimers: {
    label: 'Dementia / Alzheimer’s Disease',
    category: 'cognitive',
    monitoringLevel: 'proxy_only',
    recommendedSignals: ['activity', 'sleep', 'fallDetection', 'locationSafety'],
    thresholdDomains: ['activity'],
    notes: 'Cognition is not directly measured by home devices; safety, wandering risk, sleep, and falls are proxy targets.'
  },
  parkinsons_disease: {
    label: 'Parkinson’s Disease',
    category: 'neurologic',
    monitoringLevel: 'mixed',
    recommendedSignals: ['activity', 'fallDetection', 'gaitMobility', 'sleep', 'heartRate'],
    thresholdDomains: ['heartRate', 'activity'],
    notes: 'Wearables help with gait, mobility, falls, and sleep trends, but symptom severity still needs clinical assessment.'
  },
  osteoarthritis: {
    label: 'Osteoarthritis',
    category: 'musculoskeletal',
    monitoringLevel: 'proxy_only',
    recommendedSignals: ['activity', 'gaitMobility', 'painScore'],
    thresholdDomains: ['activity'],
    notes: 'Pain and function are the main monitoring targets; device support is best used for mobility and activity trends.'
  },
  osteoporosis_frailty: {
    label: 'Osteoporosis / Frailty',
    category: 'musculoskeletal',
    monitoringLevel: 'mixed',
    recommendedSignals: ['fallDetection', 'activity', 'weight', 'gaitMobility'],
    thresholdDomains: ['weight', 'activity'],
    notes: 'Fall detection, mobility decline, and unintended weight loss are useful home-monitoring signals.'
  },
  cancer_survivorship: {
    label: 'Cancer / Survivorship',
    category: 'other',
    monitoringLevel: 'proxy_only',
    recommendedSignals: ['weight', 'temperature', 'activity'],
    thresholdDomains: ['weight', 'temperature'],
    notes: 'Home devices can track fever, activity, and weight, but not cancer status itself.'
  },
  other: {
    label: 'Other Chronic Condition',
    category: 'other',
    monitoringLevel: 'mixed',
    recommendedSignals: ['heartRate', 'bloodPressure', 'activity'],
    thresholdDomains: ['heartRate', 'systolic', 'diastolic'],
    notes: 'Use this when the condition is chronic but not yet mapped; tailor monitoring clinically.'
  }
};

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

export const ELDERLY_NCD_OPTIONS = Object.entries(ELDERLY_NCD_PROFILES).map(([value, profile]) => ({
  value,
  ...profile
}));

export function getElderlyNcdMonitoringSummary(ncdConditions = []) {
  const profiles = [...new Set((ncdConditions ?? []).map((type) => ELDERLY_NCD_PROFILES[type] ?? ELDERLY_NCD_PROFILES.other))];

  const monitoringLevel =
    profiles.some((profile) => profile.monitoringLevel === 'direct_device')
      ? 'direct_device'
      : profiles.some((profile) => profile.monitoringLevel === 'mixed')
        ? 'mixed'
        : profiles.length
          ? 'proxy_only'
          : 'mixed';

  return {
    monitoringLevel,
    conditionLabels: profiles.map((profile) => profile.label),
    signalKeys: [...new Set(profiles.flatMap((profile) => profile.recommendedSignals))],
    signalLabels: [
      ...new Set(
        profiles.flatMap((profile) => profile.recommendedSignals.map((signal) => SIGNAL_LABELS[signal] ?? signal))
      )
    ],
    thresholdDomains: [...new Set(profiles.flatMap((profile) => profile.thresholdDomains))],
    notes: profiles.map((profile) => profile.notes).filter(Boolean)
  };
}

/**
 * MQTT Ingestion Service
 *
 * Bridges MQTT device messages (Aedes broker) into the same MongoDB-backed
 * models the HTTP API uses. This enables the in-app IoT Simulator (browser)
 * and the Node iot-simulator scripts to behave like real hardware producers.
 *
 * Topics (examples):
 * - chengeto/<patientMongoId>/telemetry
 * - chengeto/<patientMongoId>/status
 * - chengeto/<patientMongoId>/alert
 */

import mongoose from 'mongoose';
import IoTTelemetry from '../models/IoTTelemetry.js';
import IoTDevice from '../models/IoTDevice.js';
import Patient from '../models/Patient.js';
import Alert from '../models/Alert.js';
import { logger } from '../config/logger.js';

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const mapMotionType = (activity) => {
  switch (activity) {
    case 'stationary':
      return 'sitting';
    case 'fall_detected':
      return 'falling';
    case 'running':
      return 'walking';
    default:
      return activity ?? 'unknown';
  }
};

const buildTelemetryVitals = (vitals = {}) => {
  return {
    heartRate:
      vitals.heartRate !== undefined
        ? {
            value: Number(vitals.heartRate),
            unit: 'bpm',
            status: 'normal',
            source: vitals.heartRateSource ?? 'ppg'
          }
        : undefined,
    bloodPressure:
      vitals.bloodPressure?.systolic || vitals.bloodPressure?.diastolic
        ? {
            systolic:
              vitals.bloodPressure?.systolic !== undefined
                ? { value: Number(vitals.bloodPressure.systolic), status: 'normal' }
                : undefined,
            diastolic:
              vitals.bloodPressure?.diastolic !== undefined
                ? { value: Number(vitals.bloodPressure.diastolic), status: 'normal' }
                : undefined,
            unit: 'mmHg',
            measuredAt: new Date()
          }
        : undefined,
    oxygenSaturation:
      vitals.oxygenSaturation !== undefined
        ? { value: Number(vitals.oxygenSaturation), unit: '%', status: 'normal' }
        : undefined,
    temperature:
      vitals.temperature !== undefined
        ? { value: Number(vitals.temperature), unit: 'C', status: 'normal', location: 'wrist' }
        : undefined,
    respiratoryRate:
      vitals.respiratoryRate !== undefined
        ? { value: Number(vitals.respiratoryRate), unit: 'breaths/min', status: 'normal' }
        : undefined,
    bloodGlucose:
      vitals.bloodGlucose !== undefined || vitals.glucoseLevel !== undefined
        ? {
            value: Number(vitals.bloodGlucose ?? vitals.glucoseLevel),
            unit: 'mg/dL',
            context: vitals.mealContext ?? 'random',
            status: 'normal'
          }
        : undefined,
    weight:
      vitals.weight !== undefined
        ? { value: Number(vitals.weight), unit: vitals.weightUnit ?? 'kg', status: 'normal' }
        : undefined,
    cardiacRhythm:
      typeof vitals.rhythmIrregularity === 'boolean'
        ? {
            irregular: vitals.rhythmIrregularity,
            source: vitals.rhythmSource ?? 'ppg',
            summary: vitals.rhythmSummary ?? '',
            status: vitals.rhythmIrregularity ? 'abnormal' : 'normal'
          }
        : undefined
  };
};

const buildFallPayload = (motion = {}) => {
  if (!motion.fallDetected && !motion.impactForce && motion.activity !== 'fall_detected') {
    return undefined;
  }

  return {
    detected: Boolean(motion.fallDetected || motion.activity === 'fall_detected'),
    confidence: motion.fallConfidence,
    impactForce: motion.impactForce,
    fallType: 'unknown',
    recoveryDetected: false
  };
};

const buildAlertFromDevice = ({ patientId, deviceId, payload, derivedFrom }) => {
  const rawType = String(payload?.type || payload?.alertType || derivedFrom || 'vital_sign');
  const normalizedType =
    rawType === 'fall' ? 'fall_detected' :
    rawType === 'vital_anomaly' ? 'vital_sign' :
    rawType === 'low_battery' ? 'low_battery' :
    rawType;

  const severity = ['low', 'medium', 'high', 'critical'].includes(payload?.severity)
    ? payload.severity
    : normalizedType === 'panic'
      ? 'critical'
      : 'medium';

  const title =
    payload?.title ||
    (normalizedType === 'panic' ? 'Panic Alert' :
      normalizedType === 'fall_detected' ? 'Fall Detected' :
      normalizedType === 'low_battery' ? 'Low Battery' :
      'Device Alert');

  const message =
    payload?.message ||
    payload?.description ||
    `Device event: ${normalizedType}`;

  return {
    patient: patientId,
    type: normalizedType,
    severity,
    title,
    message,
    source: {
      type: 'sensor',
      deviceId,
      sensorType: payload?.sensorType || normalizedType,
      triggerValue: payload?.triggerValue || payload
    },
    location: payload?.location,
    vitalSnapshot: payload?.vitalSnapshot
  };
};

const parseJsonPayload = (buffer) => {
  try {
    const text = buffer?.toString?.('utf8') ?? '';
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const normalizeTelemetryPayload = (payload, topicPatientId) => {
  if (!payload || typeof payload !== 'object') return null;

  // Support both "vitals: { heartRate: 72 }" (API shape) and simulator shapes.
  if (!payload.vitals) {
    const vitals = {};
    if (payload.heartRate?.value !== undefined) vitals.heartRate = payload.heartRate.value;
    if (payload.oxygenSaturation?.value !== undefined) vitals.oxygenSaturation = payload.oxygenSaturation.value;
    if (payload.temperature?.value !== undefined) vitals.temperature = payload.temperature.value;
    if (payload.bloodPressure?.systolic?.value !== undefined || payload.bloodPressure?.diastolic?.value !== undefined) {
      vitals.bloodPressure = {
        systolic: payload.bloodPressure?.systolic?.value,
        diastolic: payload.bloodPressure?.diastolic?.value
      };
    }
    payload = { ...payload, vitals };
  }

  if (!payload.patientId && topicPatientId && isMongoId(topicPatientId)) {
    payload = { ...payload, patientId: topicPatientId };
  }

  return payload;
};

const ingestTelemetry = async ({ io, topicPatientId, payload }) => {
  const normalized = normalizeTelemetryPayload(payload, topicPatientId);
  if (!normalized) return;

  const deviceId = String(normalized.deviceId || '').trim();
  if (!deviceId) return;

  const device = await IoTDevice.findOne({ deviceId }).populate('assignedPatient');
  if (!device) {
    logger.warn('MQTT telemetry ignored: device not registered', { deviceId });
    return;
  }

  if (device.status !== 'assigned' && device.status !== 'active') {
    logger.warn('MQTT telemetry ignored: device not active', { deviceId, status: device.status });
    return;
  }

  const telemetryPatientId = normalized.patientId || device.assignedPatient?._id;
  if (!telemetryPatientId || !isMongoId(telemetryPatientId)) {
    logger.warn('MQTT telemetry ignored: no patient', { deviceId, patientId: telemetryPatientId });
    return;
  }

  const motion = normalized.motion || {};
  const deviceStatus = normalized.deviceStatus || {};
  const location = normalized.location;

  const telemetry = new IoTTelemetry({
    patient: telemetryPatientId,
    deviceId: device.deviceId,
    ...buildTelemetryVitals(normalized.vitals || {}),
    motion: normalized.motion
      ? {
          accelerometer: motion.accelerometer,
          gyroscope: motion.gyroscope,
          type: mapMotionType(motion.activity),
          intensity: motion.intensity ?? 'low',
          duration: motion.duration
        }
      : undefined,
    fall: buildFallPayload(motion),
    deviceStatus: normalized.deviceStatus
      ? {
          batteryLevel: deviceStatus.batteryLevel,
          signalStrength: deviceStatus.signalStrength,
          charging: deviceStatus.charging,
          firmwareVersion: deviceStatus.firmwareVersion,
          lastSync: new Date()
        }
      : undefined,
    location: location || device.lastKnownLocation,
    timestamp: normalized.timestamp ? new Date(normalized.timestamp) : new Date()
  });

  await telemetry.save();

  device.lastSeen = new Date();
  device.lastKnownLocation = location || device.lastKnownLocation;
  if (normalized.deviceStatus) {
    device.batteryLevel = deviceStatus.batteryLevel;
    device.signalStrength = deviceStatus.signalStrength;
  }
  await device.save();

  if (io) {
    io.emit('telemetry:update', {
      patientId: telemetryPatientId,
      deviceId: device.deviceId,
      vitals: {
        heartRate: telemetry?.heartRate?.value ?? null,
        oxygenSaturation: telemetry?.oxygenSaturation?.value ?? null,
        temperature: telemetry?.temperature?.value ?? null
      },
      motion: telemetry.motion
        ? { activity: telemetry.motion.type, fallDetected: telemetry.fall?.detected ?? false }
        : null,
      timestamp: telemetry.timestamp
    });
  }
};

const ingestAlert = async ({ io, topicPatientId, payload }) => {
  if (!payload || typeof payload !== 'object') return;

  const deviceId = String(payload.deviceId || payload.device || '').trim();
  const patientIdCandidate = payload.patientId || topicPatientId;
  if (!isMongoId(patientIdCandidate)) {
    logger.warn('MQTT alert ignored: invalid patient id', { patientId: patientIdCandidate, deviceId });
    return;
  }

  const alertDoc = buildAlertFromDevice({
    patientId: patientIdCandidate,
    deviceId: deviceId || undefined,
    payload
  });

  // Validate patient exists (avoid orphan records).
  const patientExists = await Patient.exists({ _id: patientIdCandidate });
  if (!patientExists) {
    logger.warn('MQTT alert ignored: patient not found', { patientId: patientIdCandidate, deviceId });
    return;
  }

  const created = await Alert.create(alertDoc);

  if (io) {
    io.emit('alert:new', {
      id: created._id,
      type: created.type,
      severity: created.severity,
      status: created.status,
      patient: { id: created.patient },
      message: created.message,
      title: created.title
    });
  }
};

export const initializeMqttIngestion = (broker, io) => {
  if (!broker?.on) {
    logger.warn('MQTT ingestion not initialized: broker missing');
    return;
  }

  broker.on('publish', (packet, client) => {
    if (!client) return;
    if (!packet?.topic || !packet?.payload) return;

    const topic = String(packet.topic);
    if (!topic.startsWith('chengeto/')) return;

    const parts = topic.split('/').filter(Boolean);
    if (parts.length < 3) return;

    const topicPatientId = parts[1];
    const kind = parts[2];

    const payload = parseJsonPayload(packet.payload);
    if (!payload) return;

    // Fire-and-forget ingestion (do not block broker publish loop).
    if (kind === 'telemetry') {
      ingestTelemetry({ io, topicPatientId, payload }).catch((error) => {
        logger.warn('MQTT telemetry ingestion failed', { topic, message: error.message });
      });
      return;
    }

    if (kind === 'alert') {
      ingestAlert({ io, topicPatientId, payload }).catch((error) => {
        logger.warn('MQTT alert ingestion failed', { topic, message: error.message });
      });
      return;
    }
  });

  logger.info('MQTT ingestion service initialized');
};

export default { initializeMqttIngestion };


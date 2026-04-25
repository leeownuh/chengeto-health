/**
 * Elderly Patient IoT Device Simulator
 * Simulates all sensors for elderly patient monitoring device
 * 
 * Sensors:
 * - Heart Rate (PPG sensor)
 * - Motion/Accelerometer (fall detection, activity)
 * - Temperature
 * - Oxygen Saturation (SpO2)
 * - BLE Beacon (for proximity verification)
 * - Panic Button
 */

import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import schedule from 'node-schedule';

// Configuration
const CONFIG = {
  MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
  DEVICE_ID: process.env.DEVICE_ID || `ELDERLY-${Date.now().toString(36).toUpperCase()}`,
  PATIENT_ID: process.env.PATIENT_ID || 'PATIENT-001',
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  TELEMTRY_INTERVAL: parseInt(process.env.TELEMTRY_INTERVAL) || 5000,
  VERBOSE: process.env.VERBOSE === 'true'
};

// MQTT Topics
const TOPICS = {
  TELEMETRY: `chengeto/${CONFIG.PATIENT_ID}/telemetry`,
  ALERT: `chengeto/${CONFIG.PATIENT_ID}/alert`,
  STATUS: `chengeto/${CONFIG.PATIENT_ID}/status`,
  COMMAND: `chengeto/${CONFIG.PATIENT_ID}/command`,
  BLE: `chengeto/${CONFIG.PATIENT_ID}/ble`
};

// Sensor State
let mqttClient = null;
let deviceState = {
  online: true,
  batteryLevel: 85,
  firmwareVersion: '1.2.3',
  lastMotion: Date.now(),
  currentActivity: 'resting',
  position: { x: 0, y: 0, z: 1 }, // Accelerometer
  heartRate: 72,
  spO2: 97,
  temperature: 36.5,
  nearbyDevices: [],
  panicTriggered: false
};

// Activity patterns (simulates real elderly activity)
const ACTIVITY_PATTERNS = {
  morning: { activity: 'high', heartRateRange: [70, 90], motionProbability: 0.8 },
  afternoon: { activity: 'medium', heartRateRange: [65, 80], motionProbability: 0.5 },
  evening: { activity: 'low', heartRateRange: [60, 75], motionProbability: 0.3 },
  night: { activity: 'sleep', heartRateRange: [55, 65], motionProbability: 0.1 }
};

/**
 * Initialize MQTT connection
 */
function initializeMQTT() {
  mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
    clientId: CONFIG.DEVICE_ID,
    username: CONFIG.DEVICE_ID,
    password: 'device-secret',
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log(`[${CONFIG.DEVICE_ID}] Connected to MQTT broker`);
    
    // Subscribe to command topic
    mqttClient.subscribe(TOPICS.COMMAND, { qos: 1 });
    
    // Send online status
    publishStatus('online');
    
    // Start telemetry publishing
    startTelemetryLoop();
  });

  mqttClient.on('message', (topic, message) => {
    handleCommand(JSON.parse(message.toString()));
  });

  mqttClient.on('error', (error) => {
    console.error(`[${CONFIG.DEVICE_ID}] MQTT Error:`, error.message);
  });

  mqttClient.on('close', () => {
    console.log(`[${CONFIG.DEVICE_ID}] MQTT connection closed`);
  });
}

/**
 * Start telemetry publishing loop
 */
function startTelemetryLoop() {
  // Main telemetry loop
  setInterval(() => {
    const telemetry = generateTelemetry();
    publishTelemetry(telemetry);
  }, CONFIG.TELEMTRY_INTERVAL);

  // Heartbeat loop
  setInterval(() => {
    publishStatus('heartbeat');
    updateBattery();
  }, CONFIG.HEARTBEAT_INTERVAL);

  // Simulate occasional fall event (rare)
  schedule.scheduleJob('0 */4 * * *', () => {
    if (Math.random() < 0.1) { // 10% chance every 4 hours
      simulateFall();
    }
  });

  // Simulate occasional abnormal vitals
  setInterval(() => {
    if (Math.random() < 0.05) { // 5% chance
      simulateAbnormalVitals();
    }
  }, 600000); // Check every 10 minutes
}

/**
 * Generate realistic telemetry data
 */
function generateTelemetry() {
  const now = new Date();
  const hour = now.getHours();
  
  // Determine time period
  let period = 'night';
  if (hour >= 6 && hour < 12) period = 'morning';
  else if (hour >= 12 && hour < 18) period = 'afternoon';
  else if (hour >= 18 && hour < 22) period = 'evening';
  
  const pattern = ACTIVITY_PATTERNS[period];
  
  // Update sensor values based on patterns
  deviceState.heartRate = generateHeartRate(pattern.heartRateRange);
  deviceState.spO2 = generateSpO2();
  deviceState.temperature = generateTemperature();
  deviceState.position = generateAccelerometer(pattern.activity);
  
  // Check for motion
  const motionDetected = Math.random() < pattern.motionProbability;
  if (motionDetected) {
    deviceState.lastMotion = Date.now();
    deviceState.currentActivity = getActivityType(pattern.activity);
  }

  return {
    deviceId: CONFIG.DEVICE_ID,
    patientId: CONFIG.PATIENT_ID,
    timestamp: now.toISOString(),
    heartRate: {
      value: deviceState.heartRate,
      unit: 'bpm',
      status: getVitalStatus('heartRate', deviceState.heartRate),
      confidence: 95 + Math.random() * 5,
      source: 'ppg'
    },
    oxygenSaturation: {
      value: deviceState.spO2,
      unit: '%',
      status: getVitalStatus('spO2', deviceState.spO2)
    },
    temperature: {
      value: deviceState.temperature,
      unit: '°C',
      location: 'wrist',
      status: getVitalStatus('temperature', deviceState.temperature)
    },
    motion: {
      detected: motionDetected,
      type: deviceState.currentActivity,
      intensity: getActivityIntensity(pattern.activity),
      accelerometer: deviceState.position
    },
    fall: {
      detected: false
    },
    inactivity: {
      duration: Math.floor((Date.now() - deviceState.lastMotion) / 60000),
      lastMotionTime: new Date(deviceState.lastMotion).toISOString()
    },
    deviceStatus: {
      batteryLevel: deviceState.batteryLevel,
      charging: deviceState.batteryLevel < 20 && Math.random() > 0.5,
      status: 'online',
      firmwareVersion: deviceState.firmwareVersion
    }
  };
}

/**
 * Generate realistic heart rate
 */
function generateHeartRate(range) {
  // Base value with some variation
  const base = range[0] + (range[1] - range[0]) / 2;
  const variation = (Math.random() - 0.5) * (range[1] - range[0]);
  const value = Math.round(base + variation);
  
  // Add occasional artifacts (realistic PPG noise)
  if (Math.random() < 0.02) {
    return value + Math.round((Math.random() - 0.5) * 20);
  }
  
  return value;
}

/**
 * Generate SpO2 value
 */
function generateSpO2() {
  // SpO2 is typically 95-100% in healthy individuals
  // Occasional dips are normal during certain activities
  const base = 97;
  const variation = Math.random() * 3;
  return Math.round((base + variation) * 10) / 10;
}

/**
 * Generate temperature
 */
function generateTemperature() {
  // Normal body temperature with circadian variation
  const hour = new Date().getHours();
  const circadianOffset = Math.sin((hour - 6) * Math.PI / 12) * 0.3;
  const base = 36.5 + circadianOffset;
  const variation = (Math.random() - 0.5) * 0.5;
  return Math.round((base + variation) * 10) / 10;
}

/**
 * Generate accelerometer data
 */
function generateAccelerometer(activity) {
  const noise = () => (Math.random() - 0.5) * 0.1;
  
  switch (activity) {
    case 'sleep':
      return { x: noise(), y: noise(), z: 0.98 + noise() };
    case 'low':
      return { 
        x: (Math.random() - 0.5) * 0.2, 
        y: (Math.random() - 0.5) * 0.2, 
        z: 0.95 + noise() 
      };
    case 'medium':
      return { 
        x: (Math.random() - 0.5) * 0.5, 
        y: (Math.random() - 0.5) * 0.5, 
        z: 0.9 + Math.random() * 0.2 
      };
    case 'high':
      return { 
        x: (Math.random() - 0.5) * 1.5, 
        y: (Math.random() - 0.5) * 1.5, 
        z: 0.5 + Math.random() * 0.8 
      };
    default:
      return { x: noise(), y: noise(), z: 0.98 + noise() };
  }
}

/**
 * Get vital status
 */
function getVitalStatus(type, value) {
  const thresholds = {
    heartRate: { low: 50, high: 120 },
    spO2: { low: 90, high: 100 },
    temperature: { low: 36, high: 38 }
  };
  
  const t = thresholds[type];
  if (!t) return 'normal';
  
  if (value < t.low) return 'low';
  if (value > t.high) return 'high';
  return 'normal';
}

/**
 * Get activity type
 */
function getActivityType(intensity) {
  const activities = {
    sleep: ['sleeping', 'resting'],
    low: ['sitting', 'reading', 'watching_tv'],
    medium: ['walking', 'light_housework', 'stretching'],
    high: ['exercising', 'walking_fast', 'gardening']
  };
  
  const options = activities[intensity] || activities.low;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get activity intensity
 */
function getActivityIntensity(pattern) {
  const intensities = {
    sleep: 'none',
    low: 'low',
    medium: 'medium',
    high: 'high'
  };
  return intensities[pattern] || 'low';
}

/**
 * Simulate a fall event
 */
function simulateFall() {
  console.log(`[${CONFIG.DEVICE_ID}] SIMULATING FALL EVENT`);
  
  // Generate fall telemetry
  const fallTelemetry = {
    deviceId: CONFIG.DEVICE_ID,
    patientId: CONFIG.PATIENT_ID,
    timestamp: new Date().toISOString(),
    heartRate: {
      value: deviceState.heartRate + 30, // Elevated after fall
      unit: 'bpm',
      status: 'high'
    },
    motion: {
      detected: true,
      type: 'falling',
      intensity: 'high',
      accelerometer: { x: 2.5, y: 1.8, z: 0.2 } // Fall signature
    },
    fall: {
      detected: true,
      confidence: 92,
      impactForce: 2.8,
      fallType: ['forward', 'backward', 'lateral'][Math.floor(Math.random() * 3)],
      recoveryDetected: false,
      location: {
        latitude: -17.8292 + (Math.random() - 0.5) * 0.01,
        longitude: 31.0523 + (Math.random() - 0.5) * 0.01
      }
    },
    deviceStatus: {
      batteryLevel: deviceState.batteryLevel,
      status: 'online'
    }
  };

  // Publish fall alert
  publishTelemetry(fallTelemetry);
  
  // Publish alert
  publishAlert({
    type: 'fall_detected',
    severity: 'critical',
    message: 'Fall detected - awaiting patient response',
    deviceId: CONFIG.DEVICE_ID,
    timestamp: new Date().toISOString()
  });

  // Schedule recovery check
  setTimeout(() => {
    if (Math.random() > 0.3) { // 70% chance of recovery
      console.log(`[${CONFIG.DEVICE_ID}] Patient recovered from fall`);
      deviceState.currentActivity = 'resting';
    } else {
      // Escalate - no recovery
      publishAlert({
        type: 'fall_no_recovery',
        severity: 'critical',
        message: 'Fall detected - no patient response',
        deviceId: CONFIG.DEVICE_ID,
        timestamp: new Date().toISOString()
      });
    }
  }, 60000); // Check after 1 minute
}

/**
 * Simulate abnormal vitals
 */
function simulateAbnormalVitals() {
  const type = ['high_hr', 'low_hr', 'low_spo2'][Math.floor(Math.random() * 3)];
  
  console.log(`[${CONFIG.DEVICE_ID}] SIMULATING ABNORMAL VITALS: ${type}`);
  
  let alertData;
  
  switch (type) {
    case 'high_hr':
      deviceState.heartRate = 125 + Math.round(Math.random() * 20);
      alertData = {
        type: 'vital_sign',
        severity: 'high',
        message: `High heart rate detected: ${deviceState.heartRate} bpm`,
        vitalType: 'heartRate',
        value: deviceState.heartRate
      };
      break;
    case 'low_hr':
      deviceState.heartRate = 42 + Math.round(Math.random() * 8);
      alertData = {
        type: 'vital_sign',
        severity: 'high',
        message: `Low heart rate detected: ${deviceState.heartRate} bpm`,
        vitalType: 'heartRate',
        value: deviceState.heartRate
      };
      break;
    case 'low_spo2':
      deviceState.spO2 = 85 + Math.round(Math.random() * 5);
      alertData = {
        type: 'vital_sign',
        severity: 'critical',
        message: `Low oxygen saturation detected: ${deviceState.spO2}%`,
        vitalType: 'oxygenSaturation',
        value: deviceState.spO2
      };
      break;
  }

  publishAlert({
    ...alertData,
    deviceId: CONFIG.DEVICE_ID,
    patientId: CONFIG.PATIENT_ID,
    timestamp: new Date().toISOString()
  });

  // Return to normal after 5 minutes
  setTimeout(() => {
    deviceState.heartRate = 72;
    deviceState.spO2 = 97;
    console.log(`[${CONFIG.DEVICE_ID}] Vitals returned to normal`);
  }, 300000);
}

/**
 * Simulate panic button press
 */
function simulatePanicButton() {
  console.log(`[${CONFIG.DEVICE_ID}] PANIC BUTTON PRESSED`);
  
  deviceState.panicTriggered = true;

  publishAlert({
    type: 'panic',
    severity: 'critical',
    message: 'Panic button activated by patient',
    deviceId: CONFIG.DEVICE_ID,
    patientId: CONFIG.PATIENT_ID,
    timestamp: new Date().toISOString(),
    location: {
      latitude: -17.8292 + (Math.random() - 0.5) * 0.01,
      longitude: 31.0523 + (Math.random() - 0.5) * 0.01
    }
  });

  // Auto-cancel after 5 minutes if no response
  setTimeout(() => {
    if (deviceState.panicTriggered) {
      console.log(`[${CONFIG.DEVICE_ID}] Panic auto-cancelled`);
      deviceState.panicTriggered = false;
    }
  }, 300000);
}

/**
 * Update BLE nearby devices
 */
function updateNearbyDevices(devices) {
  deviceState.nearbyDevices = devices;
  
  mqttClient.publish(TOPICS.BLE, JSON.stringify({
    deviceId: CONFIG.DEVICE_ID,
    nearbyDevices: devices,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Publish telemetry
 */
function publishTelemetry(telemetry) {
  if (CONFIG.VERBOSE) {
    console.log(`[${CONFIG.DEVICE_ID}] Publishing telemetry:`, 
      JSON.stringify(telemetry, null, 2));
  }
  
  mqttClient.publish(TOPICS.TELEMETRY, JSON.stringify(telemetry), { qos: 1 });
}

/**
 * Publish alert
 */
function publishAlert(alert) {
  console.log(`[${CONFIG.DEVICE_ID}] ALERT:`, alert.message);
  mqttClient.publish(TOPICS.ALERT, JSON.stringify(alert), { qos: 2 });
}

/**
 * Publish status
 */
function publishStatus(status) {
  const statusMessage = {
    deviceId: CONFIG.DEVICE_ID,
    patientId: CONFIG.PATIENT_ID,
    status: status,
    batteryLevel: deviceState.batteryLevel,
    timestamp: new Date().toISOString()
  };
  
  mqttClient.publish(TOPICS.STATUS, JSON.stringify(statusMessage), { qos: 0 });
}

/**
 * Update battery level
 */
function updateBattery() {
  // Slowly drain battery
  if (!deviceState.charging && Math.random() > 0.7) {
    deviceState.batteryLevel = Math.max(0, deviceState.batteryLevel - 1);
  }
  
  // Alert on low battery
  if (deviceState.batteryLevel <= 20 && deviceState.batteryLevel % 5 === 0) {
    publishAlert({
      type: 'low_battery',
      severity: deviceState.batteryLevel <= 10 ? 'high' : 'medium',
      message: `Device battery low: ${deviceState.batteryLevel}%`,
      deviceId: CONFIG.DEVICE_ID,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle incoming commands
 */
function handleCommand(command) {
  console.log(`[${CONFIG.DEVICE_ID}] Received command:`, command.type);
  
  switch (command.type) {
    case 'ping':
      publishStatus('pong');
      break;
    case 'panic':
      simulatePanicButton();
      break;
    case 'simulate_fall':
      simulateFall();
      break;
    case 'simulate_abnormal':
      simulateAbnormalVitals();
      break;
    case 'request_telemetry':
      const telemetry = generateTelemetry();
      publishTelemetry(telemetry);
      break;
    default:
      console.log(`[${CONFIG.DEVICE_ID}] Unknown command:`, command.type);
  }
}

/**
 * Start device simulator
 */
function start() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     CHENGETO Health - Elderly Patient Device Simulator    ║
╠═══════════════════════════════════════════════════════════╣
║  Device ID: ${CONFIG.DEVICE_ID.padEnd(44)}║
║  Patient ID: ${CONFIG.PATIENT_ID.padEnd(43)}║
║  MQTT Broker: ${CONFIG.MQTT_BROKER.padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  initializeMQTT();
  
  // Handle process signals
  process.on('SIGINT', () => {
    console.log(`\n[${CONFIG.DEVICE_ID}] Shutting down...`);
    publishStatus('offline');
    mqttClient.end();
    process.exit(0);
  });
}

// Export functions for external use
export {
  start,
  simulatePanicButton,
  simulateFall,
  simulateAbnormalVitals,
  updateNearbyDevices,
  generateTelemetry,
  deviceState,
  CONFIG
};

// Run if called directly
if (process.argv[1].includes('elderly-device.js')) {
  start();
}
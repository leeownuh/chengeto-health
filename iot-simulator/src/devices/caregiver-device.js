/**
 * Caregiver IoT Device Simulator
 * Simulates caregiver device with BLE proximity verification
 * 
 * Features:
 * - BLE Beacon broadcasting
 * - NFC capability
 * - GPS Location tracking
 * - Notification receiver
 * - Check-in verification
 */

import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import schedule from 'node-schedule';

// Configuration
const CONFIG = {
  MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
  DEVICE_ID: process.env.DEVICE_ID || `CAREGIVER-${Date.now().toString(36).toUpperCase()}`,
  CAREGIVER_ID: process.env.CAREGIVER_ID || 'CAREGIVER-001',
  PATIENT_DEVICE_ID: process.env.PATIENT_DEVICE_ID || 'ELDERLY-DEVICE-001',
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
  VERBOSE: process.env.VERBOSE === 'true'
};

// MQTT Topics
const TOPICS = {
  TELEMETRY: `chengeto/caregiver/${CONFIG.CAREGIVER_ID}/telemetry`,
  ALERT: `chengeto/caregiver/${CONFIG.CAREGIVER_ID}/alert`,
  STATUS: `chengeto/caregiver/${CONFIG.CAREGIVER_ID}/status`,
  COMMAND: `chengeto/caregiver/${CONFIG.CAREGIVER_ID}/command`,
  PROXIMITY: `chengeto/proximity`,
  NOTIFICATION: `chengeto/caregiver/${CONFIG.CAREGIVER_ID}/notification`
};

// Device State
let mqttClient = null;
let deviceState = {
  online: true,
  batteryLevel: 90,
  firmwareVersion: '1.1.0',
  gpsLocation: {
    latitude: -17.8292,
    longitude: 31.0523
  },
  bleEnabled: true,
  nfcEnabled: true,
  notificationsEnabled: true,
  pairedPatientDevices: [CONFIG.PATIENT_DEVICE_ID],
  currentProximity: null,
  checkInsToday: 0,
  lastCheckIn: null
};

// BLE Beacon simulation
const BLE_BEACON = {
  uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
  major: 1,
  minor: 1,
  txPower: -59,
  advertisementInterval: 100 // ms
};

/**
 * Initialize MQTT connection
 */
function initializeMQTT() {
  mqttClient = mqtt.connect(CONFIG.MQTT_BROKER, {
    clientId: CONFIG.DEVICE_ID,
    username: CONFIG.DEVICE_ID,
    password: 'caregiver-secret',
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log(`[${CONFIG.DEVICE_ID}] Connected to MQTT broker`);
    
    // Subscribe to relevant topics
    mqttClient.subscribe(TOPICS.COMMAND, { qos: 1 });
    mqttClient.subscribe(TOPICS.NOTIFICATION, { qos: 1 });
    mqttClient.subscribe(`chengeto/alert/#`, { qos: 1 }); // Subscribe to all alerts
    
    // Send online status
    publishStatus('online');
    
    // Start periodic updates
    startPeriodicUpdates();
  });

  mqttClient.on('message', (topic, message) => {
    handleMessage(topic, message);
  });

  mqttClient.on('error', (error) => {
    console.error(`[${CONFIG.DEVICE_ID}] MQTT Error:`, error.message);
  });

  mqttClient.on('close', () => {
    console.log(`[${CONFIG.DEVICE_ID}] MQTT connection closed`);
  });
}

/**
 * Start periodic updates
 */
function startPeriodicUpdates() {
  // Heartbeat
  setInterval(() => {
    publishStatus('heartbeat');
  }, CONFIG.HEARTBEAT_INTERVAL);

  // BLE proximity broadcast
  setInterval(() => {
    broadcastBLEBeacon();
  }, 1000);

  // GPS update
  setInterval(() => {
    updateGPSLocation();
  }, 10000);

  // Simulate scheduled check-ins
  schedule.scheduleJob('0 8,14,20 * * *', () => {
    simulateCheckIn();
  });
}

/**
 * Broadcast BLE beacon
 */
function broadcastBLEBeacon() {
  const beaconData = {
    deviceId: CONFIG.DEVICE_ID,
    caregiverId: CONFIG.CAREGIVER_ID,
    uuid: BLE_BEACON.uuid,
    major: BLE_BEACON.major,
    minor: BLE_BEACON.minor,
    txPower: BLE_BEACON.txPower,
    timestamp: new Date().toISOString()
  };

  // Broadcast on proximity channel
  mqttClient.publish(TOPICS.PROXIMITY, JSON.stringify(beaconData), { qos: 0 });

  if (CONFIG.VERBOSE) {
    console.log(`[${CONFIG.DEVICE_ID}] BLE beacon broadcasted`);
  }
}

/**
 * Simulate BLE proximity detection
 * This simulates when caregiver device detects patient device
 */
function simulateProximityDetection(patientDeviceId, distance) {
  const proximityData = {
    type: 'proximity_detected',
    caregiverDevice: CONFIG.DEVICE_ID,
    patientDevice: patientDeviceId,
    distance: distance,
    method: 'ble',
    rssi: calculateRSSI(distance),
    timestamp: new Date().toISOString(),
    gpsLocation: deviceState.gpsLocation
  };

  deviceState.currentProximity = proximityData;

  mqttClient.publish(`chengeto/proximity/verified`, JSON.stringify(proximityData), { qos: 1 });

  console.log(`[${CONFIG.DEVICE_ID}] Proximity detected with ${patientDeviceId} at ${distance.toFixed(1)}m`);
}

/**
 * Calculate RSSI based on distance (simplified path loss model)
 */
function calculateRSSI(distance) {
  // RSSI = TxPower - 10 * n * log10(distance)
  // n = path loss exponent (2 for free space)
  const n = 2;
  return Math.round(BLE_BEACON.txPower - (10 * n * Math.log10(Math.max(distance, 0.1))));
}

/**
 * Simulate NFC tap verification
 */
function simulateNFCVerification(patientDeviceId) {
  const verificationData = {
    type: 'nfc_verified',
    caregiverDevice: CONFIG.DEVICE_ID,
    patientDevice: patientDeviceId,
    method: 'nfc',
    timestamp: new Date().toISOString(),
    gpsLocation: deviceState.gpsLocation,
    verificationToken: generateVerificationToken()
  };

  mqttClient.publish(`chengeto/proximity/nfc`, JSON.stringify(verificationData), { qos: 2 });

  console.log(`[${CONFIG.DEVICE_ID}] NFC verification with ${patientDeviceId}`);

  return verificationData;
}

/**
 * Generate verification token
 */
function generateVerificationToken() {
  return `VER-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

/**
 * Update GPS location
 */
function updateGPSLocation() {
  // Simulate small movements
  deviceState.gpsLocation.latitude += (Math.random() - 0.5) * 0.0001;
  deviceState.gpsLocation.longitude += (Math.random() - 0.5) * 0.0001;

  const locationData = {
    deviceId: CONFIG.DEVICE_ID,
    caregiverId: CONFIG.CAREGIVER_ID,
    location: deviceState.gpsLocation,
    accuracy: 10 + Math.random() * 5,
    timestamp: new Date().toISOString()
  };

  mqttClient.publish(TOPICS.TELEMETRY, JSON.stringify(locationData), { qos: 0 });
}

/**
 * Simulate check-in process
 */
async function simulateCheckIn() {
  console.log(`[${CONFIG.DEVICE_ID}] Starting check-in process`);

  // Step 1: Approach patient (simulate proximity)
  const approachDistance = 2 + Math.random() * 3; // 2-5 meters
  simulateProximityDetection(CONFIG.PATIENT_DEVICE_ID, approachDistance);

  await delay(2000);

  // Step 2: Get closer for verification
  const verifyDistance = 0.5 + Math.random() * 1; // 0.5-1.5 meters
  simulateProximityDetection(CONFIG.PATIENT_DEVICE_ID, verifyDistance);

  await delay(1000);

  // Step 3: NFC tap (optional but more secure)
  if (Math.random() > 0.3) { // 70% use NFC
    simulateNFCVerification(CONFIG.PATIENT_DEVICE_ID);
  }

  // Step 4: Submit check-in
  submitCheckIn({
    patientDeviceId: CONFIG.PATIENT_DEVICE_ID,
    proximityVerified: true,
    nfcUsed: true,
    wellness: {
      overallStatus: ['good', 'good', 'good', 'fair'][Math.floor(Math.random() * 4)],
      notes: 'Regular check-in completed'
    }
  });

  deviceState.checkInsToday++;
  deviceState.lastCheckIn = new Date();
}

/**
 * Submit check-in to backend
 */
function submitCheckIn(checkInData) {
  const checkIn = {
    type: 'checkin',
    deviceId: CONFIG.DEVICE_ID,
    caregiverId: CONFIG.CAREGIVER_ID,
    patientDeviceId: checkInData.patientDeviceId,
    timestamp: new Date().toISOString(),
    proximity: {
      verified: checkInData.proximityVerified,
      method: checkInData.nfcUsed ? 'nfc' : 'ble',
      distance: deviceState.currentProximity?.distance || 0
    },
    wellness: checkInData.wellness,
    gpsLocation: deviceState.gpsLocation
  };

  mqttClient.publish(`chengeto/checkin`, JSON.stringify(checkIn), { qos: 2 });

  console.log(`[${CONFIG.DEVICE_ID}] Check-in submitted`);
}

/**
 * Handle incoming messages
 */
function handleMessage(topic, message) {
  try {
    const payload = JSON.parse(message.toString());
    
    if (topic.includes('/alert/')) {
      handleAlert(payload);
    } else if (topic === TOPICS.COMMAND) {
      handleCommand(payload);
    } else if (topic === TOPICS.NOTIFICATION) {
      handleNotification(payload);
    }
  } catch (error) {
    console.error(`[${CONFIG.DEVICE_ID}] Error handling message:`, error.message);
  }
}

/**
 * Handle alert notification
 */
function handleAlert(alert) {
  console.log(`[${CONFIG.DEVICE_ID}] ALERT RECEIVED:`, alert.message);
  
  // Simulate notification display
  const notification = {
    id: uuidv4(),
    type: 'alert',
    title: `${alert.severity.toUpperCase()}: ${alert.type}`,
    message: alert.message,
    patientId: alert.patientId,
    timestamp: new Date().toISOString(),
    actions: ['acknowledge', 'escalate', 'dismiss']
  };

  // Store notification (would display on device screen)
  console.log(`[${CONFIG.DEVICE_ID}] Notification:`, notification.title);

  // Auto-acknowledge some alerts (simulating caregiver response)
  setTimeout(() => {
    if (Math.random() > 0.2) { // 80% acknowledge rate
      acknowledgeAlert(alert.alertId || alert.id);
    }
  }, 30000 + Math.random() * 60000); // 30-90 seconds response time
}

/**
 * Acknowledge alert
 */
function acknowledgeAlert(alertId) {
  const acknowledgement = {
    type: 'alert_acknowledgement',
    alertId: alertId,
    caregiverId: CONFIG.CAREGIVER_ID,
    deviceId: CONFIG.DEVICE_ID,
    timestamp: new Date().toISOString(),
    action: 'acknowledged',
    notes: 'Responding to alert'
  };

  mqttClient.publish(`chengeto/alert/ack`, JSON.stringify(acknowledgement), { qos: 1 });

  console.log(`[${CONFIG.DEVICE_ID}] Alert acknowledged: ${alertId}`);
}

/**
 * Handle command
 */
function handleCommand(command) {
  console.log(`[${CONFIG.DEVICE_ID}] Command received:`, command.type);
  
  switch (command.type) {
    case 'ping':
      publishStatus('pong');
      break;
    case 'checkin':
      simulateCheckIn();
      break;
    case 'proximity_check':
      simulateProximityDetection(CONFIG.PATIENT_DEVICE_ID, 2 + Math.random() * 3);
      break;
    case 'nfc_verify':
      simulateNFCVerification(CONFIG.PATIENT_DEVICE_ID);
      break;
    case 'location_update':
      updateGPSLocation();
      break;
    default:
      console.log(`[${CONFIG.DEVICE_ID}] Unknown command:`, command.type);
  }
}

/**
 * Handle notification
 */
function handleNotification(notification) {
  console.log(`[${CONFIG.DEVICE_ID}] Notification:`, notification.title || notification.message);
}

/**
 * Publish status
 */
function publishStatus(status) {
  const statusMessage = {
    deviceId: CONFIG.DEVICE_ID,
    caregiverId: CONFIG.CAREGIVER_ID,
    status: status,
    batteryLevel: deviceState.batteryLevel,
    bleEnabled: deviceState.bleEnabled,
    nfcEnabled: deviceState.nfcEnabled,
    gpsLocation: deviceState.gpsLocation,
    timestamp: new Date().toISOString()
  };
  
  mqttClient.publish(TOPICS.STATUS, JSON.stringify(statusMessage), { qos: 0 });
}

/**
 * Helper: delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start device simulator
 */
function start() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║      CHENGETO Health - Caregiver Device Simulator         ║
╠═══════════════════════════════════════════════════════════╣
║  Device ID: ${CONFIG.DEVICE_ID.padEnd(44)}║
║  Caregiver ID: ${CONFIG.CAREGIVER_ID.padEnd(41)}║
║  Patient Device: ${CONFIG.PATIENT_DEVICE_ID.padEnd(38)}║
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

// Export functions
export {
  start,
  simulateCheckIn,
  simulateProximityDetection,
  simulateNFCVerification,
  acknowledgeAlert,
  deviceState,
  CONFIG
};

// Run if called directly
if (process.argv[1].includes('caregiver-device.js')) {
  start();
}
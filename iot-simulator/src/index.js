/**
 * CHENGETO Health - IoT Simulator Main Entry Point
 * Orchestrates multiple IoT device simulations for testing and development
 */

const mqtt = require('mqtt');
const { ElderlyDevice } = require('./devices/elderly-device');
const { CaregiverDevice } = require('./devices/caregiver-device');
const winston = require('winston');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '../../backend/.env' });

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/iot-simulator.log' })
  ]
});

/**
 * IoT Simulator Orchestrator
 * Manages multiple device simulations with realistic scenarios
 */
class IoTSimulatorOrchestrator {
  constructor(config = {}) {
    this.mqttBrokerUrl = config.mqttBrokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    this.devices = new Map();
    this.patientCaregiverPairs = new Map();
    this.mqttClient = null;
    this.isRunning = false;
    this.config = {
      numElderlyPatients: config.numElderlyPatients || 5,
      numCaregivers: config.numCaregivers || 3,
      simulationSpeed: config.simulationSpeed || 1, // 1x real-time
      enableAnomalies: config.enableAnomalies !== false,
      anomalyProbability: config.anomalyProbability || 0.05,
      ...config
    };
    
    // Simulation scenarios
    this.scenarios = {
      normal: this.runNormalScenario.bind(this),
      emergency: this.runEmergencyScenario.bind(this),
      missedCheckIn: this.runMissedCheckInScenario.bind(this),
      fallDetection: this.runFallDetectionScenario.bind(this),
      vitalAnomaly: this.runVitalAnomalyScenario.bind(this)
    };
    
    // Statistics tracking
    this.stats = {
      totalCheckIns: 0,
      successfulCheckIns: 0,
      alertsTriggered: 0,
      fallsDetected: 0,
      vitalAnomalies: 0,
      panicAlerts: 0,
      startTime: null
    };
  }

  /**
   * Initialize MQTT connection
   */
  async initialize() {
    logger.info('Initializing IoT Simulator Orchestrator...');
    
    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(this.mqttBrokerUrl, {
        clientId: `iot-orchestrator-${Date.now()}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000
      });

      this.mqttClient.on('connect', () => {
        logger.info(`Connected to MQTT broker at ${this.mqttBrokerUrl}`);
        this.subscribeToTopics();
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        logger.error('MQTT connection error:', error);
        reject(error);
      });

      this.mqttClient.on('message', (topic, message) => {
        this.handleIncomingMessage(topic, message);
      });
    });
  }

  /**
   * Subscribe to relevant MQTT topics
   */
  subscribeToTopics() {
    const topics = [
      'chengeto/alerts/#',
      'chengeto/checkins/#',
      'chengeto/commands/#',
      'chengeto/schedule/#'
    ];

    topics.forEach(topic => {
      this.mqttClient.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          logger.info(`Subscribed to topic: ${topic}`);
        }
      });
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  handleIncomingMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      logger.debug(`Received message on ${topic}:`, payload);

      // Route messages to appropriate handlers
      if (topic.includes('/alerts/')) {
        this.handleAlertNotification(payload);
      } else if (topic.includes('/commands/')) {
        this.handleDeviceCommand(payload);
      } else if (topic.includes('/schedule/')) {
        this.handleScheduleUpdate(payload);
      }
    } catch (error) {
      logger.error('Error processing incoming message:', error);
    }
  }

  /**
   * Handle alert notifications
   */
  handleAlertNotification(payload) {
    logger.info(`Alert notification received: ${payload.alertId} - ${payload.type}`);
    this.stats.alertsTriggered++;

    // Notify relevant caregiver devices
    if (payload.assignedCaregivers) {
      payload.assignedCaregivers.forEach(caregiverId => {
        const device = this.devices.get(`caregiver-${caregiverId}`);
        if (device) {
          device.receiveAlert(payload);
        }
      });
    }
  }

  /**
   * Handle device commands from backend
   */
  handleDeviceCommand(payload) {
    const { deviceId, command, params } = payload;
    const device = this.devices.get(deviceId);
    
    if (device) {
      logger.info(`Executing command '${command}' on device ${deviceId}`);
      device.executeCommand(command, params);
    } else {
      logger.warn(`Device ${deviceId} not found for command execution`);
    }
  }

  /**
   * Handle schedule updates
   */
  handleScheduleUpdate(payload) {
    logger.info(`Schedule update received for patient ${payload.patientId}`);
    
    // Update check-in windows on elderly devices
    const elderlyDevice = this.devices.get(`elderly-${payload.patientId}`);
    if (elderlyDevice) {
      elderlyDevice.updateSchedule(payload.schedule);
    }
  }

  /**
   * Create elderly patient device simulation
   */
  createElderlyDevice(patientId, patientData = {}) {
    const deviceConfig = {
      patientId,
      patientName: patientData.name || `Patient ${patientId}`,
      age: patientData.age || 75,
      medicalConditions: patientData.medicalConditions || ['hypertension'],
      mqttBrokerUrl: this.mqttBrokerUrl,
      ...patientData
    };

    const device = new ElderlyDevice(deviceConfig);
    const deviceKey = `elderly-${patientId}`;
    
    this.devices.set(deviceKey, device);
    logger.info(`Created elderly device simulation for patient ${patientId}`);
    
    return device;
  }

  /**
   * Create caregiver device simulation
   */
  createCaregiverDevice(caregiverId, caregiverData = {}) {
    const deviceConfig = {
      caregiverId,
      caregiverName: caregiverData.name || `Caregiver ${caregiverId}`,
      assignedPatients: caregiverData.assignedPatients || [],
      mqttBrokerUrl: this.mqttBrokerUrl,
      ...caregiverData
    };

    const device = new CaregiverDevice(deviceConfig);
    const deviceKey = `caregiver-${caregiverId}`;
    
    this.devices.set(deviceKey, device);
    logger.info(`Created caregiver device simulation for caregiver ${caregiverId}`);
    
    return device;
  }

  /**
   * Pair elderly patient with caregiver
   */
  pairPatientCaregiver(patientId, caregiverId) {
    const elderlyDevice = this.devices.get(`elderly-${patientId}`);
    const caregiverDevice = this.devices.get(`caregiver-${caregiverId}`);

    if (!elderlyDevice || !caregiverDevice) {
      logger.error('Cannot pair: one or both devices not found');
      return false;
    }

    // Create pairing relationship
    elderlyDevice.addPairedCaregiver(caregiverId, caregiverDevice);
    caregiverDevice.addAssignedPatient(patientId, elderlyDevice);

    // Track pairing
    if (!this.patientCaregiverPairs.has(patientId)) {
      this.patientCaregiverPairs.set(patientId, []);
    }
    this.patientCaregiverPairs.get(patientId).push(caregiverId);

    logger.info(`Paired patient ${patientId} with caregiver ${caregiverId}`);
    return true;
  }

  /**
   * Start all device simulations
   */
  async startAll() {
    if (this.isRunning) {
      logger.warn('Simulator is already running');
      return;
    }

    logger.info('Starting all IoT device simulations...');
    this.isRunning = true;
    this.stats.startTime = new Date();

    for (const [deviceKey, device] of this.devices) {
      try {
        await device.start();
        logger.info(`Started device: ${deviceKey}`);
      } catch (error) {
        logger.error(`Failed to start device ${deviceKey}:`, error);
      }
    }

    // Start periodic anomaly injection if enabled
    if (this.config.enableAnomalies) {
      this.startAnomalyInjection();
    }

    // Start statistics reporting
    this.startStatisticsReporting();

    logger.info('All device simulations started successfully');
  }

  /**
   * Stop all device simulations
   */
  async stopAll() {
    logger.info('Stopping all IoT device simulations...');
    this.isRunning = false;

    for (const [deviceKey, device] of this.devices) {
      try {
        await device.stop();
        logger.info(`Stopped device: ${deviceKey}`);
      } catch (error) {
        logger.error(`Failed to stop device ${deviceKey}:`, error);
      }
    }

    if (this.anomalyInterval) {
      clearInterval(this.anomalyInterval);
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    if (this.mqttClient) {
      this.mqttClient.end();
    }

    logger.info('All device simulations stopped');
    this.printFinalStatistics();
  }

  /**
   * Start periodic anomaly injection for testing
   */
  startAnomalyInjection() {
    this.anomalyInterval = setInterval(() => {
      if (!this.isRunning) return;
      
      if (Math.random() < this.config.anomalyProbability) {
        this.injectRandomAnomaly();
      }
    }, 30000 / this.config.simulationSpeed); // Check every 30 seconds (scaled)

    logger.info('Anomaly injection started');
  }

  /**
   * Inject a random anomaly for testing
   */
  injectRandomAnomaly() {
    const anomalyTypes = ['fall', 'vital_spike', 'panic', 'device_offline'];
    const anomalyType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
    
    // Select random elderly device
    const elderlyDevices = Array.from(this.devices.entries())
      .filter(([key]) => key.startsWith('elderly-'));
    
    if (elderlyDevices.length === 0) return;

    const [deviceKey, device] = elderlyDevices[Math.floor(Math.random() * elderlyDevices.length)];
    logger.info(`Injecting ${anomalyType} anomaly on ${deviceKey}`);

    switch (anomalyType) {
      case 'fall':
        device.simulateFall();
        this.stats.fallsDetected++;
        break;
      case 'vital_spike':
        device.simulateVitalAnomaly('heart_rate', 'high');
        this.stats.vitalAnomalies++;
        break;
      case 'panic':
        device.triggerPanicAlert('Simulated panic button press');
        this.stats.panicAlerts++;
        break;
      case 'device_offline':
        device.simulateDeviceOffline(60000); // 1 minute offline
        break;
    }
  }

  /**
   * Start periodic statistics reporting
   */
  startStatisticsReporting() {
    this.statsInterval = setInterval(() => {
      this.printStatistics();
    }, 60000); // Every minute

    logger.info('Statistics reporting started');
  }

  /**
   * Print current statistics
   */
  printStatistics() {
    const uptime = this.stats.startTime ? 
      Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000) : 0;
    
    logger.info('\n========== IoT Simulator Statistics ==========');
    logger.info(`Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`);
    logger.info(`Active devices: ${this.devices.size}`);
    logger.info(`Patient-Caregiver pairs: ${this.patientCaregiverPairs.size}`);
    logger.info(`Total Check-ins: ${this.stats.totalCheckIns}`);
    logger.info(`Successful Check-ins: ${this.stats.successfulCheckIns}`);
    logger.info(`Alerts Triggered: ${this.stats.alertsTriggered}`);
    logger.info(`Falls Detected: ${this.stats.fallsDetected}`);
    logger.info(`Vital Anomalies: ${this.stats.vitalAnomalies}`);
    logger.info(`Panic Alerts: ${this.stats.panicAlerts}`);
    logger.info('==============================================\n');
  }

  /**
   * Print final statistics on shutdown
   */
  printFinalStatistics() {
    logger.info('\n========== Final Simulation Statistics ==========');
    this.printStatistics();
  }

  // ==================== SIMULATION SCENARIOS ====================

  /**
   * Run normal day scenario
   */
  async runNormalScenario(duration = 300000) {
    logger.info(`Starting normal scenario for ${duration / 1000} seconds`);
    
    // Devices will operate normally with routine vital monitoring
    // Check-ins will occur at scheduled times
    // No anomalies will be injected
    
    await new Promise(resolve => setTimeout(resolve, duration));
    logger.info('Normal scenario completed');
  }

  /**
   * Run emergency scenario
   */
  async runEmergencyScenario(patientId) {
    logger.info(`Starting emergency scenario for patient ${patientId}`);
    
    const device = this.devices.get(`elderly-${patientId}`);
    if (!device) {
      logger.error('Patient device not found');
      return;
    }

    // Simulate fall
    await device.simulateFall();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Trigger panic button
    await device.triggerPanicAlert('Emergency situation detected');
    
    logger.info('Emergency scenario completed');
  }

  /**
   * Run missed check-in scenario
   */
  async runMissedCheckInScenario(patientId) {
    logger.info(`Starting missed check-in scenario for patient ${patientId}`);
    
    const device = this.devices.get(`elderly-${patientId}`);
    if (!device) {
      logger.error('Patient device not found');
      return;
    }

    // Skip next check-in window
    device.setSkipNextCheckIn(true);
    
    logger.info('Missed check-in scenario configured - next check-in will be skipped');
  }

  /**
   * Run fall detection scenario
   */
  async runFallDetectionScenario(patientId) {
    logger.info(`Starting fall detection scenario for patient ${patientId}`);
    
    const device = this.devices.get(`elderly-${patientId}`);
    if (!device) {
      logger.error('Patient device not found');
      return;
    }

    await device.simulateFall();
    this.stats.fallsDetected++;
    
    logger.info('Fall detection scenario completed');
  }

  /**
   * Run vital anomaly scenario
   */
  async runVitalAnomalyScenario(patientId, vitalType = 'heart_rate', direction = 'high') {
    logger.info(`Starting vital anomaly scenario for patient ${patientId}: ${vitalType} ${direction}`);
    
    const device = this.devices.get(`elderly-${patientId}`);
    if (!device) {
      logger.error('Patient device not found');
      return;
    }

    await device.simulateVitalAnomaly(vitalType, direction);
    this.stats.vitalAnomalies++;
    
    logger.info('Vital anomaly scenario completed');
  }

  /**
   * Run caregiver check-in process
   */
  async performCaregiverCheckIn(caregiverId, patientId) {
    const caregiverDevice = this.devices.get(`caregiver-${caregiverId}`);
    const elderlyDevice = this.devices.get(`elderly-${patientId}`);
    
    if (!caregiverDevice || !elderlyDevice) {
      logger.error('One or both devices not found for check-in');
      return false;
    }

    logger.info(`Initiating check-in: Caregiver ${caregiverId} -> Patient ${patientId}`);
    
    // Simulate caregiver approaching patient (BLE proximity)
    await caregiverDevice.approachPatient(patientId);
    
    // Perform NFC tap verification
    await caregiverDevice.performCheckIn(patientId);
    
    this.stats.totalCheckIns++;
    this.stats.successfulCheckIns++;
    
    logger.info('Check-in completed successfully');
    return true;
  }
}

// ==================== CLI INTERFACE ====================

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    numElderlyPatients: 5,
    numCaregivers: 3,
    scenario: 'normal',
    duration: 300000,
    mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--patients':
        config.numElderlyPatients = parseInt(args[++i]);
        break;
      case '--caregivers':
        config.numCaregivers = parseInt(args[++i]);
        break;
      case '--scenario':
        config.scenario = args[++i];
        break;
      case '--duration':
        config.duration = parseInt(args[++i]) * 1000;
        break;
      case '--mqtt':
        config.mqttBrokerUrl = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
CHENGETO Health IoT Simulator

Usage: node src/index.js [options]

Options:
  --patients <n>      Number of elderly patient devices to simulate (default: 5)
  --caregivers <n>    Number of caregiver devices to simulate (default: 3)
  --scenario <name>   Scenario to run: normal, emergency, fall, anomaly (default: normal)
  --duration <secs>   Duration of simulation in seconds (default: 300)
  --mqtt <url>        MQTT broker URL (default: mqtt://localhost:1883)
  --help              Show this help message
  `);
}

/**
 * Main function
 */
async function main() {
  const config = parseArgs();
  
  logger.info('========================================');
  logger.info('CHENGETO Health IoT Simulator');
  logger.info('========================================');
  logger.info('Configuration:', config);

  const orchestrator = new IoTSimulatorOrchestrator(config);

  try {
    // Initialize MQTT connection
    await orchestrator.initialize();

    // Create elderly patient devices
    for (let i = 1; i <= config.numElderlyPatients; i++) {
      const patientId = `P${String(i).padStart(4, '0')}`;
      orchestrator.createElderlyDevice(patientId, {
        name: `Elderly Patient ${i}`,
        age: 70 + Math.floor(Math.random() * 15),
        medicalConditions: ['hypertension', 'diabetes'].slice(0, Math.floor(Math.random() * 2) + 1)
      });
    }

    // Create caregiver devices
    for (let i = 1; i <= config.numCaregivers; i++) {
      const caregiverId = `C${String(i).padStart(4, '0')}`;
      orchestrator.createCaregiverDevice(caregiverId, {
        name: `Caregiver ${i}`
      });
    }

    // Pair caregivers with patients
    const patientIds = Array.from(orchestrator.devices.keys())
      .filter(key => key.startsWith('elderly-'))
      .map(key => key.replace('elderly-', ''));
    
    const caregiverIds = Array.from(orchestrator.devices.keys())
      .filter(key => key.startsWith('caregiver-'))
      .map(key => key.replace('caregiver-', ''));

    // Distribute patients among caregivers
    patientIds.forEach((patientId, index) => {
      const caregiverId = caregiverIds[index % caregiverIds.length];
      orchestrator.pairPatientCaregiver(patientId, caregiverId);
    });

    // Start all simulations
    await orchestrator.startAll();

    // Run specified scenario
    if (config.scenario !== 'normal' && orchestrator.scenarios[config.scenario]) {
      const patientId = patientIds[0];
      await orchestrator.scenarios[config.scenario](patientId);
    }

    // Run for specified duration
    logger.info(`Running simulation for ${config.duration / 1000} seconds...`);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\nReceived SIGINT, shutting down...');
      await orchestrator.stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('\nReceived SIGTERM, shutting down...');
      await orchestrator.stopAll();
      process.exit(0);
    });

    // Keep running until duration expires
    setTimeout(async () => {
      logger.info('Simulation duration completed');
      await orchestrator.stopAll();
      process.exit(0);
    }, config.duration);

  } catch (error) {
    logger.error('Fatal error in simulator:', error);
    await orchestrator.stopAll();
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  IoTSimulatorOrchestrator,
  parseArgs
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
/**
 * CHENGETO Health - SMS Gateway Simulator
 * Simulates SMS/USSD communication for low-connectivity scenarios
 * Follows Zimbabwe mobile network patterns (Econet, NetOne, Telecel)
 */

const mqtt = require('mqtt');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [SMS-GATEWAY] [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

/**
 * SMS Message class
 */
class SMSMessage {
  constructor(options) {
    this.id = uuidv4();
    this.from = options.from;
    this.to = options.to;
    this.body = options.body;
    this.timestamp = new Date();
    this.status = 'pending'; // pending, sent, delivered, failed
    this.network = options.network || 'econet';
    this.deliveryAttempts = 0;
    this.maxDeliveryAttempts = 3;
  }

  markSent() {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  markDelivered() {
    this.status = 'delivered';
    this.deliveredAt = new Date();
  }

  markFailed(reason) {
    this.status = 'failed';
    this.failureReason = reason;
  }
}

/**
 * USSD Session class
 */
class USSDSession {
  constructor(options) {
    this.sessionId = uuidv4();
    this.phoneNumber = options.phoneNumber;
    this.network = options.network || 'econet';
    this.currentState = 'main_menu';
    this.history = [];
    this.data = {};
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.timeout = 180000; // 3 minutes
  }

  addHistory(menu, input, response) {
    this.history.push({
      menu,
      input,
      response,
      timestamp: new Date()
    });
    this.lastActivity = new Date();
  }

  isExpired() {
    return Date.now() - this.lastActivity.getTime() > this.timeout;
  }
}

/**
 * SMS Gateway Simulator
 */
class SMSGatewaySimulator {
  constructor(config = {}) {
    this.mqttBrokerUrl = config.mqttBrokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    this.mqttClient = null;
    
    // Network configurations (Zimbabwe mobile networks)
    this.networks = {
      econet: {
        name: 'Econet Wireless',
        prefixes: ['077', '078'],
        ussdCode: '*149#',
        smsCenter: '+263770000000'
      },
      netone: {
        name: 'NetOne',
        prefixes: ['071'],
        ussdCode: '*123#',
        smsCenter: '+263710000000'
      },
      telecel: {
        name: 'Telecel',
        prefixes: ['073'],
        ussdCode: '*122#',
        smsCenter: '+263730000000'
      }
    };

    // Message queues
    this.outboundQueue = [];
    this.inboundQueue = [];
    
    // USSD sessions
    this.ussdSessions = new Map();
    
    // Registered users (phone -> user mapping)
    this.registeredUsers = new Map();
    
    // Configuration
    this.config = {
      messageDelay: config.messageDelay || 2000, // 2 second delay
      deliveryRate: config.deliveryRate || 0.95, // 95% delivery success
      enableUSSD: config.enableUSSD !== false,
      enableSMS: config.enableSMS !== false,
      ...config
    };

    // Statistics
    this.stats = {
      smsSent: 0,
      smsDelivered: 0,
      smsFailed: 0,
      ussdSessions: 0,
      ussdCompleted: 0,
      alertsSent: 0
    };

    // Bind methods
    this.processUSSDInput = this.processUSSDInput.bind(this);
  }

  /**
   * Initialize the SMS Gateway
   */
  async initialize() {
    logger.info('Initializing SMS Gateway Simulator...');

    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(this.mqttBrokerUrl, {
        clientId: `sms-gateway-${Date.now()}`,
        clean: true
      });

      this.mqttClient.on('connect', () => {
        logger.info('SMS Gateway connected to MQTT broker');
        this.subscribeToTopics();
        this.startMessageProcessing();
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        logger.error('SMS Gateway MQTT error:', error);
        reject(error);
      });
    });
  }

  /**
   * Subscribe to MQTT topics
   */
  subscribeToTopics() {
    const topics = [
      'chengeto/sms/send',
      'chengeto/ussd/request',
      'chengeto/alerts/notify',
      'chengeto/notifications/sms'
    ];

    topics.forEach(topic => {
      this.mqttClient.subscribe(topic, (err) => {
        if (err) {
          logger.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          logger.info(`SMS Gateway subscribed to: ${topic}`);
        }
      });
    });

    this.mqttClient.on('message', (topic, message) => {
      this.handleMQTTMessage(topic, message);
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  handleMQTTMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());

      switch (topic) {
        case 'chengeto/sms/send':
          this.queueOutboundSMS(payload);
          break;
        case 'chengeto/ussd/request':
          this.handleUSSDRequest(payload);
          break;
        case 'chengeto/alerts/notify':
          this.sendAlertNotification(payload);
          break;
        case 'chengeto/notifications/sms':
          this.sendNotificationSMS(payload);
          break;
      }
    } catch (error) {
      logger.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Start message processing loop
   */
  startMessageProcessing() {
    // Process outbound SMS queue
    setInterval(() => {
      this.processOutboundQueue();
    }, this.config.messageDelay);

    // Clean up expired USSD sessions
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);

    logger.info('Message processing started');
  }

  // ==================== SMS FUNCTIONS ====================

  /**
   * Queue an outbound SMS message
   */
  queueOutboundSMS(options) {
    const sms = new SMSMessage({
      from: options.from || 'CHENGETO',
      to: options.to,
      body: options.body,
      network: this.detectNetwork(options.to)
    });

    this.outboundQueue.push(sms);
    logger.info(`Queued SMS to ${options.to}: ${options.body.substring(0, 50)}...`);
    return sms.id;
  }

  /**
   * Process outbound SMS queue
   */
  async processOutboundQueue() {
    if (this.outboundQueue.length === 0) return;

    const sms = this.outboundQueue.shift();
    
    // Simulate network delay
    await this.simulateNetworkDelay();

    // Simulate delivery success/failure
    if (Math.random() < this.config.deliveryRate) {
      sms.markSent();
      
      // Simulate delivery confirmation after delay
      setTimeout(() => {
        sms.markDelivered();
        this.stats.smsDelivered++;
        this.publishDeliveryReport(sms);
      }, 1000);

      this.stats.smsSent++;
      logger.info(`SMS sent successfully to ${sms.to}`);
    } else {
      sms.markFailed('Network error');
      this.stats.smsFailed++;
      logger.warn(`SMS delivery failed to ${sms.to}: Network error`);
      
      // Retry logic
      if (sms.deliveryAttempts < sms.maxDeliveryAttempts) {
        sms.deliveryAttempts++;
        sms.status = 'pending';
        this.outboundQueue.push(sms);
        logger.info(`Retrying SMS to ${sms.to} (attempt ${sms.deliveryAttempts})`);
      }
    }
  }

  /**
   * Send alert notification via SMS
   */
  sendAlertNotification(payload) {
    const { alertType, patientName, location, recipients, message } = payload;

    recipients.forEach(recipient => {
      const smsBody = this.formatAlertSMS(alertType, patientName, location, message);
      this.queueOutboundSMS({
        to: recipient.phone,
        body: smsBody
      });
      this.stats.alertsSent++;
    });

    logger.info(`Alert SMS queued for ${recipients.length} recipients`);
  }

  /**
   * Format alert SMS message
   */
  formatAlertSMS(alertType, patientName, location, customMessage) {
    const templates = {
      fall: `🚨 CHENGETO ALERT: Fall detected for ${patientName}. Location: ${location}. Please check immediately. Reply STOP to opt out.`,
      panic: `🚨 CHENGETO PANIC: ${patientName} has triggered panic alert. Location: ${location}. Immediate assistance required.`,
      vital_anomaly: `⚠️ CHENGETO HEALTH: Abnormal vitals detected for ${patientName}. Please check on patient.`,
      missed_checkin: `⚠️ CHENGETO: Missed check-in for ${patientName}. Scheduled time passed without verification.`,
      escalation: `🚨 CHENGETO ESCALATION: Unresolved alert for ${patientName} has been escalated. Urgent attention required.`,
      custom: customMessage || `CHENGETO: Notification for ${patientName}. ${customMessage || ''}`
    };

    return templates[alertType] || templates.custom;
  }

  /**
   * Send notification SMS
   */
  sendNotificationSMS(payload) {
    const { to, type, data } = payload;
    
    let body = '';
    switch (type) {
      case 'checkin_reminder':
        body = `CHENGETO: Reminder - Check-in due for ${data.patientName} in 30 minutes.`;
        break;
      case 'schedule_change':
        body = `CHENGETO: Schedule updated for ${data.patientName}. Next check-in: ${data.nextCheckIn}`;
        break;
      case 'medication_reminder':
        body = `CHENGETO: Medication reminder for ${data.patientName} - ${data.medication}`;
        break;
      case 'appointment':
        body = `CHENGETO: Upcoming appointment for ${data.patientName} on ${data.date} at ${data.time}`;
        break;
      default:
        body = `CHENGETO: ${data.message || 'You have a new notification'}`;
    }

    this.queueOutboundSMS({ to, body });
  }

  /**
   * Publish delivery report to MQTT
   */
  publishDeliveryReport(sms) {
    this.mqttClient.publish('chengeto/sms/delivery', JSON.stringify({
      messageId: sms.id,
      to: sms.to,
      status: sms.status,
      timestamp: new Date().toISOString()
    }));
  }

  // ==================== USSD FUNCTIONS ====================

  /**
   * Handle USSD request
   */
  handleUSSDRequest(payload) {
    const { phoneNumber, input, sessionId, network } = payload;
    
    // Get or create session
    let session = this.ussdSessions.get(sessionId);
    
    if (!session) {
      session = new USSDSession({
        phoneNumber,
        network: network || this.detectNetwork(phoneNumber)
      });
      this.ussdSessions.set(session.sessionId, session);
      this.stats.ussdSessions++;
    }

    // Process the USSD input
    const response = this.processUSSDInput(session, input);
    
    // Publish response
    this.mqttClient.publish('chengeto/ussd/response', JSON.stringify({
      sessionId: session.sessionId,
      phoneNumber: session.phoneNumber,
      response,
      continueSession: session.currentState !== 'end'
    }));
  }

  /**
   * Process USSD input and return response
   */
  processUSSDInput(session, input) {
    const user = this.registeredUsers.get(session.phoneNumber) || {
      role: 'unknown',
      name: 'Guest'
    };

    session.addHistory(session.currentState, input, null);

    switch (session.currentState) {
      case 'main_menu':
        return this.handleMainMenu(session, input, user);
      
      case 'checkin_menu':
        return this.handleCheckInMenu(session, input, user);
      
      case 'patient_select':
        return this.handlePatientSelect(session, input, user);
      
      case 'wellness_report':
        return this.handleWellnessReport(session, input, user);
      
      case 'alert_view':
        return this.handleAlertView(session, input, user);
      
      case 'family_update':
        return this.handleFamilyUpdate(session, input, user);
      
      default:
        session.currentState = 'main_menu';
        return this.getMainMenu(user);
    }
  }

  /**
   * Get main menu text
   */
  getMainMenu(user) {
    return `CON Welcome to CHENGETO Health, ${user.name}!
    
1. Check-in
2. View Patient Status
3. Report Wellness
4. View Alerts
5. Family Portal
6. Help`;
  }

  /**
   * Handle main menu selection
   */
  handleMainMenu(session, input, user) {
    switch (input) {
      case '1':
        session.currentState = 'checkin_menu';
        return 'CON Check-in Options:\n1. Start Check-in\n2. View Schedule\n0. Back';
      
      case '2':
        session.currentState = 'patient_select';
        return 'CON Select Patient:\n1. All Patients\n2. My Assigned\n0. Back';
      
      case '3':
        session.currentState = 'wellness_report';
        return 'CON Report Wellness:\n1. Good\n2. Minor Issues\n3. Needs Attention\n0. Back';
      
      case '4':
        session.currentState = 'alert_view';
        return 'CON Active Alerts:\nLoading...';
      
      case '5':
        session.currentState = 'family_update';
        return 'CON Family Portal:\n1. Latest Update\n2. Send Message\n0. Back';
      
      case '6':
        return 'CON CHENGETO Health Help\n\nFor emergencies, press panic button on device.\nFor support, call: 0800CHENGETO\n0. Back';
      
      default:
        return 'CON Invalid option. Please try again.\n' + this.getMainMenu(user);
    }
  }

  /**
   * Handle check-in menu
   */
  handleCheckInMenu(session, input, user) {
    switch (input) {
      case '1':
        // Start check-in process
        session.currentState = 'checkin_verify';
        return 'CON Starting check-in...\n\nApproach patient device and enter verification code:';
      
      case '2':
        // View schedule
        return this.formatSchedule(session, user);
      
      case '0':
        session.currentState = 'main_menu';
        return this.getMainMenu(user);
      
      default:
        return 'CON Invalid option.\n1. Start Check-in\n2. View Schedule\n0. Back';
    }
  }

  /**
   * Format schedule for USSD display
   */
  formatSchedule(session, user) {
    // Simulated schedule data
    const schedule = [
      { time: '08:00', patient: 'Gogo Mary', status: 'completed' },
      { time: '10:30', patient: 'Baba John', status: 'pending' },
      { time: '14:00', patient: 'Gogo Grace', status: 'upcoming' }
    ];

    let response = 'CON Today\'s Schedule:\n';
    schedule.forEach(item => {
      const statusIcon = item.status === 'completed' ? '✓' : 
                         item.status === 'pending' ? '○' : '◇';
      response += `${statusIcon} ${item.time} - ${item.patient}\n`;
    });
    response += '\n0. Back';
    
    return response;
  }

  /**
   * Handle patient selection
   */
  handlePatientSelect(session, input, user) {
    switch (input) {
      case '1':
        return this.formatAllPatients(session);
      case '2':
        return this.formatAssignedPatients(session, user);
      case '0':
        session.currentState = 'main_menu';
        return this.getMainMenu(user);
      default:
        return 'CON Invalid option.\n1. All Patients\n2. My Assigned\n0. Back';
    }
  }

  /**
   * Format all patients list
   */
  formatAllPatients(session) {
    const patients = [
      { id: 'P0001', name: 'Gogo Mary', status: 'stable' },
      { id: 'P0002', name: 'Baba John', status: 'attention' },
      { id: 'P0003', name: 'Gogo Grace', status: 'stable' }
    ];

    let response = 'CON All Patients:\n';
    patients.forEach((p, i) => {
      const statusIcon = p.status === 'stable' ? '🟢' : '🔴';
      response += `${i + 1}. ${statusIcon} ${p.name}\n`;
    });
    response += '\n0. Back';
    
    return response;
  }

  /**
   * Format assigned patients for user
   */
  formatAssignedPatients(session, user) {
    const patients = [
      { id: 'P0001', name: 'Gogo Mary', status: 'stable' },
      { id: 'P0003', name: 'Gogo Grace', status: 'stable' }
    ];

    let response = 'CON Your Assigned Patients:\n';
    patients.forEach((p, i) => {
      const statusIcon = p.status === 'stable' ? '🟢' : '🔴';
      response += `${i + 1}. ${statusIcon} ${p.name}\n`;
    });
    response += '\n0. Back';
    
    return response;
  }

  /**
   * Handle wellness report
   */
  handleWellnessReport(session, input, user) {
    switch (input) {
      case '1':
        this.recordWellness(session, 'good');
        return 'CON Wellness recorded: Good\nThank you for the report.\n\n0. Back to Main Menu';
      
      case '2':
        session.currentState = 'wellness_minor';
        return 'CON Minor Issues:\nPlease describe:\n1. Pain\n2. Fatigue\n3. Other\n0. Back';
      
      case '3':
        session.currentState = 'wellness_attention';
        return 'CON Needs Attention:\n1. Request callback\n2. Report symptom\n3. Emergency alert\n0. Back';
      
      case '0':
        session.currentState = 'main_menu';
        return this.getMainMenu(user);
      
      default:
        return 'CON Invalid option.\n1. Good\n2. Minor Issues\n3. Needs Attention\n0. Back';
    }
  }

  /**
   * Record wellness report
   */
  recordWellness(session, status) {
    // Publish wellness report to MQTT
    this.mqttClient.publish('chengeto/wellness/report', JSON.stringify({
      sessionId: session.sessionId,
      phoneNumber: session.phoneNumber,
      status,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Handle alert view
   */
  handleAlertView(session, input, user) {
    // Simulated active alerts
    const alerts = [
      { id: 'A001', patient: 'Baba John', type: 'missed_checkin', time: '2h ago' },
      { id: 'A002', patient: 'Gogo Mary', type: 'vital_anomaly', time: '30m ago' }
    ];

    let response = 'CON Active Alerts:\n';
    if (alerts.length === 0) {
      response += 'No active alerts.\n';
    } else {
      alerts.forEach((a, i) => {
        response += `${i + 1}. ${a.patient} - ${a.type.replace('_', ' ')} (${a.time})\n`;
      });
    }
    response += '\n0. Back';
    
    return response;
  }

  /**
   * Handle family update
   */
  handleFamilyUpdate(session, input, user) {
    switch (input) {
      case '1':
        // Get latest update for patient
        const update = this.getLatestFamilyUpdate(session.phoneNumber);
        return `CON Latest Update:\n${update}\n\n0. Back`;
      
      case '2':
        session.currentState = 'family_message';
        return 'CON Send Message:\nEnter your message:';
      
      case '0':
        session.currentState = 'main_menu';
        return this.getMainMenu(user);
      
      default:
        return 'CON Invalid option.\n1. Latest Update\n2. Send Message\n0. Back';
    }
  }

  /**
   * Get latest family update
   */
  getLatestFamilyUpdate(phoneNumber) {
    // Simulated family update
    return 'Gogo Mary is doing well today.\nLast check-in: 10:30 AM by Caregiver Sarah.\nVitals: Normal\nNext scheduled check-in: 2:00 PM';
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Detect network from phone number
   */
  detectNetwork(phoneNumber) {
    const prefix = phoneNumber.substring(0, 3);
    
    for (const [network, config] of Object.entries(this.networks)) {
      if (config.prefixes.includes(prefix)) {
        return network;
      }
    }
    
    return 'econet'; // Default to Econet
  }

  /**
   * Simulate network delay
   */
  async simulateNetworkDelay() {
    const baseDelay = 500;
    const variance = 1500;
    const delay = baseDelay + Math.random() * variance;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Register a user with phone number
   */
  registerUser(phoneNumber, userData) {
    this.registeredUsers.set(phoneNumber, {
      ...userData,
      registeredAt: new Date()
    });
    logger.info(`Registered user: ${phoneNumber} (${userData.role})`);
  }

  /**
   * Cleanup expired USSD sessions
   */
  cleanupExpiredSessions() {
    for (const [sessionId, session] of this.ussdSessions) {
      if (session.isExpired()) {
        this.ussdSessions.delete(sessionId);
        logger.debug(`Cleaned up expired USSD session: ${sessionId}`);
      }
    }
  }

  /**
   * Simulate inbound SMS (e.g., from a user's phone)
   */
  simulateInboundSMS(from, body) {
    const sms = new SMSMessage({
      from,
      to: 'CHENGETO',
      body,
      network: this.detectNetwork(from)
    });

    this.inboundQueue.push(sms);
    logger.info(`Received inbound SMS from ${from}: ${body}`);

    // Process the SMS
    this.processInboundSMS(sms);
  }

  /**
   * Process inbound SMS
   */
  processInboundSMS(sms) {
    const body = sms.body.toLowerCase().trim();

    // Check for commands
    if (body === 'checkin') {
      // Trigger check-in via SMS
      this.mqttClient.publish('chengeto/commands/checkin', JSON.stringify({
        phoneNumber: sms.from,
        timestamp: sms.timestamp.toISOString()
      }));
    } else if (body === 'status') {
      // Send status via SMS
      this.queueOutboundSMS({
        to: sms.from,
        body: 'CHENGETO Status: All systems operational. Your next check-in is scheduled for 2:00 PM.'
      });
    } else if (body === 'help') {
      // Send help message
      this.queueOutboundSMS({
        to: sms.from,
        body: 'CHENGETO Commands: CHECKIN - Start check-in | STATUS - View status | HELP - This message'
      });
    } else if (body === 'stop') {
      // Opt out of notifications
      this.mqttClient.publish('chengeto/notifications/optout', JSON.stringify({
        phoneNumber: sms.from,
        timestamp: sms.timestamp.toISOString()
      }));
      this.queueOutboundSMS({
        to: sms.from,
        body: 'You have been unsubscribed from CHENGETO notifications. Send START to resubscribe.'
      });
    } else if (body === 'start') {
      // Resubscribe to notifications
      this.mqttClient.publish('chengeto/notifications/subscribe', JSON.stringify({
        phoneNumber: sms.from,
        timestamp: sms.timestamp.toISOString()
      }));
      this.queueOutboundSMS({
        to: sms.from,
        body: 'Welcome back to CHENGETO notifications! You will receive alerts and reminders.'
      });
    } else {
      // Unknown command
      this.queueOutboundSMS({
        to: sms.from,
        body: 'Unknown command. Send HELP for available options.'
      });
    }
  }

  /**
   * Get gateway statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeSessions: this.ussdSessions.size,
      queueSize: this.outboundQueue.length,
      registeredUsers: this.registeredUsers.size
    };
  }

  /**
   * Shutdown the gateway
   */
  async shutdown() {
    logger.info('Shutting down SMS Gateway...');
    
    if (this.mqttClient) {
      this.mqttClient.end();
    }
    
    logger.info('SMS Gateway shutdown complete');
    logger.info('Final statistics:', this.getStatistics());
  }
}

// Export for use in other modules
module.exports = {
  SMSGatewaySimulator,
  SMSMessage,
  USSDSession
};

// CLI interface
if (require.main === module) {
  const gateway = new SMSGatewaySimulator();
  
  gateway.initialize()
    .then(() => {
      logger.info('SMS Gateway Simulator running...');
      
      // Demo: Register some users
      gateway.registerUser('0771234567', { role: 'caregiver', name: 'Sarah' });
      gateway.registerUser('0782345678', { role: 'family', name: 'John Jr.' });
      
      // Demo: Simulate inbound SMS
      setTimeout(() => {
        gateway.simulateInboundSMS('0771234567', 'status');
      }, 5000);
    })
    .catch(error => {
      logger.error('Failed to start SMS Gateway:', error);
      process.exit(1);
    });

  // Handle shutdown
  process.on('SIGINT', async () => {
    await gateway.shutdown();
    process.exit(0);
  });
}
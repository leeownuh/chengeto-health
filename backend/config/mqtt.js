/**
 * MQTT Broker Configuration
 * Aedes MQTT Broker for IoT Device Communication
 */

import aedes from 'aedes';
import net from 'net';
import ws from 'websocket-stream';
import http from 'http';
import { logger } from './logger.js';
import IoTDevice from '../models/IoTDevice.js';

let mqttBroker = null;
let mqttServer = null;
let wsServer = null;

// Aedes instance with persistence
const aedesInstance = aedes({
  concurrency: 100,
  heartbeatInterval: 60000,
  connectTimeout: 30000
});

// Authentication handler
aedesInstance.authenticate = async (client, username, password, callback) => {
  try {
    // Verify device credentials
    // In production, this would verify against device registry
    if (!username || !password) {
      logger.warn('MQTT authentication failed: missing credentials', { clientId: client.id });
      const error = new Error('Authentication failed');
      error.returnCode = 4; // Bad username or password
      return callback(error, false);
    }

    const demoAuth = String(process.env.MQTT_DEMO_AUTH || 'true').toLowerCase() === 'true';
    if (demoAuth) {
      // Demo mode: accept any non-empty credentials (browser simulator + local scripts).
      client.deviceId = username;
      logger.debug('MQTT client authenticated (demo)', { clientId: client.id, deviceId: username });
      callback(null, true);
      return;
    }

    // Production mode: username is deviceId and password is device secret.
    const deviceId = String(username);
    const secret = Buffer.isBuffer(password) ? password.toString() : String(password);

    const device = await IoTDevice.findOne({ deviceId }).select('+security.apiSecret');
    const expected = device?.security?.apiSecret;

    if (!device || !expected || secret !== expected) {
      logger.warn('MQTT authentication failed', { clientId: client.id, deviceId });
      const error = new Error('Authentication failed');
      error.returnCode = 4;
      return callback(error, false);
    }

    client.deviceId = deviceId;
    logger.debug('MQTT client authenticated', { clientId: client.id, deviceId });
    callback(null, true);
  } catch (error) {
    logger.error('MQTT authentication error', { error: error.message });
    callback(error, false);
  }
};

// Authorization handler for publish
aedesInstance.authorizePublish = async (client, packet, callback) => {
  try {
    const topic = packet.topic;
    
    // Verify client can publish to this topic
    // Topic format: chengeto/{patientId}/{dataType}
    const topicParts = topic.split('/');
    
    if (topicParts.length < 3) {
      logger.warn('MQTT invalid topic format', { topic, clientId: client.id });
      return callback(new Error('Invalid topic format'));
    }

    // In production, verify client has permission to publish for this patient
    logger.debug('MQTT publish authorized', { topic, clientId: client.id });
    callback(null);
  } catch (error) {
    logger.error('MQTT publish authorization error', { error: error.message });
    callback(error);
  }
};

// Authorization handler for subscribe
aedesInstance.authorizeSubscribe = async (client, packet, callback) => {
  try {
    const topic = packet.topic;
    
    // Verify client can subscribe to this topic
    logger.debug('MQTT subscribe authorized', { topic, clientId: client.id });
    callback(null, packet);
  } catch (error) {
    logger.error('MQTT subscribe authorization error', { error: error.message });
    callback(error);
  }
};

// Client connected
aedesInstance.on('client', (client) => {
  logger.info('MQTT client connected', { 
    clientId: client.id,
    deviceId: client.deviceId 
  });
});

// Client disconnected
aedesInstance.on('clientDisconnect', (client) => {
  logger.info('MQTT client disconnected', { 
    clientId: client.id,
    deviceId: client.deviceId 
  });
  
  // Emit device offline event
  if (global.io && client.deviceId) {
    global.io.emit('device:offline', { deviceId: client.deviceId });
  }
});

// Message published
aedesInstance.on('publish', (packet, client) => {
  if (client) {
    logger.debug('MQTT message published', {
      topic: packet.topic,
      clientId: client.id,
      payloadLength: packet.payload.length
    });
  }
});

// Message delivered
aedesInstance.on('delivered', (packet, client) => {
  logger.debug('MQTT message delivered', {
    topic: packet.topic,
    clientId: client?.id
  });
});

// Subscription
aedesInstance.on('subscribe', (subscriptions, client) => {
  logger.debug('MQTT subscription', {
    subscriptions: subscriptions.map(s => s.topic),
    clientId: client.id
  });
});

// Error handling
aedesInstance.on('error', (error) => {
  logger.error('MQTT broker error', { error: error.message });
});

export const setupMQTTBroker = () => {
  return new Promise((resolve, reject) => {
    try {
      // Create TCP server
      mqttServer = net.createServer(aedesInstance.handle);
      
      const mqttPort = parseInt(process.env.MQTT_PORT) || 1883;
      
      mqttServer.listen(mqttPort, () => {
        logger.info(`MQTT broker listening on port ${mqttPort}`);
        
        // Create WebSocket server for browser clients
        wsServer = http.createServer();
        ws.createServer({ server: wsServer }, aedesInstance.handle);
        
        const wsPort = parseInt(process.env.MQTT_WS_PORT) || 8083;
        wsServer.listen(wsPort, () => {
          logger.info(`MQTT WebSocket server listening on port ${wsPort}`);
          
          mqttBroker = aedesInstance;
          resolve(aedesInstance);
        });
      });

      mqttServer.on('error', (error) => {
        logger.error('MQTT server error', { error: error.message });
        reject(error);
      });

    } catch (error) {
      logger.error('Failed to setup MQTT broker', { error: error.message });
      reject(error);
    }
  });
};

export const getMQTTBroker = () => mqttBroker;

export const publishMQTTMessage = (topic, message, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!mqttBroker) {
      return reject(new Error('MQTT broker not initialized'));
    }

    const packet = {
      topic,
      payload: Buffer.from(JSON.stringify(message)),
      qos: options.qos || 1,
      retain: options.retain || false
    };

    mqttBroker.publish(packet, (error) => {
      if (error) {
        logger.error('MQTT publish error', { topic, error: error.message });
        reject(error);
      } else {
        logger.debug('MQTT message published', { topic });
        resolve();
      }
    });
  });
};

export const closeMQTTBroker = () => {
  return new Promise((resolve) => {
    if (mqttBroker) {
      mqttBroker.close(() => {
        logger.info('MQTT broker closed');
        resolve();
      });
    } else {
      resolve();
    }
    
    if (mqttServer) {
      mqttServer.close();
    }
    
    if (wsServer) {
      wsServer.close();
    }
  });
};

export default { setupMQTTBroker, getMQTTBroker, publishMQTTMessage, closeMQTTBroker };

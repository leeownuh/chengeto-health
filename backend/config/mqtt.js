/**
 * MQTT Broker Configuration
 * Aedes MQTT Broker for IoT Device Communication
 */

import aedes from 'aedes';
import crypto from 'crypto';
import { createRequire } from 'module';
import { WebSocketServer, createWebSocketStream } from 'ws';
import { logger } from './logger.js';
import IoTDevice from '../models/IoTDevice.js';

let mqttBroker = null;
let mqttServer = null;
let wsServer = null;
let wsUpgradeBound = false;
let wsPublicReady = false;
const require = createRequire(import.meta.url);
const { createServer: createAedesServer } = require('aedes-server-factory');

const DEFAULT_MQTT_WS_PATH = '/mqtt';
const DEFAULT_SIMULATOR_TTL_SECONDS = 15 * 60;

const normalizeMqttWsPath = (value = DEFAULT_MQTT_WS_PATH) => {
  const trimmed = String(value || DEFAULT_MQTT_WS_PATH).trim();
  if (!trimmed || trimmed === '/') {
    return DEFAULT_MQTT_WS_PATH;
  }

  return trimmed.startsWith('/') ? trimmed.replace(/\/+$/, '') : `/${trimmed.replace(/\/+$/, '')}`;
};

export const getMqttWsPath = () => normalizeMqttWsPath(process.env.MQTT_WS_PATH || DEFAULT_MQTT_WS_PATH);

const getSimulatorSigningSecret = () =>
  process.env.MQTT_SIMULATOR_SECRET ||
  process.env.JWT_SECRET ||
  process.env.REFRESH_TOKEN_SECRET ||
  'development-simulator-secret';

const signSimulatorCredential = ({ deviceId, expiresAt }) =>
  crypto
    .createHmac('sha256', getSimulatorSigningSecret())
    .update(`${deviceId}:${expiresAt}`)
    .digest('hex');

const verifySimulatorCredential = ({ deviceId, password }) => {
  const token = String(password || '');
  const [, expiresAtRaw, signature = ''] = token.split('.');
  const expiresAt = Number.parseInt(expiresAtRaw, 10);

  if (!deviceId || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expectedSignature = signSimulatorCredential({ deviceId, expiresAt });

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
};

export const issueSimulatorCredentials = ({ deviceId, ttlSeconds = DEFAULT_SIMULATOR_TTL_SECONDS }) => {
  const resolvedDeviceId = String(deviceId || '').trim();
  const expiresAt = Date.now() + (Math.max(60, Number(ttlSeconds) || DEFAULT_SIMULATOR_TTL_SECONDS) * 1000);
  const signature = signSimulatorCredential({ deviceId: resolvedDeviceId, expiresAt });

  return {
    username: resolvedDeviceId,
    password: `sim.${expiresAt}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString()
  };
};

export const getMQTTStatus = () => ({
  brokerReady: Boolean(mqttBroker),
  tcpReady: Boolean(mqttServer?.listening),
  publicWebSocketReady: Boolean(wsPublicReady),
  webSocketPath: getMqttWsPath()
});

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

    const simulatorTokenValid = verifySimulatorCredential({ deviceId, password: secret });

    if ((!device || !expected || secret !== expected) && !simulatorTokenValid) {
      logger.warn('MQTT authentication failed', { clientId: client.id, deviceId });
      const error = new Error('Authentication failed');
      error.returnCode = 4;
      return callback(error, false);
    }

    client.deviceId = deviceId;
    client.isSimulatorSession = simulatorTokenValid;
    logger.debug('MQTT client authenticated', {
      clientId: client.id,
      deviceId,
      simulatorSession: simulatorTokenValid
    });
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
      const mqttPort = parseInt(process.env.MQTT_PORT) || 1883;

      // Plain MQTT broker
      mqttServer = createAedesServer(aedesInstance);
      mqttServer.listen(mqttPort, () => {
        logger.info(`MQTT broker listening on port ${mqttPort}`);
        mqttBroker = aedesInstance;
        resolve(aedesInstance);
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

export const attachMQTTWebSocketServer = (httpServer) => {
  if (wsServer || !httpServer) {
    return wsServer;
  }

  const wsPath = getMqttWsPath();

  wsServer = new WebSocketServer({ noServer: true });
  wsServer.on('connection', (socket, request) => {
    const stream = createWebSocketStream(socket);
    stream._socket = socket._socket;
    aedesInstance.handle(stream, request);
  });
  wsServer.on('error', (error) => {
    logger.error('MQTT WebSocket bridge error', { error: error.message });
  });

  if (!wsUpgradeBound) {
    httpServer.on('upgrade', (request, socket, head) => {
      const requestPath = (() => {
        try {
          return new URL(request.url || '/', 'http://localhost').pathname;
        } catch {
          return request.url || '/';
        }
      })();

      if (requestPath !== wsPath) {
        return;
      }

      wsServer.handleUpgrade(request, socket, head, (upgradedSocket) => {
        wsServer.emit('connection', upgradedSocket, request);
      });
    });
    wsUpgradeBound = true;
  }

  wsPublicReady = true;
  logger.info('MQTT WebSocket bridge attached', { path: wsPath });

  return wsServer;
};

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
      wsServer = null;
      wsPublicReady = false;
    }
  });
};

export default {
  setupMQTTBroker,
  getMQTTBroker,
  getMQTTStatus,
  getMqttWsPath,
  issueSimulatorCredentials,
  attachMQTTWebSocketServer,
  publishMQTTMessage,
  closeMQTTBroker
};

/**
 * Socket.IO Service
 * Real-time communication for alerts and updates
 */

import { logger } from '../config/logger.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

let io = null;
const connectedUsers = new Map(); // userId -> socketId
const connectedDevices = new Map(); // deviceId -> socketId
const userRooms = new Map(); // userId -> Set of rooms

/**
 * Initialize Socket.IO service
 */
export const initializeSocketService = (socketIo) => {
  io = socketIo;

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      const deviceId = socket.handshake.auth.deviceId || socket.handshake.headers['x-device-id'];

      // Device authentication
      if (deviceId && !token) {
        socket.isDevice = true;
        socket.deviceId = deviceId;
        return next();
      }

      // User authentication
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id || decoded.userId);

      if (!user || user.status !== 'active') {
        return next(new Error('Invalid user'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.user = user;
      socket.isDevice = false;

      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    handleConnection(socket);
  });

  logger.info('Socket.IO service initialized');
};

/**
 * Handle new connection
 */
const handleConnection = (socket) => {
  logger.info('New socket connection', {
    socketId: socket.id,
    userId: socket.userId,
    deviceId: socket.deviceId,
    isDevice: socket.isDevice
  });

  // Track connected users/devices
  if (socket.userId) {
    connectedUsers.set(socket.userId, socket.id);
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
    
    userRooms.set(socket.userId, new Set([`user:${socket.userId}`, `role:${socket.userRole}`]));
  }

  if (socket.deviceId) {
    connectedDevices.set(socket.deviceId, socket.id);
    socket.join(`device:${socket.deviceId}`);
  }

  // Event handlers
  setupEventHandlers(socket);

  // Send connection acknowledgment
  socket.emit('connection:ack', {
    status: 'connected',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });
};

/**
 * Setup event handlers
 */
const setupEventHandlers = (socket) => {
  // Join a specific room
  socket.on('room:join', (room) => {
    socket.join(room);
    
    if (socket.userId) {
      const rooms = userRooms.get(socket.userId) || new Set();
      rooms.add(room);
      userRooms.set(socket.userId, rooms);
    }
    
    socket.emit('room:joined', { room });
    logger.debug('Socket joined room', { socketId: socket.id, room });
  });

  // Leave a room
  socket.on('room:leave', (room) => {
    socket.leave(room);
    
    if (socket.userId) {
      const rooms = userRooms.get(socket.userId);
      if (rooms) {
        rooms.delete(room);
      }
    }
    
    socket.emit('room:left', { room });
  });

  // Subscribe to patient updates
  socket.on('patient:subscribe', (patientId) => {
    if (socket.userId || socket.deviceId) {
      socket.join(`patient:${patientId}`);
      logger.debug('Subscribed to patient updates', { 
        socketId: socket.id, 
        patientId 
      });
    }
  });

  // Unsubscribe from patient updates
  socket.on('patient:unsubscribe', (patientId) => {
    socket.leave(`patient:${patientId}`);
  });

  // Handle real-time location updates (from devices)
  socket.on('location:update', (data) => {
    if (socket.isDevice) {
      handleLocationUpdate(socket, data);
    }
  });

  // Handle telemetry updates (from devices)
  socket.on('telemetry:update', (data) => {
    if (socket.isDevice || socket.userId) {
      handleTelemetryUpdate(socket, data);
    }
  });

  // Handle typing indicators
  socket.on('typing:start', (data) => {
    socket.to(data.room).emit('typing:started', {
      userId: socket.userId,
      timestamp: new Date()
    });
  });

  socket.on('typing:stop', (data) => {
    socket.to(data.room).emit('typing:stopped', {
      userId: socket.userId
    });
  });

  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    handleDisconnect(socket, reason);
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error('Socket error', {
      socketId: socket.id,
      userId: socket.userId,
      error: error.message
    });
  });
};

/**
 * Handle location update from device
 */
const handleLocationUpdate = (socket, data) => {
  // Emit to patient room if device is assigned to patient
  if (data.patientId) {
    io.to(`patient:${data.patientId}`).emit('location:updated', {
      deviceId: socket.deviceId,
      location: data.location,
      timestamp: new Date()
    });
  }
};

/**
 * Handle telemetry update
 */
const handleTelemetryUpdate = (socket, data) => {
  // Emit to relevant rooms
  if (data.patientId) {
    io.to(`patient:${data.patientId}`).emit('telemetry:updated', {
      type: data.type,
      value: data.value,
      timestamp: new Date()
    });
  }
};

/**
 * Handle disconnection
 */
const handleDisconnect = (socket, reason) => {
  logger.info('Socket disconnected', {
    socketId: socket.id,
    userId: socket.userId,
    deviceId: socket.deviceId,
    reason
  });

  // Clean up tracking maps
  if (socket.userId) {
    connectedUsers.delete(socket.userId);
    userRooms.delete(socket.userId);
  }

  if (socket.deviceId) {
    connectedDevices.delete(socket.deviceId);
  }
};

/**
 * Emit to specific user
 */
export const emitToUser = (userId, event, data) => {
  const socketId = connectedUsers.get(userId);
  
  if (socketId) {
    io.to(socketId).emit(event, data);
    return true;
  }
  
  // User not connected
  return false;
};

/**
 * Emit to specific role
 */
export const emitToRole = (role, event, data) => {
  io.to(`role:${role}`).emit(event, data);
};

/**
 * Emit to patient subscribers
 */
export const emitToPatient = (patientId, event, data) => {
  io.to(`patient:${patientId}`).emit(event, data);
};

/**
 * Emit alert notification
 */
export const emitAlert = async (alert) => {
  const alertData = {
    alertId: alert._id || alert.alertId,
    type: alert.type,
    severity: alert.severity,
    patientId: alert.patient,
    message: alert.message,
    timestamp: alert.createdAt || new Date()
  };

  // Notify all relevant parties
  if (alert.escalation?.currentLevel >= 1) {
    // Notify caregivers
    emitToRole('caregiver', 'alert:new', alertData);
  }
  
  if (alert.escalation?.currentLevel >= 2) {
    // Notify CHWs
    emitToRole('chw', 'alert:new', alertData);
  }
  
  if (alert.escalation?.currentLevel >= 3) {
    // Notify admins and clinicians
    emitToRole('admin', 'alert:new', alertData);
    emitToRole('clinician', 'alert:new', alertData);
  }

  // Notify patient room
  if (alert.patient) {
    emitToPatient(alert.patient, 'alert:new', alertData);
  }

  // Global alert channel for dashboards
  io.emit('alert:broadcast', alertData);
};

/**
 * Emit device status update
 */
export const emitDeviceStatus = (deviceId, status) => {
  io.to(`device:${deviceId}`).emit('device:status', {
    deviceId,
    status,
    timestamp: new Date()
  });
};

/**
 * Broadcast system notification
 */
export const broadcastNotification = (notification) => {
  io.emit('system:notification', {
    ...notification,
    timestamp: new Date()
  });
};

/**
 * Get online users count
 */
export const getOnlineUsersCount = () => {
  return connectedUsers.size;
};

/**
 * Get online devices count
 */
export const getOnlineDevicesCount = () => {
  return connectedDevices.size;
};

/**
 * Check if user is online
 */
export const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};

/**
 * Check if device is online
 */
export const isDeviceOnline = (deviceId) => {
  return connectedDevices.has(deviceId);
};

/**
 * Get all connected users
 */
export const getConnectedUsers = () => {
  return Array.from(connectedUsers.keys());
};

/**
 * Get all connected devices
 */
export const getConnectedDevices = () => {
  return Array.from(connectedDevices.keys());
};

export default {
  initializeSocketService,
  emitToUser,
  emitToRole,
  emitToPatient,
  emitAlert,
  emitDeviceStatus,
  broadcastNotification,
  getOnlineUsersCount,
  getOnlineDevicesCount,
  isUserOnline,
  isDeviceOnline,
  getConnectedUsers,
  getConnectedDevices
};

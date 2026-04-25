/**
 * CHENGETO Health - WebSocket Context
 * Manages real-time communication via Socket.IO
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSnackbar } from 'notistack';
import { useAuth } from './AuthContext';
import { resolveSocketUrl } from '../utils/runtimeUrls';

const SocketContext = createContext(null);

const SOCKET_URL = resolveSocketUrl();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    
    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      
      // Join user-specific room
      socket.emit('join:user', user._id);
      
      // Join role-specific room
      socket.emit('join:role', user.role);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Alert events
    socket.on('alert:new', (alert) => {
      console.log('New alert received:', alert);
      setAlerts((prev) => [alert, ...prev].slice(0, 50));
      
      // Show notification
      const severity = alert.severity === 'critical' ? 'error' : 
                       alert.severity === 'high' ? 'warning' : 'info';
      enqueueSnackbar(
        `${alert.type.replace('_', ' ').toUpperCase()}: ${alert.patient?.name || 'Patient'} - ${alert.severity}`,
        { 
          variant: severity,
          persist: alert.severity === 'critical',
          action: (key) => (
            <button onClick={() => window.location.href = `/alerts/${alert.id}`}>
              View
            </button>
          )
        }
      );

      // Browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification('CHENGETO Alert', {
          body: `${alert.type} - ${alert.patient?.name}`,
          icon: '/brand/chengeto-logo-square.png',
          tag: alert.id,
        });
      }
    });

    socket.on('alert:acknowledged', (data) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === data.id ? { ...a, status: 'acknowledged', acknowledgedBy: data.acknowledgedBy } : a
        )
      );
    });

    socket.on('alert:resolved', (data) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === data.id ? { ...a, status: 'resolved', resolvedBy: data.resolvedBy } : a
        )
      );
    });

    socket.on('alert:escalated', (data) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === data.id ? { ...a, escalationLevel: data.escalationLevel } : a
        )
      );
      enqueueSnackbar(`Alert escalated to level ${data.escalationLevel}`, { variant: 'warning' });
    });

    // Check-in events
    socket.on('checkin:completed', (data) => {
      enqueueSnackbar(
        `Check-in completed for ${data.patient?.name} by ${data.caregiver?.name}`,
        { variant: 'success' }
      );
    });

    // Telemetry events
    socket.on('telemetry:update', (data) => {
      // Emit custom event for components to listen to
      window.dispatchEvent(new CustomEvent('telemetry:update', { detail: data }));
    });

    // Notification events
    socket.on('notification', (notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      enqueueSnackbar(notification.message, { variant: notification.type || 'info' });
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, enqueueSnackbar]);

  // Join patient room for real-time updates
  const joinPatientRoom = useCallback((patientId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join:patient', patientId);
    }
  }, [isConnected]);

  // Leave patient room
  const leavePatientRoom = useCallback((patientId) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave:patient', patientId);
    }
  }, [isConnected]);

  // Emit custom event
  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    alerts,
    notifications,
    joinPatientRoom,
    leavePatientRoom,
    emit,
    requestNotificationPermission,
    clearAlerts,
    clearNotifications,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;

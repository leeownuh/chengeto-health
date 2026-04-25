/**
 * CHENGETO Health - Main Server Entry Point
 * Secure Digital Health Monitoring Platform for Elderly Care in Rural Zimbabwe
 * 
 * @version 1.0.0
 * @authors Leona Kokerai, Redeem Shaft Manhenga, Sandra Mukwati
 * @supervisor Dr. Shilpi Singh
 */

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import configurations
import { connectDatabase } from '../config/database.js';
import { setupMQTTBroker } from '../config/mqtt.js';
import { logger, morganStream } from '../config/logger.js';

// Import routes
import {
  authRoutes,
  patientCompatRoutes,
  patientRoutes,
  alertCompatRoutes,
  alertRoutes,
  checkInCompatRoutes,
  checkInRoutes,
  iotRoutes,
  dashboardRoutes,
  scheduleRoutes,
  userRoutes,
  careTransitionRoutes
} from '../routes/index.js';

// Import middleware
import { globalErrorHandler, notFoundHandler } from '../middleware/error.middleware.js';
import { rateLimiter } from '../middleware/rateLimit.middleware.js';
import { getMetricsHandler, metricsMiddleware } from './metrics.js';

// Import services
import { initializeSocketService } from '../services/socket.service.js';
import { initializeEscalationService } from '../services/escalation.service.js';
import { initializeBlockchainService } from '../services/blockchain.service.js';
import { initializeMqttIngestion } from '../services/mqttIngestion.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const demoAllowAnyOrigin = String(process.env.CORS_ALLOW_ANY_ORIGIN || '').toLowerCase() === 'true';
const allowAnyCorsOrigin =
  configuredCorsOrigins.length === 0
    ? false
    : configuredCorsOrigins.includes('*') && demoAllowAnyOrigin;

const corsOriginHandler = (origin, callback) => {
  // If CORS_ORIGIN isn't configured, default to local dev origins only.
  const defaultDevOrigins = ['http://localhost', 'http://127.0.0.1', 'http://localhost:80', 'http://127.0.0.1:80'];
  const allowedOrigins = configuredCorsOrigins.length > 0 ? configuredCorsOrigins : defaultDevOrigins;

  if (!origin || allowAnyCorsOrigin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  logger.warn('Blocked CORS request', { origin });
  callback(new Error('Not allowed by CORS'));
};

const corsOptions = {
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-Id']
};

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Make io accessible throughout the app
app.set('io', io);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp({
  whitelist: ['status', 'role', 'priority', 'escalationLevel']
}));

// Compression
app.use(compression());

// Metrics (Prometheus)
app.use(metricsMiddleware);

// HTTP request logging
app.use(morgan('combined', { stream: morganStream }));

// Rate limiting
app.use('/api/', rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'CHENGETO Health API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Prometheus metrics endpoint
app.get('/metrics', getMetricsHandler);

// API Routes
const API_VERSION = '/api/v1';
app.use(`${API_VERSION}/auth`, authRoutes);
app.use(`${API_VERSION}/users`, userRoutes);
app.use(`${API_VERSION}/schedules`, scheduleRoutes);
app.use(`${API_VERSION}/patients`, patientCompatRoutes);
app.use(`${API_VERSION}/patients`, patientRoutes);
app.use(`${API_VERSION}/checkins`, checkInCompatRoutes);
app.use(`${API_VERSION}/checkins`, checkInRoutes);
app.use(`${API_VERSION}/alerts`, alertCompatRoutes);
app.use(`${API_VERSION}/alerts`, alertRoutes);
app.use(`${API_VERSION}/iot`, iotRoutes);
app.use(`${API_VERSION}/dashboard`, dashboardRoutes);
app.use(`${API_VERSION}/transitions`, careTransitionRoutes);

// Backward-compatible route aliases used by older frontend screens.
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/patients', patientCompatRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/checkins', checkInCompatRoutes);
app.use('/api/checkins', checkInRoutes);
app.use('/api/checkin', checkInCompatRoutes);
app.use('/api/checkin', checkInRoutes);
app.use('/api/alerts', alertCompatRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/transitions', careTransitionRoutes);

// Serve static files in production when the frontend bundle exists locally.
const frontendDist = join(__dirname, '../../frontend/dist');

if (process.env.NODE_ENV === 'production' && existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

// Error handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
      
      const mqttBroker = app.get('mqttBroker');
      if (mqttBroker) {
        mqttBroker.close(() => {
          logger.info('MQTT broker closed');
        });
      }
      
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Initialize and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('MongoDB connected successfully');

    // Setup MQTT Broker
    const mqttBroker = await setupMQTTBroker();
    app.set('mqttBroker', mqttBroker);
    logger.info('MQTT broker started');

    // Initialize Socket.IO service
    initializeSocketService(io);
    global.io = io;
    logger.info('Socket.IO service initialized');

    // Bridge MQTT device messages into MongoDB-backed telemetry/alerts.
    initializeMqttIngestion(mqttBroker, io);

    // Initialize Escalation Service
    initializeEscalationService();
    logger.info('Escalation service initialized');

    // Initialize Blockchain Service
    await initializeBlockchainService();
    logger.info('Blockchain service initialized');

    // Start listening
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗███╗   ██╗██████╗ ███████╗██████╗                  ║
║  ██╔════╝████╗  ██║██╔══██╗██╔════╝██╔══██╗                 ║
║  ██║     ██╔██╗ ██║██║  ██║█████╗  ██████╔╝                 ║
║  ██║     ██║╚██╗██║██║  ██║██╔══╝  ██╔══██╗                 ║
║  ╚██████╗██║ ╚████║██████╔╝███████╗██║  ██║                 ║
║   ╚═════╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═╝                 ║
║                                                              ║
║   HEALTH - Proactive Elderly Care Platform                   ║
║                                                              ║
║   Server running on port ${PORT}                               ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  startServer();
}

export { app, server, io };

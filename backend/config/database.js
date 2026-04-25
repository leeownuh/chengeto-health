/**
 * MongoDB Database Configuration
 * Handles connection, retries, and connection pooling
 */

import mongoose from 'mongoose';
import { logger } from './logger.js';

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

let retryCount = 0;

const databaseOptions = {
  maxPoolSize: 50,
  minPoolSize: 5,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 75000,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true
};

export const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const connectWithRetry = async () => {
    try {
      const connection = await mongoose.connect(uri, databaseOptions);
      
      retryCount = 0;
      
      logger.info(`MongoDB connected: ${connection.connection.host}`);
      
      // Connection event handlers
      mongoose.connection.on('connected', () => {
        logger.info('MongoDB connection established');
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB connection disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB connection reestablished');
      });

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });

      return connection;
    } catch (error) {
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        logger.warn(`MongoDB connection failed (attempt ${retryCount}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
        return connectWithRetry();
      } else {
        logger.error('MongoDB connection failed after maximum retries');
        throw error;
      }
    }
  };

  return connectWithRetry();
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    throw error;
  }
};

export const getDatabaseStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    status: states[mongoose.connection.readyState],
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    port: mongoose.connection.port
  };
};

export default { connectDatabase, disconnectDatabase, getDatabaseStatus };
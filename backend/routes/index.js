/**
 * CHENGETO Health - API Routes Index
 * Exports all route modules
 */

import authRoutes from './auth.routes.js';
import patientCompatRoutes from './patient.compat.routes.js';
import patientRoutes from './patient.routes.js';
import alertCompatRoutes from './alert.compat.routes.js';
import alertRoutes from './alert.routes.js';
import checkInCompatRoutes from './checkin.compat.routes.js';
import checkInRoutes from './checkin.routes.js';
import iotRoutes from './iot.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import scheduleRoutes from './schedule.routes.js';
import userRoutes from './user.routes.js';
import careTransitionRoutes from './careTransition.routes.js';
import blockchainRoutes from './blockchain.routes.js';

export {
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
  careTransitionRoutes,
  blockchainRoutes
};

/**
 * Model Index - Export all models
 */

import User from './User.js';
import Patient from './Patient.js';
import Alert from './Alert.js';
import CheckIn from './CheckIn.js';
import IoTTelemetry from './IoTTelemetry.js';
import CareSchedule from './CareSchedule.js';
import AuditLog from './AuditLog.js';
import IoTDevice from './IoTDevice.js';
import CareTransition from './CareTransition.js';

// Re-export enums
export { USER_ROLES, USER_STATUS } from './User.js';
export { PATIENT_STATUS, RISK_LEVEL } from './Patient.js';
export { ALERT_TYPES, ALERT_SEVERITY, ESCALATION_LEVELS, ALERT_STATUS } from './Alert.js';
export { CHECKIN_STATUS, CHECKIN_TYPE, WELLNESS_STATUS } from './CheckIn.js';
export { TELEMETRY_STATUS, DEVICE_STATUS as IOT_DEVICE_STATUS } from './IoTTelemetry.js';
export { SCHEDULE_STATUS, DAYS_OF_WEEK } from './CareSchedule.js';
export { AUDIT_ACTIONS, AUDIT_RESULT } from './AuditLog.js';
export { DEVICE_STATUS, DEVICE_TYPES, DEVICE_CAPABILITIES } from './IoTDevice.js';
export { CARE_TRANSITION_STATUSES, CARE_TRANSITION_TYPES } from '../utils/careTransition.js';

export {
  User,
  Patient,
  Alert,
  CheckIn,
  IoTTelemetry,
  CareSchedule,
  AuditLog,
  IoTDevice,
  CareTransition
};

export default {
  User,
  Patient,
  Alert,
  CheckIn,
  IoTTelemetry,
  CareSchedule,
  AuditLog,
  IoTDevice,
  CareTransition
};

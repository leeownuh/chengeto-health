import express from 'express';
import CheckIn from '../models/CheckIn.js';
import Patient from '../models/Patient.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import {
  buildPatientAccessMatch,
  mapCheckInLegacy,
  parseLimit,
  parsePage
} from './compat.utils.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  async (req, res) => {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit, 20, 100);
    const patientQuery = buildPatientAccessMatch(req.user);
    const accessiblePatients = await Patient.find(patientQuery).select('_id').lean();
    const patientIds = accessiblePatients.map((patient) => patient._id);

    const dbQuery = {};
    if (!['admin', 'clinician', 'auditor'].includes(req.user.role)) {
      dbQuery.patient = { $in: patientIds };
    }

    if (req.query.patientId) {
      dbQuery.patient = req.query.patientId;
    }

    if (req.query.verificationMethod) {
      const mapping = {
        BLE: 'ble',
        NFC: 'nfc',
        GPS: 'gps',
        MANUAL: 'manual_override'
      };
      dbQuery['proximityVerification.method'] =
        mapping[req.query.verificationMethod] ?? req.query.verificationMethod;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      dbQuery.actualTime = {};
      if (req.query.dateFrom) {
        dbQuery.actualTime.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        dbQuery.actualTime.$lte = new Date(req.query.dateTo);
      }
    }

    const [checkIns, total] = await Promise.all([
      CheckIn.find(dbQuery)
        .populate('patient', 'firstName lastName patientId')
        .populate('caregiver', 'firstName lastName role')
        .sort({ actualTime: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CheckIn.countDocuments(dbQuery)
    ]);

    const payload = checkIns.map(mapCheckInLegacy);

    res.json({
      success: true,
      data: {
        checkIns: payload,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit) || 1,
          total,
          perPage: limit
        }
      },
      checkIns: payload,
      total
    });
  }
);

export default router;

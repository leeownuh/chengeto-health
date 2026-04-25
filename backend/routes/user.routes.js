import express from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { parseLimit } from './compat.utils.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize(['admin', 'chw', 'clinician', 'caregiver', 'auditor']),
  async (req, res) => {
    const query = {};

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (String(req.query.active).toLowerCase() === 'true') {
      query.status = 'active';
    } else if (req.query.status) {
      query.status = req.query.status;
    }

    const users = await User.find(query)
      .select('firstName lastName email phone role status ward district')
      .sort({ firstName: 1, lastName: 1 })
      .limit(parseLimit(req.query.limit, 100, 500))
      .lean();

    res.json({
      success: true,
      data: { users },
      users
    });
  }
);

export default router;

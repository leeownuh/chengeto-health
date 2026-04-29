import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import Alert from '../models/Alert.js';
import CheckIn from '../models/CheckIn.js';
import AuditLog, { AUDIT_ACTIONS, AUDIT_RESULT } from '../models/AuditLog.js';
import {
  createDataHash,
  getBlockchainStatus,
  getCareEvent,
  getCareEventByHash,
  verifyEventIntegrity,
  verifyEventIntegrityByHash
} from '../services/blockchain.service.js';

const router = express.Router();

const SUPPORTED_ENTITY_TYPES = ['checkin', 'alert'];

const normalizeHex = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized.startsWith('0x')) return normalized;
  if (/^[0-9a-f]{64}$/.test(normalized)) return `0x${normalized}`;
  return normalized;
};

const computeExpectedDataHash = (anchor) => {
  if (!anchor || typeof anchor !== 'object') {
    return null;
  }

  const { eventType, patientId, actorId, metadata } = anchor;
  if (!eventType || !patientId || !actorId) {
    return null;
  }

  const payload = {
    eventType,
    patientId: String(patientId),
    actorId: String(actorId),
    metadata: metadata || {}
  };

  return `0x${createDataHash(payload)}`;
};

const getEntityModel = (entityType) => {
  switch (entityType) {
    case 'checkin':
      return CheckIn;
    case 'alert':
      return Alert;
    default:
      return null;
  }
};

router.get(
  '/status',
  authenticate,
  authorize(['admin', 'auditor', 'clinician']),
  async (req, res) => {
    const status = await getBlockchainStatus();
    res.json({ success: true, data: status });
  }
);

router.post(
  '/verify',
  authenticate,
  authorize(['admin', 'auditor', 'clinician']),
  [
    body('entityType')
      .isString()
      .custom((value) => SUPPORTED_ENTITY_TYPES.includes(String(value).toLowerCase()))
      .withMessage(`entityType must be one of: ${SUPPORTED_ENTITY_TYPES.join(', ')}`),
    body('id').isMongoId().withMessage('Valid id required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const entityType = String(req.body.entityType).toLowerCase();
    const entityId = String(req.body.id);
    const Model = getEntityModel(entityType);

    if (!Model) {
      return res.status(400).json({ success: false, message: 'Unsupported entity type' });
    }

    const entity = await Model.findById(entityId).lean();

    if (!entity) {
      return res.status(404).json({ success: false, message: 'Entity not found' });
    }

    const record = entity.blockchainRecord || null;
    const isMockRecord = Boolean(record?.mock);
    const anchor = record?.anchor || null;
    const expectedDataHash = normalizeHex(computeExpectedDataHash(anchor));
    const storedDataHash = normalizeHex(record?.dataHash);

    const offChainCheck = {
      checked: Boolean(expectedDataHash && storedDataHash),
      expectedDataHash,
      storedDataHash,
      matches: expectedDataHash && storedDataHash ? expectedDataHash === storedDataHash : null,
      reason: null
    };

    if (record && !anchor) {
      offChainCheck.reason = 'Missing anchor payload; cannot recompute expected hash.';
    } else if (record && anchor && !expectedDataHash) {
      offChainCheck.reason = 'Anchor payload incomplete; cannot recompute expected hash.';
    } else if (!record) {
      offChainCheck.reason = 'No blockchain record attached to this entity.';
    }

    const chainStatus = await getBlockchainStatus();
    const chainCheck = {
      checked: false,
      mode: chainStatus?.mode || 'unknown',
      verified: null,
      onChainDataHash: null,
      eventId: record?.eventId || null,
      eventHash: normalizeHex(record?.eventHash) || null,
      reason: null
    };

    if (!record) {
      chainCheck.reason = 'No blockchain record attached to this entity.';
    } else if (isMockRecord) {
      chainCheck.reason = 'This record was anchored in mock mode (no on-chain event to verify).';
    } else if (chainStatus?.mode !== 'real') {
      chainCheck.reason = 'Blockchain service is not connected to a real chain (mock/fallback mode).';
    } else if (!expectedDataHash) {
      chainCheck.reason = 'Expected data hash unavailable; cannot verify on-chain.';
    } else {
      try {
        chainCheck.checked = true;

        if (record.eventId) {
          const verification = await verifyEventIntegrity(record.eventId, expectedDataHash);
          chainCheck.verified = Boolean(verification.verified);
          const chainEvent = await getCareEvent(record.eventId);
          chainCheck.onChainDataHash = normalizeHex(chainEvent?.dataHash);
        } else if (record.eventHash) {
          const verification = await verifyEventIntegrityByHash(record.eventHash, expectedDataHash);
          chainCheck.verified = Boolean(verification.verified);
          const chainEvent = await getCareEventByHash(record.eventHash);
          chainCheck.onChainDataHash = normalizeHex(chainEvent?.dataHash);
        } else {
          chainCheck.checked = false;
          chainCheck.reason = 'Missing eventId/eventHash; cannot query chain event.';
        }
      } catch (error) {
        chainCheck.checked = false;
        chainCheck.reason = error.message;
      }
    }

    const overallStatus = (() => {
      if (!record) return 'not_anchored';
      if (offChainCheck.checked && offChainCheck.matches === false) return 'offchain_mismatch';
      if (chainCheck.checked && chainCheck.verified === false) return 'onchain_mismatch';
      if (offChainCheck.checked && offChainCheck.matches && chainCheck.checked && chainCheck.verified)
        return 'verified';
      if (isMockRecord) return 'chain_unavailable';
      if (chainStatus?.mode !== 'real') return 'chain_unavailable';
      return 'unknown';
    })();

    try {
      await AuditLog.create({
        action: AUDIT_ACTIONS.BLOCKCHAIN_VERIFY,
        category: 'blockchain',
        result:
          overallStatus === 'verified'
            ? AUDIT_RESULT.SUCCESS
            : overallStatus === 'unknown'
              ? AUDIT_RESULT.PARTIAL
              : AUDIT_RESULT.FAILURE,
        actor: {
          userId: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        target: {
          type: entityType,
          id: entityId,
          model: entityType === 'checkin' ? 'CheckIn' : 'Alert',
          description: `Integrity verification for ${entityType}:${entityId}`
        },
        request: {
          method: req.method,
          endpoint: req.originalUrl,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        },
        details: {
          overallStatus,
          offChainCheck,
          chainCheck
        }
      });
    } catch {
      // Best-effort: do not break verification response if audit log write fails.
    }

    return res.json({
      success: true,
      data: {
        entityType,
        id: entityId,
        overallStatus,
        offChainCheck,
        chainCheck
      }
    });
  }
);

export default router;

/**
 * Blockchain Service
 * Integration with the CHENGETO Health accountability smart contract
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import { logger } from '../config/logger.js';
import { hashData } from '../utils/encryption.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTRACT_ARTIFACT_PATH = path.join(
  __dirname,
  '../contracts/ChengetoHealth.contract.json'
);
const DEPLOYMENT_RECORD_PATH = path.join(
  __dirname,
  '../runtime/blockchain.deployment.json'
);

const FALLBACK_CONTRACT_ABI = [
  'function recordCareEvent(bytes32 _eventId, bytes32 _patientId, bytes32 _actorId, uint8 _eventType, bytes32 _dataHash, uint8 _escalationLevel, bytes32 _proximityProof)',
  'function registerPatient(bytes32 _patientId)',
  'function registerActor(bytes32 _actorId, address _walletAddress, uint8 _role)',
  'function getCareEvent(bytes32 _eventId) view returns (tuple(bytes32 eventId, bytes32 patientId, bytes32 actorId, uint8 eventType, uint256 timestamp, bytes32 dataHash, uint8 escalationLevel, bool verified, bytes32 proximityProof))',
  'function verifyEventIntegrity(bytes32 _eventId, bytes32 _dataHash) view returns (bool)',
  'function getStatistics() view returns (uint256 _totalEvents, uint256 _totalPatients, uint256 _totalActors, uint256 _blockNumber)',
  'function patients(bytes32) view returns (bytes32 patientId, address registeredBy, uint256 registeredAt, bool active, uint256 eventCount)',
  'function actors(bytes32) view returns (bytes32 actorId, address walletAddress, uint8 role, bool active, uint256 registeredAt)',
  'function owner() view returns (address)',
  'function authorizedRegistrars(address) view returns (bool)'
];

let provider = null;
let wallet = null;
let contract = null;
let contractAddress = null;
let isInitialized = false;
let contractArtifact = null;

const pendingPatientRegistrations = new Map();
const pendingActorRegistrations = new Map();

const ZERO_HASH = ethers.ZeroHash;
const IS_TEST_ENV = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);

// Event types mapping
const EVENT_TYPES = {
  CHECKIN_COMPLETED: 0,
  CHECKIN_MISSED: 1,
  ALERT_TRIGGERED: 2,
  ALERT_ACKNOWLEDGED: 3,
  ALERT_ESCALATED: 4,
  ALERT_RESOLVED: 5,
  CARE_PLAN_CHANGED: 6,
  DEVICE_PAIRED: 7,
  PATIENT_ENROLLED: 8
};

// Alert levels mapping
const ALERT_LEVELS = {
  LEVEL_0: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3
};

// Actor roles mapping
const ACTOR_ROLES = {
  ADMIN: 0,
  CHW: 1,
  CAREGIVER: 2,
  CLINICIAN: 3
};

const readJsonFile = (targetPath) => {
  try {
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch (error) {
    logger.warn('Failed to read blockchain JSON file', {
      path: targetPath,
      message: error.message
    });
    return null;
  }
};

const ensureRuntimeDirectory = () => {
  fs.mkdirSync(path.dirname(DEPLOYMENT_RECORD_PATH), { recursive: true });
};

const persistDeploymentRecord = (deployment) => {
  ensureRuntimeDirectory();
  fs.writeFileSync(DEPLOYMENT_RECORD_PATH, JSON.stringify(deployment, null, 2));
};

const getContractArtifact = () => {
  if (contractArtifact) {
    return contractArtifact;
  }

  const artifact = readJsonFile(CONTRACT_ARTIFACT_PATH);
  if (!artifact?.abi) {
    logger.warn('Blockchain artifact not found, using fallback ABI only', {
      path: CONTRACT_ARTIFACT_PATH
    });
    contractArtifact = { abi: FALLBACK_CONTRACT_ABI };
    return contractArtifact;
  }

  contractArtifact = {
    ...artifact,
    abi: artifact.abi,
    bytecode: artifact.bytecode || null
  };

  return contractArtifact;
};

const hashId = (id) => ethers.id(String(id));

const toBytes32 = (value, { hashPlainText = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return ZERO_HASH;
  }

  const stringValue = String(value).trim();

  if (ethers.isHexString(stringValue, 32)) {
    return stringValue;
  }

  if (/^[0-9a-fA-F]{64}$/.test(stringValue)) {
    return `0x${stringValue.toLowerCase()}`;
  }

  return hashPlainText ? `0x${hashData(stringValue)}` : hashId(stringValue);
};

const normalizeEventType = (eventType) => {
  if (typeof eventType === 'number' && Number.isFinite(eventType)) {
    return Math.max(0, Math.min(eventType, Object.keys(EVENT_TYPES).length - 1));
  }

  if (typeof eventType === 'string') {
    if (EVENT_TYPES[eventType] !== undefined) {
      return EVENT_TYPES[eventType];
    }

    const parsedValue = Number.parseInt(eventType, 10);
    if (Number.isFinite(parsedValue)) {
      return Math.max(0, Math.min(parsedValue, Object.keys(EVENT_TYPES).length - 1));
    }
  }

  return EVENT_TYPES.CHECKIN_COMPLETED;
};

const normalizeAlertLevel = (level) => {
  if (typeof level === 'number' && Number.isFinite(level)) {
    return Math.max(0, Math.min(level, 3));
  }

  if (typeof level === 'string') {
    if (ALERT_LEVELS[level] !== undefined) {
      return ALERT_LEVELS[level];
    }

    const parsedValue = Number.parseInt(level, 10);
    if (Number.isFinite(parsedValue)) {
      return Math.max(0, Math.min(parsedValue, 3));
    }
  }

  return ALERT_LEVELS.LEVEL_0;
};

const normalizeActorRole = (role) => {
  if (!role) {
    return ACTOR_ROLES.CAREGIVER;
  }

  const roleKey = String(role).trim().toUpperCase();
  return ACTOR_ROLES[roleKey] ?? ACTOR_ROLES.CAREGIVER;
};

const deriveActorWalletAddress = (actorId) => {
  const addressHex = hashData(`chengeto-actor:${actorId}`).slice(0, 40);
  return ethers.getAddress(`0x${addressHex}`);
};

const withSingleFlight = async (pendingMap, key, task) => {
  if (pendingMap.has(key)) {
    return pendingMap.get(key);
  }

  const promise = Promise.resolve()
    .then(task)
    .finally(() => pendingMap.delete(key));

  pendingMap.set(key, promise);
  return promise;
};

const buildEventId = ({ eventId, eventType, patientId, actorId, metadata }) => {
  if (eventId) {
    return String(eventId);
  }

  const referenceId =
    metadata?.checkInId ||
    metadata?.alertId ||
    metadata?.scheduleId ||
    metadata?.patientId ||
    patientId;

  return `${eventType || 'CARE_EVENT'}:${referenceId}:${actorId}:${Date.now()}`;
};

const buildEventPayload = (eventData) => {
  const metadata = eventData.metadata || {};
  const eventType = eventData.eventType || 'CHECKIN_COMPLETED';
  const eventId = buildEventId({
    eventId: eventData.eventId,
    eventType,
    patientId: eventData.patientId,
    actorId: eventData.actorId,
    metadata
  });
  const dataHash = toBytes32(
    eventData.dataHash || createDataHash({
      eventType,
      patientId: eventData.patientId,
      actorId: eventData.actorId,
      metadata
    }),
    { hashPlainText: true }
  );
  const proximityProof = toBytes32(eventData.proximityProof, { hashPlainText: true });

  return {
    eventId,
    eventHash: hashId(eventId),
    patientId: String(eventData.patientId),
    patientHash: hashId(eventData.patientId),
    actorId: String(eventData.actorId),
    actorHash: hashId(eventData.actorId),
    eventType,
    eventTypeCode: normalizeEventType(eventType),
    escalationLevel: normalizeAlertLevel(
      eventData.escalationLevel ?? metadata.escalationLevel
    ),
    dataHash,
    proximityProof
  };
};

const getStoredDeploymentAddress = async () => {
  const deploymentRecord = readJsonFile(DEPLOYMENT_RECORD_PATH);
  if (!deploymentRecord?.address) {
    return null;
  }

  const code = await provider.getCode(deploymentRecord.address);
  return code && code !== '0x' ? deploymentRecord.address : null;
};

const deployContractIfNeeded = async () => {
  const artifact = getContractArtifact();
  if (!artifact?.bytecode || !wallet) {
    return null;
  }

  const autoDeployEnabled = (process.env.BLOCKCHAIN_AUTO_DEPLOY || 'true') !== 'false';
  if (!autoDeployEnabled) {
    return null;
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const deployedContract = await factory.deploy();
  await deployedContract.waitForDeployment();

  const network = await provider.getNetwork();
  const address = await deployedContract.getAddress();
  const deploymentRecord = {
    contractName: 'ChengetoHealth',
    address,
    owner: wallet.address,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString()
  };

  persistDeploymentRecord(deploymentRecord);

  logger.info('Blockchain contract deployed automatically', {
    address,
    chainId: Number(network.chainId)
  });

  return address;
};

const ensureContractReady = async () => {
  const artifact = getContractArtifact();
  const abi = artifact?.abi || FALLBACK_CONTRACT_ABI;
  const configuredAddress =
    process.env.BLOCKCHAIN_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || null;

  let resolvedAddress = configuredAddress;

  if (resolvedAddress) {
    const code = await provider.getCode(resolvedAddress);
    if (!code || code === '0x') {
      logger.warn('Configured blockchain contract address has no deployed code', {
        address: resolvedAddress
      });
      resolvedAddress = null;
    }
  }

  if (!resolvedAddress) {
    resolvedAddress = await getStoredDeploymentAddress();
  }

  if (!resolvedAddress) {
    resolvedAddress = await deployContractIfNeeded();
  }

  if (!resolvedAddress || !wallet) {
    contract = null;
    contractAddress = null;
    return null;
  }

  contract = new ethers.Contract(resolvedAddress, abi, wallet);
  contractAddress = resolvedAddress;

  try {
    const [network, owner] = await Promise.all([
      provider.getNetwork(),
      contract.owner().catch(() => null)
    ]);
    const authorized =
      owner?.toLowerCase() === wallet.address.toLowerCase()
        ? true
        : await contract.authorizedRegistrars(wallet.address).catch(() => false);

    logger.info('Blockchain contract connected', {
      address: resolvedAddress,
      chainId: Number(network.chainId),
      wallet: wallet.address,
      owner,
      authorized
    });
  } catch (error) {
    logger.warn('Blockchain contract connected but authorization check failed', {
      address: resolvedAddress,
      message: error.message
    });
  }

  return contract;
};

const ensurePatientRegisteredOnChain = async (patientId) => {
  if (!contract) {
    return null;
  }

  return withSingleFlight(pendingPatientRegistrations, patientId, async () => {
    const patientHash = hashId(patientId);
    const patientRecord = await contract.patients(patientHash);

    if (patientRecord?.active) {
      return patientHash;
    }

    const tx = await contract.registerPatient(patientHash);
    await tx.wait();

    logger.info('Patient registered on blockchain', {
      patientId,
      patientHash,
      transactionHash: tx.hash
    });

    return patientHash;
  });
};

const ensureActorRegisteredOnChain = async (actorId, role, walletAddress) => {
  if (!contract) {
    return null;
  }

  return withSingleFlight(pendingActorRegistrations, actorId, async () => {
    const actorHash = hashId(actorId);
    const actorRecord = await contract.actors(actorHash);

    if (actorRecord?.active) {
      return actorHash;
    }

    const actor = await User.findById(actorId).select('role').lean().catch(() => null);
    const actorRole = normalizeActorRole(role || actor?.role);
    const resolvedWalletAddress =
      walletAddress && ethers.isAddress(walletAddress)
        ? walletAddress
        : deriveActorWalletAddress(actorId);

    const tx = await contract.registerActor(actorHash, resolvedWalletAddress, actorRole);
    await tx.wait();

    logger.info('Actor registered on blockchain', {
      actorId,
      actorHash,
      role: actor?.role || role || 'caregiver',
      walletAddress: resolvedWalletAddress,
      transactionHash: tx.hash
    });

    return actorHash;
  });
};

/**
 * Initialize blockchain service
 */
export const initializeBlockchainService = async () => {
  try {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    provider = new ethers.JsonRpcProvider(rpcUrl);
    await provider.getBlockNumber();

    if (privateKey) {
      wallet = new ethers.Wallet(privateKey, provider);
      logger.info('Blockchain wallet initialized', {
        address: wallet.address
      });
    } else {
      wallet = null;
      logger.warn('Blockchain private key missing, blockchain writes will stay in mock mode');
    }

    await ensureContractReady();

    if (!contract) {
      logger.warn('Blockchain contract not configured - using mock mode');
    }

    isInitialized = true;
    return Boolean(contract);
  } catch (error) {
    logger.error('Failed to initialize blockchain service', {
      message: error.message
    });
    provider = null;
    wallet = null;
    contract = null;
    contractAddress = null;
    isInitialized = true;
    return false;
  }
};

/**
 * Record a care event on the blockchain
 */
export const recordCareEvent = async (eventData) => {
  try {
    const payload = buildEventPayload(eventData);

    if (!isInitialized) {
      if (IS_TEST_ENV) {
        return {
          success: true,
          eventId: payload.eventId,
          eventHash: payload.eventHash,
          transactionHash: `0x${hashData(`${payload.eventId}:${Date.now()}`)}`,
          blockNumber: 0,
          contractAddress: null,
          dataHash: payload.dataHash,
          recordedAt: new Date().toISOString(),
          mock: true,
          skipped: true
        };
      }

      throw new Error('Blockchain service not initialized');
    }

    if (contract) {
      await ensurePatientRegisteredOnChain(payload.patientId);
      await ensureActorRegisteredOnChain(
        payload.actorId,
        eventData.actorRole,
        eventData.actorWalletAddress
      );

      const tx = await contract.recordCareEvent(
        payload.eventHash,
        payload.patientHash,
        payload.actorHash,
        payload.eventTypeCode,
        payload.dataHash,
        payload.escalationLevel,
        payload.proximityProof
      );

      const receipt = await tx.wait();
      const resolvedContractAddress = contractAddress || (await contract.getAddress());

      logger.info('Care event recorded on blockchain', {
        eventId: payload.eventId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        contractAddress: resolvedContractAddress
      });

      return {
        success: true,
        eventId: payload.eventId,
        eventHash: payload.eventHash,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        contractAddress: resolvedContractAddress,
        dataHash: payload.dataHash,
        recordedAt: new Date().toISOString(),
        mock: false
      };
    }

    const mockTxHash = `0x${hashData(`${payload.eventId}:${Date.now()}`)}`;

    logger.debug('Mock blockchain record', {
      eventId: payload.eventId,
      eventHash: payload.eventHash,
      patientHash: payload.patientHash,
      actorHash: payload.actorHash,
      eventType: payload.eventType
    });

    return {
      success: true,
      eventId: payload.eventId,
      eventHash: payload.eventHash,
      transactionHash: mockTxHash,
      blockNumber: Math.floor(Date.now() / 1000),
      contractAddress: null,
      dataHash: payload.dataHash,
      recordedAt: new Date().toISOString(),
      mock: true
    };
  } catch (error) {
    if (!IS_TEST_ENV) {
      logger.error('Failed to record care event on blockchain', {
        message: error.message,
        eventType: eventData?.eventType,
        patientId: eventData?.patientId,
        actorId: eventData?.actorId
      });
    }
    throw error;
  }
};

/**
 * Register a patient on the blockchain
 */
export const registerPatient = async (patientId) => {
  try {
    if (!isInitialized) {
      if (IS_TEST_ENV) {
        return {
          success: true,
          patientHash: hashId(patientId),
          transactionHash: `0x${hashData(`${patientId}:${Date.now()}`)}`,
          contractAddress: null,
          mock: true,
          skipped: true
        };
      }
      throw new Error('Blockchain service not initialized');
    }

    const patientHash = hashId(patientId);

    if (contract) {
      await ensurePatientRegisteredOnChain(String(patientId));

      return {
        success: true,
        patientHash,
        transactionHash: null,
        contractAddress,
        mock: false
      };
    }

    return {
      success: true,
      patientHash,
      transactionHash: `0x${hashData(`${patientId}:${Date.now()}`)}`,
      contractAddress: null,
      mock: true
    };
  } catch (error) {
    if (!IS_TEST_ENV) {
      logger.error('Failed to register patient on blockchain', {
        message: error.message,
        patientId
      });
    }
    throw error;
  }
};

/**
 * Register an actor on the blockchain
 */
export const registerActor = async (actorId, walletAddress, role) => {
  try {
    if (!isInitialized) {
      if (IS_TEST_ENV) {
        return {
          success: true,
          actorHash: hashId(actorId),
          walletAddress: walletAddress || deriveActorWalletAddress(actorId),
          transactionHash: `0x${hashData(`${actorId}:${Date.now()}`)}`,
          contractAddress: null,
          mock: true,
          skipped: true
        };
      }
      throw new Error('Blockchain service not initialized');
    }

    const actorHash = hashId(actorId);

    if (contract) {
      await ensureActorRegisteredOnChain(String(actorId), role, walletAddress);

      return {
        success: true,
        actorHash,
        walletAddress: walletAddress || deriveActorWalletAddress(actorId),
        transactionHash: null,
        contractAddress,
        mock: false
      };
    }

    return {
      success: true,
      actorHash,
      walletAddress: walletAddress || deriveActorWalletAddress(actorId),
      transactionHash: `0x${hashData(`${actorId}:${Date.now()}`)}`,
      contractAddress: null,
      mock: true
    };
  } catch (error) {
    if (!IS_TEST_ENV) {
      logger.error('Failed to register actor on blockchain', {
        message: error.message,
        actorId,
        role
      });
    }
    throw error;
  }
};

/**
 * Verify event integrity
 */
export const verifyEventIntegrity = async (eventId, dataHash) => {
  try {
    if (!isInitialized || !contract) {
      return { verified: true, eventId, mock: true };
    }

    const eventHash = hashId(eventId);
    const isValid = await contract.verifyEventIntegrity(
      eventHash,
      toBytes32(dataHash, { hashPlainText: true })
    );

    return {
      verified: Boolean(isValid),
      eventId,
      mock: false
    };
  } catch (error) {
    logger.error('Failed to verify event integrity', {
      message: error.message,
      eventId
    });
    throw error;
  }
};

/**
 * Get care event from blockchain
 */
export const getCareEvent = async (eventId) => {
  try {
    if (!isInitialized || !contract) {
      return {
        eventId: hashId(eventId),
        contractAddress: null,
        mock: true
      };
    }

    const eventHash = hashId(eventId);
    const event = await contract.getCareEvent(eventHash);
    const eventTypeCode = Number(event.eventType);
    const escalationLevel = Number(event.escalationLevel);

    return {
      eventId: event.eventId,
      patientId: event.patientId,
      actorId: event.actorId,
      eventType:
        Object.keys(EVENT_TYPES).find((key) => EVENT_TYPES[key] === eventTypeCode) ||
        eventTypeCode,
      timestamp: new Date(Number(event.timestamp) * 1000),
      dataHash: event.dataHash,
      escalationLevel:
        Object.keys(ALERT_LEVELS).find((key) => ALERT_LEVELS[key] === escalationLevel) ||
        escalationLevel,
      verified: event.verified,
      proximityProof: event.proximityProof,
      contractAddress,
      mock: false
    };
  } catch (error) {
    logger.error('Failed to get care event', {
      message: error.message,
      eventId
    });
    throw error;
  }
};

/**
 * Get blockchain statistics
 */
export const getStatistics = async () => {
  try {
    if (!isInitialized || !provider) {
      return {
        totalEvents: 0,
        totalPatients: 0,
        totalActors: 0,
        blockNumber: 0,
        contractAddress: null,
        mock: true
      };
    }

    if (!contract) {
      return {
        totalEvents: 0,
        totalPatients: 0,
        totalActors: 0,
        blockNumber: await provider.getBlockNumber(),
        contractAddress: null,
        mock: true
      };
    }

    const stats = await contract.getStatistics();

    return {
      totalEvents: Number(stats._totalEvents),
      totalPatients: Number(stats._totalPatients),
      totalActors: Number(stats._totalActors),
      blockNumber: Number(stats._blockNumber),
      contractAddress,
      mock: false
    };
  } catch (error) {
    logger.error('Failed to get blockchain statistics', {
      message: error.message
    });
    throw error;
  }
};

export const getBlockchainStatus = async () => {
  try {
    if (!isInitialized) {
      return {
        mode: 'initializing',
        connected: false,
        contractAddress: null
      };
    }

    if (!provider) {
      return {
        mode: 'offline',
        connected: false,
        contractAddress: null
      };
    }

    const network = await provider.getNetwork();

    if (!contract) {
      return {
        mode: 'mock',
        connected: true,
        chainId: Number(network.chainId),
        blockNumber: await provider.getBlockNumber(),
        walletAddress: wallet?.address || null,
        contractAddress: null
      };
    }

    const stats = await getStatistics();

    return {
      mode: 'real',
      connected: true,
      chainId: Number(network.chainId),
      blockNumber: stats.blockNumber,
      walletAddress: wallet?.address || null,
      contractAddress: stats.contractAddress,
      totalEvents: stats.totalEvents,
      totalPatients: stats.totalPatients,
      totalActors: stats.totalActors
    };
  } catch (error) {
    logger.warn('Failed to get blockchain status', {
      message: error.message
    });

    return {
      mode: 'error',
      connected: false,
      contractAddress: contractAddress || null
    };
  }
};

/**
 * Create data hash for blockchain anchoring
 */
export const createDataHash = (data) => {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return hashData(dataString);
};

/**
 * Create proximity proof hash
 */
export const createProximityProof = (caregiverId, patientId, timestamp, bleData) => {
  const proofData = `${caregiverId}:${patientId}:${timestamp}:${bleData}`;
  return hashData(proofData);
};

export default {
  initializeBlockchainService,
  recordCareEvent,
  registerPatient,
  registerActor,
  verifyEventIntegrity,
  getCareEvent,
  getStatistics,
  getBlockchainStatus,
  createDataHash,
  createProximityProof,
  EVENT_TYPES,
  ALERT_LEVELS,
  ACTOR_ROLES
};

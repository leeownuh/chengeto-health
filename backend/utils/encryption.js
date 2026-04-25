/**
 * Encryption Utilities
 * AES-256-GCM encryption for sensitive data
 */

import crypto from 'crypto';

// Get encryption key from environment or use default for development
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  process.env.AES_ENCRYPTION_KEY ||
  'Ch3ng3t0H3althS3cur3K3y!@#32ch';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Ensure key is exactly 32 bytes (256 bits)
const getKey = () => {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text (iv:authTag:encrypted)
 */
export const encrypt = (text) => {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getKey();
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted text (iv:authTag:encrypted)
 * @returns {string} - Decrypted plain text
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData) return encryptedData;
  
  try {
    // Check if data is already in encrypted format
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      // Not encrypted, return as-is (for backward compatibility)
      return encryptedData;
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getKey();
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, return original data (for backward compatibility)
    console.warn('Decryption warning:', error.message);
    return encryptedData;
  }
};

// Backward-compatible aliases used by route modules.
export const encryptField = encrypt;
export const decryptField = decrypt;

/**
 * Hash data using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} - SHA-256 hash
 */
export const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Generate a random token
 * @param {number} length - Token length in bytes
 * @returns {string} - Random hex token
 */
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate secure random string
 * @param {number} length - String length
 * @returns {string} - Random string
 */
export const generateSecureString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
};

/**
 * Derive key from password using PBKDF2
 * @param {string} password - Password to derive key from
 * @param {string} salt - Salt for key derivation
 * @param {number} iterations - Number of iterations (default: 100000)
 * @returns {Promise<string>} - Derived key as hex string
 */
export const deriveKey = async (password, salt, iterations = 100000) => {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, 'sha256', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
};

/**
 * Create HMAC signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {string} - HMAC signature
 */
export const createHMAC = (data, secret) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key
 * @returns {boolean} - Whether signature is valid
 */
export const verifyHMAC = (data, signature, secret) => {
  const expectedSignature = createHMAC(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

/**
 * Encrypt object to JSON string
 * @param {object} obj - Object to encrypt
 * @returns {string} - Encrypted JSON string
 */
export const encryptObject = (obj) => {
  return encrypt(JSON.stringify(obj));
};

/**
 * Decrypt JSON string to object
 * @param {string} encryptedJson - Encrypted JSON string
 * @returns {object} - Decrypted object
 */
export const decryptObject = (encryptedJson) => {
  const decrypted = decrypt(encryptedJson);
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
};

export default {
  encrypt,
  decrypt,
  encryptField,
  decryptField,
  hashData,
  generateToken,
  generateSecureString,
  deriveKey,
  createHMAC,
  verifyHMAC,
  encryptObject,
  decryptObject
};

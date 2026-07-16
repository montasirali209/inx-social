const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PREFIX = 'enc:v1';

function getKey() {
  const secret = String(process.env.TOKEN_ENCRYPTION_KEY || '').trim();
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required for Meta token storage');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function isEncrypted(value) {
  return String(value || '').startsWith(`${PREFIX}:`);
}

function encryptToken(value) {
  const plainText = String(value || '').trim();
  if (!plainText) return null;
  if (isEncrypted(plainText)) return plainText;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
}

function decryptToken(value) {
  const stored = String(value || '').trim();
  if (!stored) return null;

  // Backwards compatibility for Pages saved before encryption was introduced.
  if (!isEncrypted(stored)) return stored;

  const parts = stored.split(':');
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}` !== PREFIX) {
    throw new Error('Stored Meta token has an invalid encrypted format');
  }

  const iv = Buffer.from(parts[2], 'base64url');
  const tag = Buffer.from(parts[3], 'base64url');
  const encrypted = Buffer.from(parts[4], 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');
}

module.exports = {
  encryptToken,
  decryptToken,
  isEncrypted
};

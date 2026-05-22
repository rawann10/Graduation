// backend/utils/fileEncryption.js
// AES-256-GCM helpers for encrypting/decrypting file buffers.
//
// NOTE: Uploaded files in this application are only stored on disk temporarily.
// The analyze route saves them via multer and deletes them ~5 seconds after processing
// (see routes/analyze.js). They are never persisted long-term. These helpers are provided
// for completeness in case a future feature stores files permanently, but they are not
// called in the current pipeline. If you add permanent file storage, call encryptFile()
// before writing and decryptFile() before reading.

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) throw new Error('ENCRYPTION_KEY is not set');
    return crypto.createHash('sha256').update(raw).digest();
}

// Returns a Buffer: [iv (16 bytes)][authTag (16 bytes)][encrypted data]
function encryptFile(buffer) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
}

// Expects the format produced by encryptFile
function decryptFile(encryptedBuffer) {
    const key = getKey();
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = { encryptFile, decryptFile };

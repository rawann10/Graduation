// backend/utils/dbEncryption.js
// AES-256-GCM field-level encryption for sensitive SQLite columns (e.g. full_name).
// Uses the same ENCRYPTION_KEY as the analysis result encryption.
//
// Fields encrypted: users.full_name
// Fields NOT encrypted: email (used in WHERE clauses — encrypting breaks indexing),
//                       primary keys, foreign keys, status fields

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const PREFIX = 'dbenc:';

function getKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) return null;
    return crypto.createHash('sha256').update(raw).digest();
}

function encryptField(plaintext) {
    if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
    const key = getKey();
    if (!key) {
        if (!encryptField._warned) {
            console.warn('⚠️  ENCRYPTION_KEY not set — sensitive DB fields stored unencrypted');
            encryptField._warned = true;
        }
        return plaintext;
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// Gracefully handles both encrypted and legacy plaintext values
function decryptField(stored) {
    if (!stored || !stored.startsWith(PREFIX)) return stored; // Not encrypted — return as-is
    const key = getKey();
    if (!key) {
        console.error('Encrypted DB field found but ENCRYPTION_KEY is not set');
        return null;
    }
    try {
        const rest = stored.slice(PREFIX.length);
        const [ivHex, authTagHex, encHex] = rest.split(':');
        const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return Buffer.concat([
            decipher.update(Buffer.from(encHex, 'hex')),
            decipher.final()
        ]).toString('utf8');
    } catch {
        console.error('Failed to decrypt DB field — key mismatch or corrupted data');
        return null;
    }
}

module.exports = { encryptField, decryptField };

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';

function getKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) return null;
    // Derive a consistent 32-byte key from whatever string they provide
    return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
    const key = getKey();
    if (!key) {
        // No key configured — store unencrypted but warn once
        if (!encrypt._warned) {
            console.warn('⚠️  ENCRYPTION_KEY not set — contract data is stored unencrypted');
            encrypt._warned = true;
        }
        return plaintext;
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(stored) {
    if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
    const key = getKey();
    if (!key) {
        console.error('❌ Encrypted data found but ENCRYPTION_KEY is not set — cannot decrypt');
        return null;
    }
    try {
        const rest = stored.slice(ENC_PREFIX.length);
        const [ivHex, authTagHex, encHex] = rest.split(':');
        const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        return Buffer.concat([
            decipher.update(Buffer.from(encHex, 'hex')),
            decipher.final()
        ]).toString('utf8');
    } catch {
        console.error('❌ Failed to decrypt record — key mismatch or data corrupted');
        return null;
    }
}

module.exports = { encrypt, decrypt };

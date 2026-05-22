// backend/scripts/migratePasswords.js
//
// One-time migration: find any users whose password_hash does not look like a bcrypt
// hash (bcrypt hashes start with "$2b$") and re-hash the stored value with bcrypt cost 12.
//
// This is only useful if passwords were stored as plaintext at some point.
// If the stored value is already an MD5/SHA hash (not plaintext), re-hashing it will
// produce a bcrypt-of-hash rather than bcrypt-of-password — those users will need a
// manual password reset. The script reports them clearly.
//
// How to run safely:
//   1. Back up backend/data/lawgic.db first.
//   2. cd backend
//   3. node scripts/migratePasswords.js
//   4. Restart the server.
//
// This script is idempotent — running it twice is safe because it skips $2b$ hashes.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;
const BCRYPT_PREFIX = '$2b$';

const rawDb = process.env.DATABASE_PATH;
const dbPath = rawDb
    ? (path.isAbsolute(rawDb) ? rawDb : path.resolve(__dirname, '..', rawDb))
    : path.join(__dirname, '..', 'data', 'lawgic.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

async function migrate() {
    const users = db.prepare('SELECT id, email, password_hash FROM users').all();

    let skipped = 0;
    let migrated = 0;
    let warned = 0;

    for (const user of users) {
        const hash = user.password_hash;

        if (!hash) {
            console.warn(`  ⚠️  User ${user.email} has no password_hash — skipping`);
            warned++;
            continue;
        }

        if (hash.startsWith(BCRYPT_PREFIX)) {
            skipped++;
            continue;
        }

        // Warn if value looks like a hex hash (MD5=32 chars, SHA1=40, SHA256=64)
        if (/^[a-f0-9]{32,64}$/i.test(hash)) {
            console.warn(
                `  ⚠️  User ${user.email}: password_hash looks like a hex digest, not plaintext.\n` +
                `       bcrypt-of-hash stored — this user will need a password reset to log in.`
            );
            warned++;
        }

        const newHash = await bcrypt.hash(hash, SALT_ROUNDS);
        db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
            .run(newHash, user.id);

        console.log(`  ✅ Migrated user ${user.email}`);
        migrated++;
    }

    console.log(`\nDone. Migrated: ${migrated}, Already bcrypt: ${skipped}, Warnings: ${warned}`);
    db.close();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});

/**
 * Set each user's role in SQLite to match ADMIN_EMAILS (see config/adminAllowlist.js).
 * Run from backend folder after changing .env:
 *   npm run sync-admin-roles
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('../db/database');
const { resolveRole } = require('../config/adminAllowlist');

const rows = db.prepare('SELECT id, email, role FROM users').all();
let updated = 0;
for (const row of rows) {
    const correct = resolveRole(row.email);
    if (row.role !== correct) {
        db.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(correct, row.id);
        updated += 1;
        console.log(`${row.email}: ${row.role} → ${correct}`);
    }
}
console.log(updated ? `Done — ${updated} user(s) updated.` : 'Done — all roles already match the allowlist.');

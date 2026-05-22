/**
 * Admin access is granted only to emails listed in ADMIN_EMAILS (comma-separated, case-insensitive).
 * If ADMIN_EMAILS is unset, defaults to ahmed.youssef@gmail.com.
 */
const DEFAULT_ADMIN_EMAILS = 'ahmed.youssef@gmail.com';

function parseAdminEmailSet() {
    const raw = process.env.ADMIN_EMAILS;
    const source = raw && String(raw).trim() ? String(raw) : DEFAULT_ADMIN_EMAILS;
    const set = new Set();
    for (const part of source.split(/[,;\s]+/)) {
        const e = part.trim().toLowerCase();
        if (e.includes('@')) set.add(e);
    }
    return set;
}

function isAdminEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return parseAdminEmailSet().has(email.trim().toLowerCase());
}

function resolveRole(email) {
    return isAdminEmail(email) ? 'admin' : 'user';
}

module.exports = { isAdminEmail, resolveRole, parseAdminEmailSet };

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { encrypt, decrypt } = require('../services/encryption');
const { encryptField, decryptField } = require('../utils/dbEncryption');

const rawDb = process.env.DATABASE_PATH;
const dbPath = rawDb
    ? (path.isAbsolute(rawDb) ? rawDb : path.resolve(__dirname, '..', rawDb))
    : path.join(__dirname, '..', 'data', 'lawgic.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
            default_options TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'analyzed', 'error')),
            file_path TEXT,
            analysis_result TEXT,
            contract_type TEXT,
            uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
        CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            description TEXT,
            entity_type TEXT,
            entity_id INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at);
    `);
}

initSchema();

// Migration: add contract_type column if it doesn't exist (for existing DBs)
try {
    db.exec(`ALTER TABLE documents ADD COLUMN contract_type TEXT`);
} catch (_) { /* column already exists */ }

function getUserByEmail(email) {
    const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email.trim());
    if (row && row.full_name) row.full_name = decryptField(row.full_name);
    return row;
}

function getUserById(id) {
    const row = db.prepare('SELECT id, email, full_name, role, default_options, created_at FROM users WHERE id = ?').get(id);
    if (row && row.full_name) row.full_name = decryptField(row.full_name);
    return row;
}

function createUser({ email, passwordHash, fullName, role = 'user', defaultOptions }) {
    const opts = defaultOptions != null ? JSON.stringify(defaultOptions) : null;
    const info = db.prepare(`
        INSERT INTO users (email, password_hash, full_name, role, default_options)
        VALUES (@email, @password_hash, @full_name, @role, @default_options)
    `).run({
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName ? encryptField(fullName) : null,
        role,
        default_options: opts
    });
    return getUserById(info.lastInsertRowid);
}

function updateUserDefaults(userId, defaultOptions) {
    db.prepare(`
        UPDATE users SET default_options = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(defaultOptions), userId);
}

/** role must be 'user' | 'admin' */
function setUserRoleByEmail(email, role) {
    if (role !== 'user' && role !== 'admin') {
        throw new Error('Invalid role');
    }
    const info = db.prepare(`
        UPDATE users SET role = ?, updated_at = datetime('now') WHERE email = ? COLLATE NOCASE
    `).run(role, email.trim());
    return info.changes;
}

function updateUser(userId, { email, fullName, role, passwordHash }) {
    const updates = [];
    const values = [];
    
    if (email !== undefined) {
        updates.push('email = ?');
        values.push(email.trim().toLowerCase());
    }
    if (fullName !== undefined) {
        updates.push('full_name = ?');
        values.push(fullName ? encryptField(fullName) : null);
    }
    if (role !== undefined) {
        if (role !== 'user' && role !== 'admin') throw new Error('Invalid role');
        updates.push('role = ?');
        values.push(role);
    }
    if (passwordHash !== undefined) {
        updates.push('password_hash = ?');
        values.push(passwordHash);
    }
    
    if (updates.length === 0) return null;
    
    // Add updated_at timestamp directly to SQL (not as parameter)
    updates.push("updated_at = datetime('now')");
    values.push(userId);
    
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    const result = db.prepare(sql).run(...values);
    
    if (result.changes === 0) {
        throw new Error('User not found or no changes made');
    }
    
    return getUserById(userId);
}

function deleteUser(userId) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(userId).changes;
}

function getAllUsers() {
    const rows = db.prepare('SELECT id, email, full_name as fullName, role, created_at as createdAt FROM users ORDER BY created_at DESC').all();
    return rows.map(r => ({ ...r, fullName: r.fullName ? decryptField(r.fullName) : null }));
}

function createDocument({ filename, userId, status = 'pending', filePath }) {
    const info = db.prepare(`
        INSERT INTO documents (filename, user_id, status, file_path)
        VALUES (?, ?, ?, ?)
    `).run(filename, userId, status, filePath || null);
    return getDocumentById(info.lastInsertRowid);
}

function getDocumentById(docId) {
    const row = db.prepare(`
        SELECT
            d.id,
            d.filename,
            d.user_id as userId,
            d.status,
            d.uploaded_at as uploadedAt,
            (SELECT email FROM users WHERE id = d.user_id) as uploadedBy
        FROM documents d WHERE d.id = ?
    `).get(docId);
    return row;
}

function getAllDocuments() {
    const rows = db.prepare(`
        SELECT
            d.id,
            d.filename,
            d.user_id as userId,
            d.status,
            d.uploaded_at as uploadedAt,
            (SELECT full_name FROM users WHERE id = d.user_id) as uploadedByName,
            (SELECT email FROM users WHERE id = d.user_id) as uploadedBy
        FROM documents d ORDER BY d.uploaded_at DESC
    `).all();
    return rows.map(r => ({ ...r, uploadedByName: r.uploadedByName ? decryptField(r.uploadedByName) : null }));
}

function updateDocument(docId, { filename, status }) {
    const updates = [];
    const values = [];
    
    if (filename !== undefined) {
        updates.push('filename = ?');
        values.push(filename);
    }
    if (status !== undefined) {
        if (!['pending', 'analyzing', 'analyzed', 'error'].includes(status)) {
            throw new Error('Invalid status');
        }
        updates.push('status = ?');
        values.push(status);
    }
    
    if (updates.length === 0) return null;
    
    updates.push('updated_at = datetime("now")');
    values.push(docId);
    
    const sql = `UPDATE documents SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);
    return getDocumentById(docId);
}

function deleteDocument(docId) {
    return db.prepare('DELETE FROM documents WHERE id = ?').run(docId).changes;
}

function getDocumentsByUser(userId) {
    return db.prepare(`
        SELECT 
            id,
            filename,
            status,
            contract_type as contractType,
            uploaded_at as uploadedAt,
            updated_at as updatedAt
        FROM documents
        WHERE user_id = ?
        ORDER BY uploaded_at DESC
    `).all(userId);
}

function getDocumentWithResult(docId, userId) {
    const row = db.prepare(`
        SELECT
            id,
            filename,
            status,
            contract_type as contractType,
            analysis_result as analysisResult,
            uploaded_at as uploadedAt
        FROM documents
        WHERE id = ? AND user_id = ?
    `).get(docId, userId);
    if (row && row.analysisResult) {
        row.analysisResult = decrypt(row.analysisResult);
    }
    return row;
}

function saveAnalysisResult(docId, analysisResult, contractType) {
    const stored = encrypt(JSON.stringify(analysisResult));
    db.prepare(`
        UPDATE documents
        SET analysis_result = ?, status = 'analyzed', contract_type = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(stored, contractType, docId);
}

function logActivity(userId, action, description, entityType, entityId) {
    return db.prepare(`
        INSERT INTO activity_logs (user_id, action, description, entity_type, entity_id)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId || null, action, description || null, entityType || null, entityId || null);
}

function getRecentActivity(limit = 20) {
    const rows = db.prepare(`
        SELECT
            a.id,
            a.action,
            a.description,
            a.entity_type as entityType,
            a.entity_id as entityId,
            a.created_at as createdAt,
            u.full_name as userName,
            u.email as userEmail
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ?
    `).all(limit);
    return rows.map(r => ({ ...r, userName: r.userName ? decryptField(r.userName) : null }));
}

module.exports = {
    db,
    getUserByEmail,
    getUserById,
    createUser,
    updateUserDefaults,
    setUserRoleByEmail,
    updateUser,
    deleteUser,
    getAllUsers,
    createDocument,
    getDocumentById,
    getDocumentsByUser,
    getDocumentWithResult,
    saveAnalysisResult,
    getAllDocuments,
    updateDocument,
    deleteDocument,
    logActivity,
    getRecentActivity
};

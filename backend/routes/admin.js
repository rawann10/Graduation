const express = require('express');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/requireAdmin');
const { 
    db, 
    getUserByEmail, 
    getUserById, 
    createUser, 
    updateUser,
    deleteUser,
    getAllUsers,
    getRecentActivity,
    getAllDocuments,
    createDocument,
    updateDocument,
    deleteDocument
} = require('../db/database');

const router = express.Router();
const SALT_ROUNDS = 12;

// Get system summary stats
router.get('/summary', authenticateToken, requireAdmin, (req, res) => {
    try {
        const totalUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
        const adminUsers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
        const totalDocuments = db.prepare('SELECT COUNT(*) AS n FROM documents').get()?.n || 0;
        const analyzedDocuments = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE status = 'analyzed'").get()?.n || 0;
        
        res.json({
            totalUsers,
            adminUsers,
            standardUsers: totalUsers - adminUsers,
            totalDocuments,
            analyzedDocuments
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load summary', message: err.message });
    }
});

// Get all documents
// Get AI analysis results
router.get('/results', authenticateToken, requireAdmin, (req, res) => {
    try {
        const results = db.prepare(`
            SELECT 
                id,
                (SELECT filename FROM documents WHERE id = analysis_results.document_id) as documentName,
                risk_level as riskLevel,
                confidence_score as confidence,
                clauses_count as clausesCount,
                created_at as createdAt,
                top_clauses as topClauses
            FROM analysis_results
            ORDER BY created_at DESC
            LIMIT 20
        `).all();
        
        const parsed = (results || []).map(r => ({
            ...r,
            topClauses: r.topClauses ? JSON.parse(r.topClauses) : []
        }));
        
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load results', message: err.message });
    }
});

// Get recent activity
router.get('/activity', authenticateToken, requireAdmin, (req, res) => {
    try {
        const activities = [];
        
        // Recent user registrations
        const recentUsers = db.prepare(`
            SELECT id, email, full_name, created_at FROM users 
            ORDER BY created_at DESC LIMIT 5
        `).all();
        
        recentUsers.forEach(user => {
            activities.push({
                id: user.id,
                type: 'user_registered',
                action: 'User Registered',
                description: `${user.full_name || user.email} joined the system`,
                userName: user.full_name || user.email,
                timestamp: user.created_at,
                icon: '👤'
            });
        });

        // Recent document uploads
        try {
            const recentDocs = db.prepare(`
                SELECT 
                    d.id,
                    d.filename, 
                    d.uploaded_at,
                    (SELECT full_name FROM users WHERE id = d.user_id) as userName
                FROM documents d
                ORDER BY d.uploaded_at DESC LIMIT 5
            `).all();
            
            recentDocs.forEach(doc => {
                activities.push({
                    id: doc.id,
                    type: 'document_uploaded',
                    action: 'Document Uploaded',
                    description: `${doc.userName || 'User'} uploaded "${doc.filename}"`,
                    userName: doc.userName || 'Unknown User',
                    timestamp: doc.uploaded_at,
                    icon: '📄'
                });
            });
        } catch (e) {
            console.error('Activity docs fetch error:', e);
        }

        // Sort by timestamp, most recent first
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(activities.slice(0, 15));
    } catch (err) {
        console.error('Activity fetch error:', err);
        res.status(500).json({ error: 'Failed to load activity', message: err.message });
    }
});

// ===== USER CRUD OPERATIONS =====

// Create new user
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, password, firstName, lastName, fullName, role } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (getUserByEmail(email)) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const combinedName = fullName || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || email);
        
        const user = createUser({
            email: email.trim().toLowerCase(),
            passwordHash,
            fullName: combinedName,
            role: role === 'admin' ? 'admin' : 'user'
        });

        res.status(201).json({ message: 'User created successfully', user });
    } catch (err) {
        console.error('User creation error:', err);
        res.status(500).json({ error: 'Failed to create user', message: err.message });
    }
});

// Read all users
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
    try {
        const users = db.prepare('SELECT id, email, full_name as fullName, role, created_at as createdAt FROM users ORDER BY created_at DESC').all();
        res.json(users || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load users', message: err.message });
    }
});

// Update user
router.put('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { email, firstName, lastName, fullName, role, password } = req.body;

        const user = getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updates = {};

        // Handle full name
        if (fullName !== undefined) {
            updates.fullName = fullName;
        } else if (firstName !== undefined || lastName !== undefined) {
            const first = firstName !== undefined ? firstName : (user.fullName ? user.fullName.split(' ')[0] : '');
            const last = lastName !== undefined ? lastName : (user.fullName ? user.fullName.split(' ').slice(1).join(' ') : '');
            updates.fullName = `${first} ${last}`.trim() || null;
        }

        // Handle email
        if (email !== undefined) {
            const trimmedEmail = email.trim().toLowerCase();
            if (trimmedEmail !== user.email) {
                if (getUserByEmail(trimmedEmail)) {
                    return res.status(409).json({ error: 'Email already in use' });
                }
                updates.email = trimmedEmail;
            }
        }

        // Handle role
        if (role !== undefined && (role === 'admin' || role === 'user')) {
            updates.role = role;
        }

        // Handle password
        if (password !== undefined && password) {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }
            updates.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        }

        // Check if there are any updates
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const updated = updateUser(id, updates);
        if (!updated) {
            return res.status(404).json({ error: 'Failed to update user' });
        }

        res.json({ message: 'User updated successfully', user: updated });
    } catch (err) {
        console.error('User update error:', err);
        res.status(500).json({ error: 'Failed to update user', message: err.message });
    }
});

// Delete user
router.delete('/users/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;

        const user = getUserById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deleting yourself
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        deleteUser(id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('User delete error:', err);
        res.status(500).json({ error: 'Failed to delete user', message: err.message });
    }
});

// ===== DOCUMENT CRUD OPERATIONS =====

// Create document (simulate upload)
router.post('/documents', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { filename, userId } = req.body;
        
        if (!filename) {
            return res.status(400).json({ error: 'Filename required' });
        }

        const info = db.prepare(`
            INSERT INTO documents (filename, user_id, status, uploaded_at)
            VALUES (?, ?, 'pending', datetime('now'))
        `).run(filename, userId || req.user.id);

        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json({ message: 'Document created', document: doc });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create document', message: err.message });
    }
});

// Read all documents
router.get('/documents', authenticateToken, requireAdmin, (req, res) => {
    try {
        const documents = db.prepare(`
            SELECT 
                d.id, 
                d.filename as name, 
                d.uploaded_at as uploadedAt,
                d.status,
                d.user_id as userId,
                (SELECT email FROM users WHERE id = d.user_id) as uploadedBy
            FROM documents d
            ORDER BY d.uploaded_at DESC
        `).all();
        res.json(documents || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load documents', message: err.message });
    }
});

// Update document
router.put('/documents/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { filename, status } = req.body;

        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        let updates = [];
        let values = [];

        if (filename) {
            updates.push('filename = ?');
            values.push(filename);
        }

        if (status && ['pending', 'analyzing', 'analyzed', 'error'].includes(status)) {
            updates.push('status = ?');
            values.push(status);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);

        res.json({ message: 'Document updated', document: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update document', message: err.message });
    }
});

// Delete document
router.delete('/documents/:id', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { id } = req.params;

        const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        db.prepare('DELETE FROM documents WHERE id = ?').run(id);
        res.json({ message: 'Document deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete document', message: err.message });
    }
});

module.exports = router;

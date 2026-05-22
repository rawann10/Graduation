const express = require('express');
const bcrypt = require('bcrypt');
const { getUserByEmail, getUserById, createUser, setUserRoleByEmail } = require('../db/database');
const {
    authenticateToken,
    signToken,
    signRefreshToken,
    verifyRefreshToken,
    setRefreshCookie,
    clearRefreshCookie
} = require('../middleware/auth');
const { resolveRole } = require('../config/adminAllowlist');
const { sendWelcomeEmail } = require('../services/email');
const { authLimiter } = require('../middleware/rateLimiter');

function syncRoleFromAllowlist(email, storedRole) {
    const correct = resolveRole(email);
    if (storedRole !== correct) {
        setUserRoleByEmail(email, correct);
    }
    return correct;
}

const router = express.Router();
const SALT_ROUNDS = 12;

const defaultOptionsShape = {
    summarization: true,
    riskDetection: true,
    legalReferences: true,
    entityRecognition: true,
    clauseDetection: true,
    termExplanations: true
};

function normalizeDefaultOptions(body) {
    if (!body || typeof body.defaultOptions !== 'object' || body.defaultOptions === null) {
        return { ...defaultOptionsShape };
    }
    const o = body.defaultOptions;
    return {
        summarization: !!o.summarization,
        riskDetection: !!o.riskDetection,
        legalReferences: !!o.legalReferences,
        entityRecognition: !!o.entityRecognition,
        clauseDetection: !!o.clauseDetection,
        termExplanations: !!o.termExplanations
    };
}

function publicUser(row) {
    if (!row) return null;
    let defaultOptions = defaultOptionsShape;
    if (row.default_options) {
        try {
            defaultOptions = { ...defaultOptionsShape, ...JSON.parse(row.default_options) };
        } catch (_) {
            /* keep defaults */
        }
    }
    return {
        id: row.id,
        email: row.email,
        fullName: row.full_name || null,
        role: row.role,
        defaultOptions,
        createdAt: row.created_at
    };
}

// POST /api/auth/register
router.post('/register', authLimiter, express.json(), async (req, res) => {
    try {
        const { email, password, fullName } = req.body || {};
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (!password || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (getUserByEmail(email)) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const defaultOptions = normalizeDefaultOptions(req.body);
        const role = resolveRole(email);
        const user = createUser({
            email,
            passwordHash,
            fullName: typeof fullName === 'string' ? fullName.trim() : null,
            role,
            defaultOptions
        });

        const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
        const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });
        setRefreshCookie(res, refreshToken);

        // Fire-and-forget: never block registration if email fails
        sendWelcomeEmail(user.email, user.full_name).catch(err =>
            console.error('Welcome email failed:', err.message)
        );

        res.status(201).json({
            token: accessToken,
            user: publicUser({ ...user, default_options: JSON.stringify(defaultOptions) })
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Registration failed', message: err.message });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, express.json(), async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const row = getUserByEmail(email);
        if (!row) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        syncRoleFromAllowlist(row.email, row.role);
        const user = getUserById(row.id);
        const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
        const refreshToken = signRefreshToken({ id: user.id, email: user.email, role: user.role });
        setRefreshCookie(res, refreshToken);

        res.json({
            token: accessToken,
            user: publicUser({ ...user, default_options: row.default_options })
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed', message: err.message });
    }
});

// POST /api/auth/refresh — issue new access token from httpOnly refresh cookie
router.post('/refresh', (req, res) => {
    const token = req.cookies && req.cookies.lawgic_refresh;
    if (!token) {
        return res.status(401).json({ error: 'No refresh token' });
    }
    try {
        const decoded = verifyRefreshToken(token);
        const user = getUserById(decoded.id);
        if (!user) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'User not found' });
        }
        const accessToken = signToken({ id: user.id, email: user.email, role: user.role });
        res.json({ token: accessToken });
    } catch (err) {
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});

// POST /api/auth/logout — clear refresh cookie
router.post('/logout', (req, res) => {
    clearRefreshCookie(res);
    res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
    try {
        let user = getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        syncRoleFromAllowlist(user.email, user.role);
        user = getUserById(req.user.id);
        const payload = { user: publicUser(user) };
        // Fresh JWT if role changed (allowlist or DB updates).
        if (user.role !== req.user.role) {
            payload.token = signToken({ id: user.id, email: user.email, role: user.role });
        }
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load user', message: err.message });
    }
});

module.exports = router;

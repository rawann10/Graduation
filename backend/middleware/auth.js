// backend/middleware/auth.js

const jwt = require('jsonwebtoken');

const ACCESS_EXPIRY = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_COOKIE = 'lawgic_refresh';

function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s || s.length < 32) {
        throw new Error('JWT_SECRET must be set in .env and be at least 32 characters long');
    }
    return s;
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    try {
        const secret = getJwtSecret();
        req.user = jwt.verify(token, secret);
        next();
    } catch (e) {
        return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired token' });
    }
}

function signToken(payload) {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_EXPIRY });
}

function signRefreshToken(payload) {
    return jwt.sign({ ...payload, type: 'refresh' }, getJwtSecret(), { expiresIn: REFRESH_EXPIRY });
}

function verifyRefreshToken(token) {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.type !== 'refresh') {
        throw new Error('Not a refresh token');
    }
    return decoded;
}

function setRefreshCookie(res, token) {
    res.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Secure only in production (HTTPS)
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
    });
}

function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
}

module.exports = {
    authenticateToken,
    signToken,
    signRefreshToken,
    verifyRefreshToken,
    setRefreshCookie,
    clearRefreshCookie,
    getJwtSecret
};

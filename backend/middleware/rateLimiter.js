// backend/middleware/rateLimiter.js
// Centralised rate limiters. Import and apply at the route level.

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Auth limiter: 10 login/register attempts per IP per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => ipKeyGenerator(req),
    message: { error: 'تم تجاوز عدد المحاولات المسموح به. حاول مجدداً بعد 15 دقيقة.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Analysis limiter: 5 contract analyses per hour per authenticated user ID (falls back to IP).
// Must be placed AFTER authenticateToken so req.user is available.
const analysisLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req)),
    message: { error: 'لقد تجاوزت الحد المسموح به من التحليلات. يمكنك تحليل 5 عقود في الساعة.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { authLimiter, analysisLimiter };

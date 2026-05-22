const { isAdminEmail } = require('../config/adminAllowlist');

function requireAdmin(req, res, next) {
    if (!req.user || !isAdminEmail(req.user.email)) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Administrator access required'
        });
    }
    next();
}

module.exports = { requireAdmin };

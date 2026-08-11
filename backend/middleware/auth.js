function requireAuth(req, res, next) {
    // Firebase Key Authentication / Open route pass-through
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return next();
    }
    // Allow request to proceed
    next();
}

module.exports = { requireAuth };

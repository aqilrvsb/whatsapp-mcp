const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

// Cookie-based authentication middleware (matching Go implementation)
async function requireAuth(req, res, next) {
    try {
        // Get session token from cookie
        const sessionToken = req.cookies.session_token;
        
        if (!sessionToken) {
            console.log('No session token found in cookies');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user repository
        const db = getDB();
        const userRepo = getUserRepository(db);

        // Validate session
        const session = await userRepo.getSession(sessionToken);
        if (!session) {
            console.log('Invalid or expired session');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user details
        const user = await userRepo.getUserById(session.userId);
        if (!user) {
            console.log('User not found for session');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Attach user to request
        req.user = user;
        req.session = session;
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

// Optional auth - doesn't fail if no session
async function optionalAuth(req, res, next) {
    try {
        const sessionToken = req.cookies.session_token;
        
        if (sessionToken) {
            const db = getDB();
            const userRepo = getUserRepository(db);
            
            try {
                const session = await userRepo.getSession(sessionToken);
                if (session) {
                    const user = await userRepo.getUserById(session.userId);
                    if (user) {
                        req.user = user;
                        req.session = session;
                    }
                }
            } catch (error) {
                // Ignore errors for optional auth
            }
        }
        
        next();
    } catch (error) {
        next();
    }
}

module.exports = {
    requireAuth,
    optionalAuth
};
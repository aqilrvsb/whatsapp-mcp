const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

// Cookie-based authentication middleware (matching Go implementation)
async function requireAuth(req, res, next) {
    try {
        // Get session token from cookie
        const sessionToken = req.cookies.session_token;
        
        if (!sessionToken) {
            console.log('No session token found in cookies');
            // For API routes, return JSON error
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // For page routes, redirect to login
            return res.redirect('/login');
        }

        // Get user repository
        const db = getDB();
        const userRepo = getUserRepository(db);

        // Validate session
        const session = await userRepo.getSession(sessionToken);
        if (!session) {
            console.log('Invalid or expired session');
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return res.redirect('/login');
        }

        // Get user details
        const user = await userRepo.getUserById(session.userId);
        if (!user) {
            console.log('User not found for session');
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            return res.redirect('/login');
        }

        // Attach user to request
        req.user = user;
        req.session = session;
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
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
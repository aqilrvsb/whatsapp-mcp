const express = require('express');
const router = express.Router();
const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

// Login page
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login - WhatsApp Analytics' });
});

// Register page
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register - WhatsApp Analytics' });
});

// Handle login (matches Go implementation)
router.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Get user repository
        const db = getDB();
        const userRepo = getUserRepository(db);

        // Validate credentials
        const user = await userRepo.validatePassword(email, password);

        // Create session
        const session = await userRepo.createSession(user.id);

        // Set session cookie (matching Go implementation)
        res.cookie('session_token', session.token, {
            expires: session.expiresAt,
            httpOnly: true,
            secure: false, // Set to true in production with HTTPS
            sameSite: 'lax'
        });

        return res.json({
            status: 'success',
            message: 'Login successful',
            token: session.token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(401).json({
            error: error.message || 'Invalid credentials'
        });
    }
});
// Handle register (matches Go implementation)
router.post('/api/auth/register', async (req, res) => {
    try {
        const { fullname, email, password } = req.body;

        if (!email || !password || !fullname) {
            return res.status(400).json({
                error: 'All fields are required'
            });
        }

        // Get user repository
        const db = getDB();
        const userRepo = getUserRepository(db);

        // Create user
        const user = await userRepo.createUser(email, fullname, password);

        // Create session
        const session = await userRepo.createSession(user.id);

        // Set session cookie
        res.cookie('session_token', session.token, {
            expires: session.expiresAt,
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });

        return res.json({
            status: 'success',
            message: 'Registration successful',
            token: session.token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        
        if (error.message.includes('already exists')) {
            return res.status(409).json({
                error: 'Email already registered'
            });
        }
        
        return res.status(500).json({
            error: 'Registration failed'
        });
    }
});
// Handle logout
router.post('/api/auth/logout', async (req, res) => {
    try {
        const sessionToken = req.cookies.session_token;
        
        if (sessionToken) {
            const db = getDB();
            const userRepo = getUserRepository(db);
            await userRepo.deleteSession(sessionToken);
        }

        // Clear cookie
        res.clearCookie('session_token');
        
        return res.json({
            status: 'success',
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            error: 'Logout failed'
        });
    }
});

// Logout GET endpoint (for direct navigation)
router.get('/logout', async (req, res) => {
    try {
        const sessionToken = req.cookies.session_token;
        
        if (sessionToken) {
            const db = getDB();
            const userRepo = getUserRepository(db);
            await userRepo.deleteSession(sessionToken);
        }

        res.clearCookie('session_token');
        res.redirect('/login');
    } catch (error) {
        console.error('Logout error:', error);
        res.redirect('/login');
    }
});

// Check session
router.get('/api/auth/session', async (req, res) => {
    try {
        const sessionToken = req.cookies.session_token;
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'No session' });
        }

        const db = getDB();
        const userRepo = getUserRepository(db);
        
        const session = await userRepo.getSession(sessionToken);
        const user = await userRepo.getUserById(session.userId);
        
        return res.json({
            status: 'success',
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid session' });
    }
});

module.exports = router;
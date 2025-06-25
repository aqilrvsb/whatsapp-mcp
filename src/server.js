const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Server } = require('socket.io');
const http = require('http');

// Load environment variables
require('dotenv').config();

// Import configurations
const { connectDB } = require('./config/database');
const config = require('./config/environment');

// Import middleware
const { requireAuth, optionalAuth } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const messageRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true
    }
});

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
}));
app.use(compression());
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Global io instance
global.io = io;

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
    
    // Handle device connection requests
    socket.on('connect-device', async (data) => {
        const { deviceId } = data;
        console.log(`Device connection requested: ${deviceId}`);
        
        try {
            // Get device details to find userId
            const { getUserRepository } = require('./repository/userRepository');
            const { getDB } = require('./config/database');
            
            const db = getDB();
            const userRepo = getUserRepository(db);
            const device = await userRepo.getDevice(deviceId);
            
            if (device && global.whatsappManager) {
                await global.whatsappManager.connectDevice(deviceId, device.userId);
            }
        } catch (error) {
            console.error('Error connecting device:', error);
            socket.emit('error', { message: 'Failed to connect device' });
        }
    });
});

// Public routes (no auth required)
app.use('/', authRoutes);

// Root route - redirect to login or dashboard
app.get('/', (req, res) => {
    const sessionToken = req.cookies.session_token;
    if (sessionToken) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard', { 
        title: 'Dashboard - WhatsApp Analytics',
        user: req.user
    });
});

// API routes with auth
app.use('/api/devices', requireAuth, deviceRoutes);
app.use('/api/messages', requireAuth, messageRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/campaigns', requireAuth, require('./routes/campaigns'));

// WhatsApp app routes (login, logout, etc)
app.use('/app', requireAuth, require('./routes/whatsapp'));

// WhatsApp Web view route
app.get('/device/:id/whatsapp', requireAuth, async (req, res) => {
    try {
        const deviceId = req.params.id;
        const { getUserRepository } = require('./repository/userRepository');
        const { getDB } = require('./config/database');
        
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check if user owns this device
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        if (!owns) {
            return res.status(403).send('Access denied');
        }
        
        const device = await userRepo.getDevice(deviceId);
        if (!device) {
            return res.status(404).send('Device not found');
        }
        res.render('whatsapp', {
            title: 'WhatsApp Web - ' + device.deviceName,
            device: device,
            user: req.user
        });
    } catch (error) {
        console.error('WhatsApp Web error:', error);
        res.status(500).send('Internal server error');
    }
});

// WhatsApp Web route for device
app.get('/device/:id/whatsapp-web', requireAuth, async (req, res) => {
    try {
        const deviceId = req.params.id;
        const { getUserRepository } = require('./repository/userRepository');
        const { getDB } = require('./config/database');
        
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check if user owns this device
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        if (!owns) {
            return res.status(403).send('Access denied');
        }
        
        const device = await userRepo.getDevice(deviceId);
        if (!device) {
            return res.status(404).send('Device not found');
        }
        
        // For now, redirect to a placeholder or WhatsApp Web
        res.redirect('https://web.whatsapp.com');
    } catch (error) {
        console.error('WhatsApp Web error:', error);
        res.status(500).send('Internal server error');
    }
});

// Device action pages (Phase 2)
app.get('/device/:id/actions', requireAuth, async (req, res) => {
    const deviceId = req.params.id;
    const { getUserRepository } = require('./repository/userRepository');
    const { getDB } = require('./config/database');
    
    const db = getDB();
    const userRepo = getUserRepository(db);
    
    const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
    if (!owns) {
        return res.status(403).send('Access denied');
    }
    
    const device = await userRepo.getDevice(deviceId);
    
    res.render('device-actions', {
        title: 'Device Actions - ' + device.deviceName,
        device: device,
        user: req.user
    });
});

// Lead management page
app.get('/device/:id/leads', requireAuth, async (req, res) => {
    const deviceId = req.params.id;
    const { getUserRepository } = require('./repository/userRepository');
    const { getDB } = require('./config/database');
    
    const db = getDB();
    const userRepo = getUserRepository(db);
    
    const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
    if (!owns) {
        return res.status(403).send('Access denied');
    }
    
    const device = await userRepo.getDevice(deviceId);
    
    res.render('leads', {
        title: 'Lead Management - ' + device.deviceName,
        device: device,
        user: req.user
    });
});
// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await connectDB();
        console.log('✅ Database connected');

        // Initialize WhatsApp manager with database
        const { WhatsAppManager } = require('./whatsapp/deviceManager');
        global.whatsappManager = new WhatsAppManager(io);
        
        // Start server
        const PORT = process.env.PORT || config.app.port;
        server.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🌐 Visit http://localhost:${PORT}`);
            console.log(`👤 Default admin: admin@whatsapp.com / changeme123`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Start the application
startServer();
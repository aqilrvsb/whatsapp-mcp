const express = require('express');
const router = express.Router();
const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

// Get all devices for logged-in user
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        const devices = await userRepo.getUserDevices(req.user.id);
        res.json({
            code: 'SUCCESS',
            results: devices
        });
    } catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to get devices' 
        });
    }
});

// Add new device
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ 
                code: 'ERROR',
                message: 'Device name is required' 
            });
        }
        
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        const device = await userRepo.addUserDevice(req.user.id, name);
        res.json({
            success: true,
            device: device
        });
    } catch (error) {
        console.error('Error adding device:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to add device' 
        });
    }
});

// Get device by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, id);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const device = await userRepo.getDevice(id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        res.json(device);
    } catch (error) {
        console.error('Error getting device:', error);
        res.status(500).json({ error: 'Failed to get device' });
    }
});
// Delete device
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, id);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Disconnect WhatsApp if connected
        if (global.whatsappManager) {
            await global.whatsappManager.disconnectDevice(id);
        }
        
        // Delete from database
        await userRepo.deleteDevice(id);
        
        res.json({ 
            code: 'SUCCESS',
            message: 'Device deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

// Get QR code for device
router.get('/:id/qr', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, id);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const device = await userRepo.getDevice(id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Generate QR code page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Connect ${device.deviceName}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        background-color: #f0f2f5;
                    }
                    .qr-container {
                        background: white;
                        padding: 40px;
                        border-radius: 16px;
                        box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                        text-align: center;
                        max-width: 500px;
                    }
                    #qrcode {
                        width: 300px;
                        height: 300px;
                        margin: 20px auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    #qrcode img {
                        max-width: 100%;
                        height: auto;
                    }
                    .error-message {
                        color: #dc3545;
                        margin-top: 10px;
                    }
                    .success-message {
                        color: #28a745;
                        margin-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="qr-container">
                    <h3>Connect ${device.deviceName}</h3>
                    <p>Scan this QR code with WhatsApp</p>
                    <div id="qrcode">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                    <div id="status-message"></div>
                    <p class="text-muted mt-3">Open WhatsApp > Settings > Linked Devices > Link a Device</p>
                    <a href="/dashboard" class="btn btn-secondary mt-3">Back to Dashboard</a>
                </div>
                
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    const deviceId = '${device.id}';
                    let qrReceived = false;
                    
                    socket.emit('connect-device', { deviceId });
                    
                    socket.on('qr', (data) => {
                        if (data.deviceId === deviceId && data.qr) {
                            qrReceived = true;
                            const qrContainer = document.getElementById('qrcode');
                            
                            // If it's a data URL, display as image
                            if (data.qr.startsWith('data:image')) {
                                qrContainer.innerHTML = '<img src="' + data.qr + '" alt="WhatsApp QR Code">';
                            } else {
                                // Fallback to generating canvas from raw QR
                                qrContainer.innerHTML = '<canvas id="qr-canvas"></canvas>';
                                const QRCode = window.QRCode;
                                if (QRCode) {
                                    QRCode.toCanvas(document.getElementById('qr-canvas'), data.rawQr || data.qr, {
                                        width: 300,
                                        margin: 2
                                    });
                                }
                            }
                        }
                    });
                    
                    socket.on('device-connected', (data) => {
                        if (data.deviceId === deviceId) {
                            document.getElementById('status-message').innerHTML = 
                                '<div class="success-message">Device connected successfully! Redirecting...</div>';
                            setTimeout(() => {
                                window.location.href = '/dashboard';
                            }, 2000);
                        }
                    });
                    
                    socket.on('qr-timeout', (data) => {
                        if (data.deviceId === deviceId) {
                            document.getElementById('qrcode').innerHTML = 
                                '<div class="text-danger">QR code expired. Please refresh the page.</div>';
                            document.getElementById('status-message').innerHTML = 
                                '<div class="error-message">Connection timeout. Please try again.</div>';
                        }
                    });
                    
                    socket.on('connection-error', (data) => {
                        if (data.deviceId === deviceId) {
                            document.getElementById('status-message').innerHTML = 
                                '<div class="error-message">Connection error: ' + (data.error || 'Unknown error') + '</div>';
                        }
                    });
                    
                    // Check if QR received after 5 seconds
                    setTimeout(() => {
                        if (!qrReceived) {
                            document.getElementById('status-message').innerHTML = 
                                '<div class="error-message">No QR code received. Please check the server logs.</div>';
                        }
                    }, 5000);
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Error showing QR:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Update device phone
router.put('/:id/phone', async (req, res) => {
    try {
        const { id } = req.params;
        const { phone } = req.body;        
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, id);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await userRepo.updateDevicePhone(id, phone);
        res.json({ message: 'Phone number updated' });
    } catch (error) {
        console.error('Error updating phone:', error);
        res.status(500).json({ error: 'Failed to update phone' });
    }
});

// Get QR code status (API endpoint)
router.get('/:id/qr-status', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, id);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get QR code from WhatsApp manager
        if (global.whatsappManager) {
            const qr = global.whatsappManager.getQRCode(id);
            if (qr) {
                return res.json({ 
                    status: 'pending',
                    qr: qr 
                });
            }
        }
        
        // Check if device is connected
        const device = await userRepo.getDevice(id);
        if (device.status === 'online') {
            return res.json({ status: 'connected' });
        }
        
        res.json({ status: 'disconnected' });
    } catch (error) {
        console.error('Error getting QR status:', error);
        res.status(500).json({ error: 'Failed to get QR status' });
    }
});

// Logout device
router.post('/:id/logout', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, id);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Disconnect WhatsApp
        if (global.whatsappManager) {
            await global.whatsappManager.disconnectDevice(id);
        }
        
        // Update status
        await userRepo.updateDeviceStatus(id, 'offline');
        
        res.json({ message: 'Device logged out successfully' });
    } catch (error) {
        console.error('Error logging out device:', error);
        res.status(500).json({ error: 'Failed to logout device' });
    }
});

module.exports = router;
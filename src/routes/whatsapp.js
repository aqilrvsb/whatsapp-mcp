const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const QRCode = require('qrcode');

// Login with QR code
router.get('/login', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        if (!deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID is required'
            });
        }
        
        // Check if device is already being connected
        if (global.whatsappManager) {
            const session = global.whatsappManager.sessions.get(deviceId);
            
            if (session && session.qr) {
                // Generate QR code image from the QR string
                const qrImageUrl = await QRCode.toDataURL(session.qr);
                
                res.json({
                    code: 'SUCCESS',
                    results: {
                        qr_link: qrImageUrl,
                        qr_data: session.qr
                    }
                });
            } else {
                // Start connection to get QR
                await global.whatsappManager.connectDevice(deviceId, req.user.id);
                
                // Wait a bit for QR to be generated
                setTimeout(async () => {
                    const newSession = global.whatsappManager.sessions.get(deviceId);
                    if (newSession && newSession.qr) {
                        const qrImageUrl = await QRCode.toDataURL(newSession.qr);
                        res.json({
                            code: 'SUCCESS',
                            results: {
                                qr_link: qrImageUrl,
                                qr_data: newSession.qr
                            }
                        });
                    } else {
                        res.json({
                            code: 'PENDING',
                            message: 'Generating QR code, please wait...'
                        });
                    }
                }, 2000);
            }
        } else {
            res.status(500).json({
                code: 'ERROR',
                message: 'WhatsApp manager not initialized'
            });
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to generate QR code: ' + error.message
        });
    }
});

// Login with phone code
router.get('/login-with-code', async (req, res) => {
    try {
        const { phone } = req.query;
        
        if (!phone) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Phone number is required'
            });
        }
        
        // For pairing code, we need to use a different method
        // This is not yet implemented in Baileys
        res.json({
            code: 'ERROR',
            message: 'Phone pairing is not yet supported. Please use QR code instead.'
        });
    } catch (error) {
        console.error('Error generating pair code:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to generate pair code' 
        });
    }
});

// Logout device
router.get('/logout', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        if (!deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID is required'
            });
        }
        
        if (global.whatsappManager) {
            await global.whatsappManager.disconnectDevice(deviceId);
            
            res.json({
                code: 'SUCCESS',
                message: 'Device logged out successfully'
            });
        } else {
            res.status(500).json({
                code: 'ERROR',
                message: 'WhatsApp manager not initialized'
            });
        }
    } catch (error) {
        console.error('Error logging out device:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to logout device' 
        });
    }
});

// Link device with phone number
router.post('/link-device', async (req, res) => {
    try {
        const { device_id, phone } = req.body;
        
        if (!device_id || !phone) {
            return res.status(400).json({
                status: 'error',
                error: 'Device ID and phone number are required'
            });
        }
        
        // Update device phone in database
        const db = getDB();
        await db.none(
            'UPDATE user_devices SET phone = $1 WHERE id = $2',
            [phone, device_id]
        );
        
        res.json({
            status: 'success',
            message: 'Phone number linked successfully'
        });
    } catch (error) {
        console.error('Error linking device:', error);
        res.status(500).json({ 
            status: 'error',
            error: 'Failed to link device' 
        });
    }
});

module.exports = router;
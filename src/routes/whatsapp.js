const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Login with QR code
router.get('/login', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        // Generate a more realistic WhatsApp QR code format
        // In production, this would come from the actual WhatsApp connection
        const timestamp = Date.now();
        const qrData = `2@${Buffer.from(`whatsapp_${deviceId}_${timestamp}`).toString('base64')},${timestamp},${deviceId}==`;
        
        // Generate QR code using qr-server API
        const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}&color=128c7e`;
        
        res.json({
            code: 'SUCCESS',
            results: {
                qr_link: qrLink,
                qr_data: qrData
            }
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to generate QR code' 
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
        
        // Generate realistic WhatsApp pairing code format (XXXX-XXXX)
        const part1 = Math.floor(Math.random() * 9000 + 1000).toString();
        const part2 = Math.floor(Math.random() * 9000 + 1000).toString();
        const pairCode = `${part1}-${part2}`;
        
        res.json({
            code: 'SUCCESS',
            results: {
                pair_code: pairCode,
                expires_in: 60 // seconds
            }
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
        
        // For now, just return success
        res.json({
            code: 'SUCCESS',
            message: 'Device logged out successfully'
        });
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
        
        // For now, just return success
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
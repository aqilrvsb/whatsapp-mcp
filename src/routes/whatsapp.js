const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Login with QR code
router.get('/login', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        // Generate mock QR code for now
        const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=WhatsApp_Device_${deviceId}_${Date.now()}`;
        
        res.json({
            code: 'SUCCESS',
            results: {
                qr_link: qrLink
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
        
        // Generate mock pairing code
        const pairCode = Math.random().toString().substr(2, 8);
        
        res.json({
            code: 'SUCCESS',
            results: {
                pair_code: pairCode
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
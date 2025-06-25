const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { requireAuth } = require('./auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// List user devices
router.get('/', async (req, res) => {
    const db = getDB();
    
    try {
        const result = await db.query(
            'SELECT id, device_name, phone, jid, status, last_seen, created_at FROM user_devices WHERE user_id = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        
        res.json({
            success: true,
            devices: result.rows
        });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Get device details
router.get('/:id', async (req, res) => {
    const db = getDB();
    const deviceId = req.params.id;
    
    try {
        const result = await db.query(
            'SELECT * FROM user_devices WHERE id = $1 AND user_id = $2',
            [deviceId, req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        res.json({
            success: true,
            device: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching device:', error);
        res.status(500).json({ error: 'Failed to fetch device' });
    }
});

// Create new device
router.post('/', async (req, res) => {
    const { deviceName } = req.body;
    
    if (!deviceName) {
        return res.status(400).json({ error: 'Device name is required' });
    }
    
    const db = getDB();
    
    try {
        const result = await db.query(
            'INSERT INTO user_devices (user_id, device_name) VALUES ($1, $2) RETURNING *',
            [req.session.userId, deviceName]
        );
        
        const device = result.rows[0];
        
        res.json({
            success: true,
            device: device
        });
    } catch (error) {
        console.error('Error creating device:', error);
        res.status(500).json({ error: 'Failed to create device' });
    }
});

// Update device
router.put('/:id', async (req, res) => {
    const db = getDB();
    const deviceId = req.params.id;
    const { deviceName } = req.body;
    
    try {
        const result = await db.query(
            'UPDATE user_devices SET device_name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [deviceName, deviceId, req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        res.json({
            success: true,
            device: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating device:', error);
        res.status(500).json({ error: 'Failed to update device' });
    }
});

// Delete device
router.delete('/:id', async (req, res) => {
    const db = getDB();
    const deviceId = req.params.id;
    const whatsappManager = req.whatsappManager;
    
    try {
        // Disconnect WhatsApp if connected
        await whatsappManager.disconnectDevice(deviceId);
        
        // Delete from database
        const result = await db.query(
            'DELETE FROM user_devices WHERE id = $1 AND user_id = $2 RETURNING id',
            [deviceId, req.session.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        res.json({
            success: true,
            message: 'Device deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

// Get QR code for device
router.get('/:id/qr', async (req, res) => {
    const deviceId = req.params.id;
    const whatsappManager = req.whatsappManager;
    
    try {
        // Verify device ownership
        const db = getDB();
        const device = await db.query(
            'SELECT id FROM user_devices WHERE id = $1 AND user_id = $2',
            [deviceId, req.session.userId]
        );
        
        if (device.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Connect device
        await whatsappManager.connectDevice(deviceId, req.session.userId);
        
        // Get QR code
        const connection = whatsappManager.getConnection(deviceId);
        
        res.json({
            success: true,
            qr: connection?.qr || null,
            status: connection?.isConnected ? 'connected' : 'waiting'
        });
    } catch (error) {
        console.error('Error getting QR code:', error);
        res.status(500).json({ error: 'Failed to get QR code' });
    }
});

// Logout device
router.post('/:id/logout', async (req, res) => {
    const deviceId = req.params.id;
    const whatsappManager = req.whatsappManager;
    
    try {
        // Verify device ownership
        const db = getDB();
        const device = await db.query(
            'SELECT id FROM user_devices WHERE id = $1 AND user_id = $2',
            [deviceId, req.session.userId]
        );
        
        if (device.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Disconnect device
        await whatsappManager.disconnectDevice(deviceId);
        
        res.json({
            success: true,
            message: 'Device logged out successfully'
        });
    } catch (error) {
        console.error('Error logging out device:', error);
        res.status(500).json({ error: 'Failed to logout device' });
    }
});

// Get device chats
router.get('/:id/chats', async (req, res) => {
    const deviceId = req.params.id;
    const whatsappManager = req.whatsappManager;
    
    try {
        // Verify device ownership
        const db = getDB();
        const device = await db.query(
            'SELECT id FROM user_devices WHERE id = $1 AND user_id = $2',
            [deviceId, req.session.userId]
        );
        
        if (device.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Get chats
        const chats = await whatsappManager.getChats(deviceId);
        
        res.json({
            success: true,
            chats: chats
        });
    } catch (error) {
        console.error('Error getting chats:', error);
        res.status(500).json({ error: error.message || 'Failed to get chats' });
    }
});

// Get device contacts
router.get('/:id/contacts', async (req, res) => {
    const deviceId = req.params.id;
    const whatsappManager = req.whatsappManager;
    
    try {
        // Verify device ownership
        const db = getDB();
        const device = await db.query(
            'SELECT id FROM user_devices WHERE id = $1 AND user_id = $2',
            [deviceId, req.session.userId]
        );
        
        if (device.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Get contacts
        const contacts = await whatsappManager.getContacts(deviceId);
        
        res.json({
            success: true,
            contacts: contacts
        });
    } catch (error) {
        console.error('Error getting contacts:', error);
        res.status(500).json({ error: error.message || 'Failed to get contacts' });
    }
});

module.exports = router;

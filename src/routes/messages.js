const express = require('express');
const router = express.Router();
const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

// Get chats for a device
router.get('/:deviceId/chats', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get chats from WhatsApp manager
        if (global.whatsappManager) {
            const chats = await global.whatsappManager.getChats(deviceId);
            res.json(chats);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error getting chats:', error);
        res.status(500).json({ error: error.message || 'Failed to get chats' });
    }
});

// Send message
router.post('/:deviceId/send', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { to, message } = req.body;
        
        if (!to || !message) {
            return res.status(400).json({ error: 'To and message are required' });
        }
        
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Check ownership
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        if (!owns) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Send message
        if (global.whatsappManager) {
            await global.whatsappManager.sendMessage(deviceId, to, message);
            res.json({ success: true, message: 'Message sent' });
        } else {
            res.status(500).json({ error: 'WhatsApp manager not available' });
        }
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

module.exports = router;
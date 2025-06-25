const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const { getUserRepository } = require('../repository/userRepository');

// Send text message
router.post('/send/message', async (req, res) => {
    try {
        const { phone, message, deviceId } = req.body;
        
        if (!phone || !message || !deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Phone, message, and deviceId are required'
            });
        }
        
        // Check device ownership
        const db = getDB();
        const userRepo = getUserRepository(db);
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        
        if (!owns) {
            return res.status(403).json({
                code: 'ERROR',
                message: 'Access denied'
            });
        }
        
        // Send message using WhatsApp manager
        if (global.whatsappManager) {
            const result = await global.whatsappManager.sendMessage(deviceId, phone, message);
            
            res.json({
                code: 'SUCCESS',
                message: 'Message sent successfully',
                results: {
                    phone: phone,
                    message: message,
                    status: 'sent'
                }
            });
        } else {
            throw new Error('WhatsApp manager not initialized');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to send message'
        });
    }
});

// Send image
router.post('/send/image', async (req, res) => {
    try {
        const { phone, caption, imageUrl, deviceId } = req.body;
        
        if (!phone || !imageUrl || !deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Phone, imageUrl, and deviceId are required'
            });
        }
        
        // Check device ownership
        const db = getDB();
        const userRepo = getUserRepository(db);
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        
        if (!owns) {
            return res.status(403).json({
                code: 'ERROR',
                message: 'Access denied'
            });
        }
        
        // Send image using WhatsApp manager
        if (global.whatsappManager) {
            const client = global.whatsappManager.getClient(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }
            
            const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            await client.sendMessage(jid, {
                image: { url: imageUrl },
                caption: caption || ''
            });
            
            res.json({
                code: 'SUCCESS',
                message: 'Image sent successfully',
                results: {
                    phone: phone,
                    imageUrl: imageUrl,
                    caption: caption,
                    status: 'sent'
                }
            });
        } else {
            throw new Error('WhatsApp manager not initialized');
        }
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to send image'
        });
    }
});

// Send broadcast message
router.post('/send/broadcast', async (req, res) => {
    try {
        const { phones, message, deviceId } = req.body;
        
        if (!phones || !Array.isArray(phones) || phones.length === 0 || !message || !deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Phones array, message, and deviceId are required'
            });
        }
        
        // Check device ownership
        const db = getDB();
        const userRepo = getUserRepository(db);
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        
        if (!owns) {
            return res.status(403).json({
                code: 'ERROR',
                message: 'Access denied'
            });
        }
        
        // Send broadcast using WhatsApp manager
        if (global.whatsappManager) {
            const client = global.whatsappManager.getClient(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }
            
            const results = [];
            for (const phone of phones) {
                try {
                    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                    await client.sendMessage(jid, { text: message });
                    results.push({ phone, status: 'sent' });
                    
                    // Add delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (err) {
                    results.push({ phone, status: 'failed', error: err.message });
                }
            }
            
            res.json({
                code: 'SUCCESS',
                message: 'Broadcast completed',
                results: {
                    total: phones.length,
                    sent: results.filter(r => r.status === 'sent').length,
                    failed: results.filter(r => r.status === 'failed').length,
                    details: results
                }
            });
        } else {
            throw new Error('WhatsApp manager not initialized');
        }
    } catch (error) {
        console.error('Error sending broadcast:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to send broadcast'
        });
    }
});

// Check if number is on WhatsApp
router.post('/check/number', async (req, res) => {
    try {
        const { phone, deviceId } = req.body;
        
        if (!phone || !deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Phone and deviceId are required'
            });
        }
        
        // Check device ownership
        const db = getDB();
        const userRepo = getUserRepository(db);
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        
        if (!owns) {
            return res.status(403).json({
                code: 'ERROR',
                message: 'Access denied'
            });
        }
        
        // Check number using WhatsApp manager
        if (global.whatsappManager) {
            const client = global.whatsappManager.getClient(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }
            
            const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
            const [exists] = await client.onWhatsApp(jid);
            
            res.json({
                code: 'SUCCESS',
                message: exists ? 'Number is on WhatsApp' : 'Number not on WhatsApp',
                results: {
                    phone: phone,
                    exists: exists ? true : false,
                    jid: exists ? exists.jid : null
                }
            });
        } else {
            throw new Error('WhatsApp manager not initialized');
        }
    } catch (error) {
        console.error('Error checking number:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to check number'
        });
    }
});

// Get device chats
router.get('/chats/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        // Check device ownership
        const db = getDB();
        const userRepo = getUserRepository(db);
        const owns = await userRepo.userOwnsDevice(req.user.id, deviceId);
        
        if (!owns) {
            return res.status(403).json({
                code: 'ERROR',
                message: 'Access denied'
            });
        }
        
        // Get chats using WhatsApp manager
        if (global.whatsappManager) {
            const chats = await global.whatsappManager.getChats(deviceId);
            
            res.json({
                code: 'SUCCESS',
                message: 'Chats retrieved successfully',
                results: chats
            });
        } else {
            throw new Error('WhatsApp manager not initialized');
        }
    } catch (error) {
        console.error('Error getting chats:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to get chats'
        });
    }
});

module.exports = router;
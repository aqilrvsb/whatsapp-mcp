const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Send text message
router.post('/send/message', async (req, res) => {
    try {
        const { deviceId, phone, message } = req.body;
        
        if (!deviceId || !phone || !message) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID, phone number, and message are required'
            });
        }
        
        // Get WhatsApp client
        if (!global.whatsappManager) {
            return res.status(500).json({
                code: 'ERROR',
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device not connected. Please connect device first.'
            });
        }
        
        // Format phone number
        const formattedPhone = phone.replace(/\D/g, '');
        const jid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;
        
        // Send message using Baileys
        await client.sendMessage(jid, { text: message });
        
        res.json({
            code: 'SUCCESS',
            message: 'Message sent successfully',
            results: {
                phone: phone,
                message: message
            }
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to send message'
        });
    }
});

// Send image with caption
router.post('/send/image', async (req, res) => {
    try {
        const { deviceId, phone, imageUrl, caption } = req.body;
        
        if (!deviceId || !phone || !imageUrl) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID, phone number, and image are required'
            });
        }
        
        // Get WhatsApp client
        if (!global.whatsappManager) {
            return res.status(500).json({
                code: 'ERROR',
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device not connected. Please connect device first.'
            });
        }
        
        // Format phone number
        const formattedPhone = phone.replace(/\D/g, '');
        const jid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;
        
        // Handle base64 image
        let imageBuffer;
        if (imageUrl.startsWith('data:image')) {
            // Extract base64 data
            const base64Data = imageUrl.split(',')[1];
            imageBuffer = Buffer.from(base64Data, 'base64');
        } else if (imageUrl.startsWith('http')) {
            // For URL images, Baileys will handle it
            imageBuffer = { url: imageUrl };
        } else {
            // Assume it's already base64
            imageBuffer = Buffer.from(imageUrl, 'base64');
        }
        
        // Send image using Baileys
        const messageOptions = {
            image: imageBuffer instanceof Buffer ? imageBuffer : imageBuffer,
            caption: caption || ''
        };
        
        await client.sendMessage(jid, messageOptions);
        
        res.json({
            code: 'SUCCESS',
            message: 'Image sent successfully',
            results: {
                phone: phone,
                caption: caption
            }
        });
        
    } catch (error) {
        console.error('Error sending image:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to send image'
        });
    }
});

// Check if number is on WhatsApp
router.post('/check/number', async (req, res) => {
    try {
        const { deviceId, phone } = req.body;
        
        if (!deviceId || !phone) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID and phone number are required'
            });
        }
        
        // Get WhatsApp client
        if (!global.whatsappManager) {
            return res.status(500).json({
                code: 'ERROR',
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device not connected. Please connect device first.'
            });
        }
        
        // Format phone number
        const formattedPhone = phone.replace(/\D/g, '');
        const jid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;
        
        // Check if number exists on WhatsApp
        const [result] = await client.onWhatsApp(jid);
        
        res.json({
            code: 'SUCCESS',
            message: 'Number checked successfully',
            results: {
                phone: phone,
                exists: result?.exists || false,
                jid: result?.jid || jid
            }
        });
        
    } catch (error) {
        console.error('Error checking number:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to check number'
        });
    }
});

// Send broadcast message
router.post('/send/broadcast', async (req, res) => {
    try {
        const { deviceId, phones, message, imageUrl } = req.body;
        
        if (!deviceId || !phones || !Array.isArray(phones) || phones.length === 0 || !message) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID, phone numbers array, and message are required'
            });
        }
        
        // Get WhatsApp client
        if (!global.whatsappManager) {
            return res.status(500).json({
                code: 'ERROR',
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device not connected. Please connect device first.'
            });
        }
        
        let sent = 0;
        let failed = 0;
        const results = [];
        
        // Send to each number
        for (const phone of phones) {
            try {
                // Format phone number
                const formattedPhone = phone.replace(/\D/g, '');
                const jid = formattedPhone.includes('@') ? formattedPhone : `${formattedPhone}@s.whatsapp.net`;
                
                // Check if number exists
                const [exists] = await client.onWhatsApp(jid);
                if (!exists?.exists) {
                    failed++;
                    results.push({ phone, status: 'failed', reason: 'Number not on WhatsApp' });
                    continue;
                }
                
                // Send message
                if (imageUrl) {
                    // Send image with caption
                    let imageBuffer;
                    if (imageUrl.startsWith('data:image')) {
                        const base64Data = imageUrl.split(',')[1];
                        imageBuffer = Buffer.from(base64Data, 'base64');
                    } else {
                        imageBuffer = { url: imageUrl };
                    }
                    
                    await client.sendMessage(jid, {
                        image: imageBuffer,
                        caption: message
                    });
                } else {
                    // Send text only
                    await client.sendMessage(jid, { text: message });
                }
                
                sent++;
                results.push({ phone, status: 'sent' });
                
                // Small delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to send to ${phone}:`, error);
                failed++;
                results.push({ phone, status: 'failed', reason: error.message });
            }
        }
        
        res.json({
            code: 'SUCCESS',
            message: 'Broadcast completed',
            results: {
                total: phones.length,
                sent: sent,
                failed: failed,
                details: results
            }
        });
        
    } catch (error) {
        console.error('Error sending broadcast:', error);
        res.status(500).json({
            code: 'ERROR',
            message: error.message || 'Failed to send broadcast'
        });
    }
});

// Get chats for WhatsApp Web view
router.get('/chats', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        if (!deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID is required'
            });
        }
        
        if (!global.whatsappManager) {
            return res.json({
                code: 'SUCCESS',
                results: [],
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client || !client.user) {
            return res.json({
                code: 'SUCCESS',
                results: [],
                message: 'Device not connected'
            });
        }
        
        try {
            // Use the deviceManager's getChats method
            const chats = await global.whatsappManager.getChats(deviceId);
            
            res.json({
                code: 'SUCCESS',
                results: chats
            });
        } catch (error) {
            console.error('Error processing chats:', error);
            res.json({
                code: 'SUCCESS',
                results: [],
                message: 'Error loading chats: ' + error.message
            });
        }
        
    } catch (error) {
        console.error('Error getting chats:', error);
        res.json({
            code: 'ERROR',
            message: error.message || 'Failed to get chats',
            results: []
        });
    }
});

// Get contacts
router.get('/contacts', async (req, res) => {
    try {
        const { deviceId } = req.query;
        
        if (!deviceId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID is required'
            });
        }
        
        if (!global.whatsappManager) {
            return res.json({
                code: 'SUCCESS',
                results: [],
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client || !client.user) {
            return res.json({
                code: 'SUCCESS',
                results: [],
                message: 'Device not connected'
            });
        }
        
        try {
            // Get contacts from PostgreSQL database
            const db = require('../config/database').getDB();
            
            // Get all personal chats (which are essentially contacts with chat history)
            const contacts = await db.any(`
                SELECT DISTINCT
                    chat_jid as id,
                    chat_name as name,
                    SUBSTRING(chat_jid FROM 1 FOR POSITION('@' IN chat_jid) - 1) as phone,
                    avatar_url as profilePicture,
                    last_message_time
                FROM whatsapp_chats
                WHERE device_id = $1 
                AND is_group = false
                AND chat_jid LIKE '%@s.whatsapp.net'
                ORDER BY chat_name ASC
            `, [deviceId]);
            
            // Format contacts
            const formattedContacts = contacts.map(contact => ({
                id: contact.id,
                name: contact.name || contact.phone,
                phone: contact.phone,
                isMyContact: true,
                profilePicture: contact.profilePicture || null,
                hasChat: true,
                lastSeen: contact.last_message_time ? contact.last_message_time.toISOString() : null
            }));
            
            res.json({
                code: 'SUCCESS',
                results: formattedContacts
            });
        } catch (error) {
            console.error('Error processing contacts:', error);
            res.json({
                code: 'SUCCESS',
                results: [],
                message: 'Error loading contacts: ' + error.message
            });
        }
        
    } catch (error) {
        console.error('Error getting contacts:', error);
        res.json({
            code: 'ERROR',
            message: error.message || 'Failed to get contacts',
            results: []
        });
    }
});

// Get messages for a chat
router.get('/messages/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { deviceId } = req.query;
        
        if (!deviceId || !chatId) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Device ID and Chat ID are required'
            });
        }
        
        if (!global.whatsappManager) {
            return res.json({
                code: 'SUCCESS',
                results: [],
                message: 'WhatsApp manager not initialized'
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        if (!client || !client.user) {
            return res.json({
                code: 'SUCCESS',
                results: [],
                message: 'Device not connected'
            });
        }
        
        try {
            // Load messages for the chat
            const messages = await client.store?.messages?.[chatId]?.array || [];
            
            // Format messages
            const formattedMessages = messages
                .slice(-50) // Get last 50 messages
                .map(msg => ({
                    id: msg.key.id,
                    fromMe: msg.key.fromMe,
                    message: msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            msg.message?.imageMessage?.caption ||
                            msg.message?.videoMessage?.caption ||
                            '[Media]',
                    timestamp: msg.messageTimestamp,
                    status: msg.status
                }));
            
            res.json({
                code: 'SUCCESS',
                results: formattedMessages
            });
        } catch (error) {
            console.error('Error loading messages:', error);
            res.json({
                code: 'SUCCESS',
                results: [],
                message: 'Messages not available'
            });
        }
        
    } catch (error) {
        console.error('Error getting messages:', error);
        res.json({
            code: 'ERROR',
            message: error.message || 'Failed to get messages',
            results: []
        });
    }
});

module.exports = router;

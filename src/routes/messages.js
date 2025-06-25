const express = require('express');
const { getDB } = require('../config/database');
const { requireAuth } = require('./auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Get messages from a chat
router.get('/:deviceId/chat/:chatId', async (req, res) => {
    const { deviceId, chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
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
        
        // Get messages
        const messages = await whatsappManager.getMessages(deviceId, chatId, limit);
        
        res.json({
            success: true,
            messages: messages
        });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: error.message || 'Failed to get messages' });
    }
});

// Send a message
router.post('/:deviceId/send', async (req, res) => {
    const { deviceId } = req.params;
    const { to, message, options } = req.body;
    const whatsappManager = req.whatsappManager;
    
    if (!to || !message) {
        return res.status(400).json({ error: 'Recipient and message are required' });
    }
    
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
        
        // Send message
        const result = await whatsappManager.sendMessage(deviceId, to, message, options);
        
        res.json({
            success: true,
            messageId: result.key.id,
            status: result.status
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

// Send bulk messages (broadcast)
router.post('/:deviceId/broadcast', async (req, res) => {
    const { deviceId } = req.params;
    const { recipients, message, options, campaignName } = req.body;
    const whatsappManager = req.whatsappManager;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'Recipients array is required' });
    }
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
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
        
        // Create campaign record
        const campaign = await db.query(
            `INSERT INTO campaigns (user_id, name, message, recipients_count, status) 
             VALUES ($1, $2, $3, $4, 'running') RETURNING id`,
            [req.session.userId, campaignName || 'Broadcast', message, recipients.length]
        );
        
        const campaignId = campaign.rows[0].id;
        
        // Send messages with rate limiting
        const results = [];
        let successCount = 0;
        let failedCount = 0;
        
        for (const recipient of recipients) {
            try {
                // Add delay to prevent rate limiting (3-5 seconds between messages)
                if (results.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
                }
                
                const result = await whatsappManager.sendMessage(deviceId, recipient, message, options);
                
                results.push({
                    recipient,
                    success: true,
                    messageId: result.key.id
                });
                
                successCount++;
                
                // Record in campaign recipients
                await db.query(
                    `INSERT INTO campaign_recipients (campaign_id, phone, device_id, status, sent_at) 
                     VALUES ($1, $2, $3, 'sent', NOW())`,
                    [campaignId, recipient, deviceId]
                );
                
            } catch (error) {
                results.push({
                    recipient,
                    success: false,
                    error: error.message
                });
                
                failedCount++;
                
                // Record failure
                await db.query(
                    `INSERT INTO campaign_recipients (campaign_id, phone, device_id, status, error_message) 
                     VALUES ($1, $2, $3, 'failed', $4)`,
                    [campaignId, recipient, deviceId, error.message]
                );
            }
            
            // Update campaign progress
            await db.query(
                `UPDATE campaigns SET sent_count = $1, failed_count = $2 WHERE id = $3`,
                [successCount, failedCount, campaignId]
            );
            
            // Send progress update via socket
            req.io.to(`user-${req.session.userId}`).emit('broadcast-progress', {
                campaignId,
                total: recipients.length,
                sent: successCount,
                failed: failedCount,
                current: results.length
            });
        }
        
        // Update campaign status
        await db.query(
            `UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1`,
            [campaignId]
        );
        
        res.json({
            success: true,
            campaignId,
            total: recipients.length,
            sent: successCount,
            failed: failedCount,
            results: results
        });
        
    } catch (error) {
        console.error('Error in broadcast:', error);
        res.status(500).json({ error: error.message || 'Broadcast failed' });
    }
});

module.exports = router;

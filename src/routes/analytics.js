const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Get dashboard analytics
router.get('/dashboard', async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        
        // Get basic analytics (simplified for now)
        const analytics = {
            messagesSent: 0,
            messagesReceived: 0,
            activeChats: 0,
            totalDevices: 0,
            activeDevices: 0
        };
        
        // Get device count
        const deviceResult = await db.one(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'online' THEN 1 END) as active
             FROM user_devices 
             WHERE user_id = $1`,
            [userId]
        );
        
        analytics.totalDevices = parseInt(deviceResult.total);
        analytics.activeDevices = parseInt(deviceResult.active);
        
        // Get message analytics if table exists
        try {
            const messageResult = await db.oneOrNone(
                `SELECT 
                    COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) as sent,
                    COALESCE(SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END), 0) as received
                 FROM message_analytics
                 WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
                [userId]
            );
            
            if (messageResult) {
                analytics.messagesSent = parseInt(messageResult.sent);
                analytics.messagesReceived = parseInt(messageResult.received);
            }
        } catch (error) {
            // Table might not exist yet
            console.log('Message analytics table not available');
        }
        
        res.json(analytics);
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// Get analytics by time range
router.get('/range/:range', async (req, res) => {
    try {
        const { range } = req.params;
        const userId = req.user.id;
        
        // TODO: Implement time-based analytics
        res.json({
            range,
            data: []
        });
    } catch (error) {
        console.error('Error getting range analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

module.exports = router;
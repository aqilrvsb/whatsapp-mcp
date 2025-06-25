const express = require('express');
const { getDB } = require('../config/database');
const { requireAuth } = require('./auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// Get dashboard analytics
router.get('/dashboard', async (req, res) => {
    const { startDate, endDate, deviceId } = req.query;
    const db = getDB();
    
    try {
        let query = `
            SELECT 
                COUNT(DISTINCT d.id) as total_devices,
                COUNT(DISTINCT CASE WHEN d.status = 'online' THEN d.id END) as active_devices,
                COALESCE(SUM(a.messages_sent), 0) as total_sent,
                COALESCE(SUM(a.messages_received), 0) as total_received,
                COUNT(DISTINCT a.device_id) as devices_with_activity
            FROM user_devices d
            LEFT JOIN message_analytics a ON d.id = a.device_id
            WHERE d.user_id = $1
        `;
        
        const params = [req.session.userId];
        let paramCount = 1;
        
        if (startDate) {
            paramCount++;
            query += ` AND a.date >= $${paramCount}`;
            params.push(startDate);
        }
        
        if (endDate) {
            paramCount++;
            query += ` AND a.date <= $${paramCount}`;
            params.push(endDate);
        }
        
        if (deviceId) {
            paramCount++;
            query += ` AND d.id = $${paramCount}`;
            params.push(deviceId);
        }
        
        const result = await db.query(query, params);
        const stats = result.rows[0];
        
        // Get daily stats for chart
        let dailyQuery = `
            SELECT 
                date,
                SUM(messages_sent) as sent,
                SUM(messages_received) as received
            FROM message_analytics
            WHERE user_id = $1
        `;
        
        const dailyParams = [req.session.userId];
        paramCount = 1;
        
        if (startDate) {
            paramCount++;
            dailyQuery += ` AND date >= $${paramCount}`;
            dailyParams.push(startDate);
        }
        
        if (endDate) {
            paramCount++;
            dailyQuery += ` AND date <= $${paramCount}`;
            dailyParams.push(endDate);
        }
        
        if (deviceId) {
            paramCount++;
            dailyQuery += ` AND device_id = $${paramCount}`;
            dailyParams.push(deviceId);
        }
        
        dailyQuery += ` GROUP BY date ORDER BY date DESC LIMIT 30`;
        
        const dailyResult = await db.query(dailyQuery, dailyParams);
        
        res.json({
            success: true,
            stats: {
                totalDevices: parseInt(stats.total_devices),
                activeDevices: parseInt(stats.active_devices),
                totalSent: parseInt(stats.total_sent),
                totalReceived: parseInt(stats.total_received),
                devicesWithActivity: parseInt(stats.devices_with_activity)
            },
            dailyStats: dailyResult.rows
        });
        
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get device performance
router.get('/devices', async (req, res) => {
    const { startDate, endDate } = req.query;
    const db = getDB();
    
    try {
        let query = `
            SELECT 
                d.id,
                d.device_name,
                d.phone,
                d.status,
                d.last_seen,
                COALESCE(SUM(a.messages_sent), 0) as total_sent,
                COALESCE(SUM(a.messages_received), 0) as total_received,
                COALESCE(SUM(a.contacts_messaged), 0) as total_contacts
            FROM user_devices d
            LEFT JOIN message_analytics a ON d.id = a.device_id
            WHERE d.user_id = $1
        `;
        
        const params = [req.session.userId];
        let paramCount = 1;
        
        if (startDate) {
            paramCount++;
            query += ` AND a.date >= $${paramCount}`;
            params.push(startDate);
        }
        
        if (endDate) {
            paramCount++;
            query += ` AND a.date <= $${paramCount}`;
            params.push(endDate);
        }
        
        query += ` GROUP BY d.id ORDER BY total_sent DESC`;
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            devices: result.rows.map(device => ({
                id: device.id,
                name: device.device_name,
                phone: device.phone,
                status: device.status,
                lastSeen: device.last_seen,
                stats: {
                    sent: parseInt(device.total_sent),
                    received: parseInt(device.total_received),
                    contacts: parseInt(device.total_contacts)
                }
            }))
        });
        
    } catch (error) {
        console.error('Error fetching device analytics:', error);
        res.status(500).json({ error: 'Failed to fetch device analytics' });
    }
});

// Get campaign analytics
router.get('/campaigns', async (req, res) => {
    const { status, limit = 20 } = req.query;
    const db = getDB();
    
    try {
        let query = `
            SELECT 
                id,
                name,
                message,
                recipients_count,
                sent_count,
                delivered_count,
                read_count,
                failed_count,
                status,
                scheduled_at,
                started_at,
                completed_at,
                created_at
            FROM campaigns
            WHERE user_id = $1
        `;
        
        const params = [req.session.userId];
        let paramCount = 1;
        
        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            params.push(status);
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
        params.push(limit);
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            campaigns: result.rows.map(campaign => ({
                ...campaign,
                successRate: campaign.recipients_count > 0 
                    ? ((campaign.sent_count / campaign.recipients_count) * 100).toFixed(2) + '%'
                    : '0%',
                readRate: campaign.sent_count > 0
                    ? ((campaign.read_count / campaign.sent_count) * 100).toFixed(2) + '%'
                    : '0%'
            }))
        });
        
    } catch (error) {
        console.error('Error fetching campaign analytics:', error);
        res.status(500).json({ error: 'Failed to fetch campaign analytics' });
    }
});

module.exports = router;

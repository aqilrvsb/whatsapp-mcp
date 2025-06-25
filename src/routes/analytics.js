const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Get analytics for specific time range
router.get('/:days', async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        const days = parseInt(req.params.days) || 7;
        const deviceFilter = req.query.device;
        
        // Generate mock data for now (will be replaced with real data)
        const mockData = generateMockAnalytics(days);
        
        res.json({
            code: 'SUCCESS',
            results: mockData
        });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to get analytics' 
        });
    }
});

// Get custom date range analytics
router.get('/custom', async (req, res) => {
    try {
        const { start, end, device } = req.query;
        
        if (!start || !end) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Start and end dates are required'
            });
        }
        
        // Calculate days difference
        const startDate = new Date(start);
        const endDate = new Date(end);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        
        // Generate mock data
        const mockData = generateMockAnalytics(days, startDate, endDate);
        
        res.json({
            code: 'SUCCESS',
            results: mockData
        });
    } catch (error) {
        console.error('Error getting custom analytics:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to get analytics' 
        });
    }
});

// Helper function to generate mock analytics
function generateMockAnalytics(days, startDate = null, endDate = null) {
    const leadsSent = Math.floor(Math.random() * 1000) + 500;
    const leadsReceived = Math.floor(leadsSent * 0.8);
    const leadsNotReceived = leadsSent - leadsReceived;
    const leadsRead = Math.floor(leadsReceived * 0.7);
    const leadsNotRead = leadsReceived - leadsRead;
    const leadsReplied = Math.floor(leadsRead * 0.5);
    
    const metrics = {
        leadsSent: leadsSent,
        leadsReceived: leadsReceived,
        leadsNotReceived: leadsNotReceived,
        leadsRead: leadsRead,
        leadsNotRead: leadsNotRead,
        leadsReplied: leadsReplied
    };
    
    const daily = [];
    const today = endDate || new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        daily.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            sent: Math.floor(Math.random() * 100) + 20,
            received: Math.floor(Math.random() * 80) + 15,
            read: Math.floor(Math.random() * 60) + 10,
            replied: Math.floor(Math.random() * 30) + 5
        });
    }
    
    return { metrics, daily };
}

module.exports = router;
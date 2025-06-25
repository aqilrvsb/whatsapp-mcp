const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Get all campaigns
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        
        // For now, return empty array (will implement database later)
        const campaigns = [];
        
        res.json({
            code: 'SUCCESS',
            results: campaigns
        });
    } catch (error) {
        console.error('Error getting campaigns:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to get campaigns' 
        });
    }
});

// Create new campaign
router.post('/', async (req, res) => {
    try {
        const { campaign_date, title, niche, message, image_url, scheduled_time } = req.body;
        
        // For now, just return success
        res.json({
            code: 'SUCCESS',
            results: {
                id: Date.now().toString(),
                campaign_date,
                title,
                niche,
                message,
                image_url,
                scheduled_time
            }
        });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to create campaign' 
        });
    }
});

// Update campaign
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { campaign_date, title, niche, message, image_url, scheduled_time } = req.body;
        
        // For now, just return success
        res.json({
            code: 'SUCCESS',
            results: {
                id,
                campaign_date,
                title,
                niche,
                message,
                image_url,
                scheduled_time
            }
        });
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to update campaign' 
        });
    }
});

// Delete campaign
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        res.json({
            code: 'SUCCESS',
            message: 'Campaign deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ 
            code: 'ERROR',
            message: 'Failed to delete campaign' 
        });
    }
});

module.exports = router;
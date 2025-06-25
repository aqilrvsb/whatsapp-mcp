const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Get all campaigns
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        
        // For now, return mock data with multiple campaigns per date
        const campaigns = [
            {
                id: '1',
                campaign_date: '2025-06-26',
                title: 'Summer Sale',
                niche: 'Promotion',
                message: 'Check out our summer sale!',
                status: 'delivered',
                scheduled_time: '10:00'
            },
            {
                id: '2',
                campaign_date: '2025-06-26',
                title: 'New Product Launch',
                niche: 'Announcement',
                message: 'Introducing our new product line',
                status: 'ongoing',
                scheduled_time: '14:00'
            },
            {
                id: '3',
                campaign_date: '2025-06-27',
                title: 'Weekly Newsletter',
                niche: 'Newsletter',
                message: 'Your weekly updates',
                status: 'scheduled',
                scheduled_time: '09:00'
            }
        ];
        
        // Group campaigns by date
        const groupedCampaigns = {};
        campaigns.forEach(campaign => {
            if (!groupedCampaigns[campaign.campaign_date]) {
                groupedCampaigns[campaign.campaign_date] = [];
            }
            groupedCampaigns[campaign.campaign_date].push(campaign);
        });
        
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
const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

// Get all campaigns
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const userId = req.user.id;
        
        // Get real campaigns from database
        const campaigns = await db.manyOrNone(
            `SELECT * FROM campaigns 
             WHERE user_id = $1 
             ORDER BY campaign_date DESC, scheduled_time DESC`,
            [userId]
        );
        
        res.json({
            code: 'SUCCESS',
            results: campaigns || []
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
        const db = getDB();
        const userId = req.user.id;
        const { campaign_date, title, niche, message, image_url, scheduled_time } = req.body;
        
        // Validate required fields
        if (!campaign_date || !title || !message) {
            return res.status(400).json({
                code: 'ERROR',
                message: 'Campaign date, title, and message are required'
            });
        }
        
        // Insert campaign into database
        const campaign = await db.one(
            `INSERT INTO campaigns (user_id, campaign_date, title, niche, message, image_url, scheduled_time, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
             RETURNING *`,
            [userId, campaign_date, title, niche, message, image_url, scheduled_time]
        );
        
        res.json({
            code: 'SUCCESS',
            results: campaign
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
        const db = getDB();
        const userId = req.user.id;
        const { id } = req.params;
        const { campaign_date, title, niche, message, image_url, scheduled_time } = req.body;
        
        // Check ownership
        const existing = await db.oneOrNone(
            'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        if (!existing) {
            return res.status(404).json({
                code: 'ERROR',
                message: 'Campaign not found'
            });
        }
        
        // Update campaign
        const campaign = await db.one(
            `UPDATE campaigns 
             SET campaign_date = $3, title = $4, niche = $5, message = $6, 
                 image_url = $7, scheduled_time = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, userId, campaign_date, title, niche, message, image_url, scheduled_time]
        );
        
        res.json({
            code: 'SUCCESS',
            results: campaign
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
        const db = getDB();
        const userId = req.user.id;
        const { id } = req.params;
        
        // Delete campaign (ownership check via user_id)
        const result = await db.result(
            'DELETE FROM campaigns WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                code: 'ERROR',
                message: 'Campaign not found'
            });
        }
        
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
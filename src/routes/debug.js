// Debug helper to check WhatsApp manager status
const express = require('express');
const router = express.Router();

router.get('/status', async (req, res) => {
    try {
        const status = {
            whatsappManagerExists: !!global.whatsappManager,
            connectedDevices: []
        };
        
        if (global.whatsappManager) {
            // Get all connected devices
            for (const [deviceId, client] of global.whatsappManager.clients) {
                status.connectedDevices.push({
                    deviceId: deviceId,
                    isConnected: !!client,
                    connectionState: client?.ws?.readyState || 'unknown'
                });
            }
        }
        
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/device/:deviceId/status', async (req, res) => {
    try {
        const { deviceId } = req.params;
        
        if (!global.whatsappManager) {
            return res.json({
                deviceId: deviceId,
                status: 'manager_not_initialized',
                connected: false
            });
        }
        
        const client = global.whatsappManager.getClient(deviceId);
        const session = global.whatsappManager.sessions.get(deviceId);
        
        res.json({
            deviceId: deviceId,
            hasClient: !!client,
            hasSession: !!session,
            connectionState: client?.ws?.readyState || 'not_connected',
            sessionStatus: session?.status || 'no_session'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

// Add auto-reconnect functionality for connected devices

async function reconnectDevices() {
    console.log('🔄 Checking for devices to reconnect...');
    
    try {
        const { getUserRepository } = require('../repository/userRepository');
        const { getDB } = require('../config/database');
        
        const db = getDB();
        const userRepo = getUserRepository(db);
        
        // Get all devices that were online
        const devices = await db.manyOrNone(
            `SELECT ud.*, u.id as user_id
             FROM user_devices ud
             JOIN users u ON ud.user_id = u.id
             WHERE ud.status = 'online'`
        );
        
        if (devices.length > 0) {
            console.log(`Found ${devices.length} devices to reconnect`);
            
            for (const device of devices) {
                try {
                    console.log(`Attempting to reconnect device: ${device.device_name} (${device.id})`);
                    await global.whatsappManager.connectDevice(device.id, device.user_id);
                } catch (error) {
                    console.error(`Failed to reconnect device ${device.id}:`, error.message);
                    // Update status to offline if reconnect fails
                    await userRepo.updateDeviceStatus(device.id, 'offline');
                }
            }
        } else {
            console.log('No devices to reconnect');
        }
    } catch (error) {
        console.error('Error during device reconnection:', error);
    }
}

module.exports = { reconnectDevices };

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');
const pino = require('pino');
const { getDB } = require('../config/database');
const config = require('../config/environment');

class WhatsAppManager {
    constructor(io) {
        this.io = io;
        this.connections = new Map(); // deviceId -> WhatsApp connection
        this.sessionPath = config.whatsapp.sessionPath;
        this.logger = pino({ level: config.whatsapp.logLevel.toLowerCase() });
    }
    
    async initialize() {
        // Create sessions directory if it doesn't exist
        try {
            await fs.mkdir(this.sessionPath, { recursive: true });
        } catch (error) {
            console.error('Error creating sessions directory:', error);
        }
        
        // Restore active device connections from database
        await this.restoreConnections();
    }
    
    async restoreConnections() {
        const db = getDB();
        try {
            // Get all devices that were online
            const result = await db.query(
                `SELECT d.*, u.email as user_email 
                 FROM user_devices d 
                 JOIN users u ON d.user_id = u.id 
                 WHERE d.status = 'online' AND d.session_data IS NOT NULL`
            );
            
            for (const device of result.rows) {
                try {
                    await this.connectDevice(device.id, device.user_id);
                } catch (error) {
                    console.error(`Failed to restore connection for device ${device.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error restoring connections:', error);
        }
    }
    
    async connectDevice(deviceId, userId) {
        // Check if already connected
        if (this.connections.has(deviceId)) {
            console.log(`Device ${deviceId} already connected`);
            return this.connections.get(deviceId);
        }
        
        const sessionDir = path.join(this.sessionPath, deviceId);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            logger: this.logger,
            printQRInTerminal: false,
            browser: ['WhatsApp Analytics', 'Chrome', '1.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: true
        });
        
        // Store connection
        this.connections.set(deviceId, {
            socket: sock,
            userId: userId,
            deviceId: deviceId,
            qr: null,
            isConnected: false
        });
        
        // Connection update handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                // Generate QR code
                const qrCode = await QRCode.toDataURL(qr);
                this.connections.get(deviceId).qr = qrCode;
                
                // Send QR to user
                this.io.to(`user-${userId}`).emit('qr-code', {
                    deviceId: deviceId,
                    qr: qrCode
                });
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting', shouldReconnect);
                
                if (shouldReconnect) {
                    // Reconnect
                    setTimeout(() => {
                        this.connectDevice(deviceId, userId);
                    }, config.whatsapp.reconnectInterval);
                } else {
                    // Logged out, update database
                    await this.updateDeviceStatus(deviceId, 'disconnected');
                    this.connections.delete(deviceId);
                }
            } else if (connection === 'open') {
                console.log(`WhatsApp connected for device ${deviceId}`);
                this.connections.get(deviceId).isConnected = true;
                
                // Update device status in database
                const jid = sock.user?.id;
                const phone = jid?.split(':')[0] || '';
                await this.updateDeviceStatus(deviceId, 'online', phone, jid);
                
                // Notify user
                this.io.to(`user-${userId}`).emit('device-connected', {
                    deviceId: deviceId,
                    phone: phone,
                    jid: jid
                });
            }
        });
        
        // Credentials update handler
        sock.ev.on('creds.update', saveCreds);
        
        // Message handler for analytics
        sock.ev.on('messages.upsert', async (m) => {
            const message = m.messages[0];
            if (!message.key.fromMe && m.type === 'notify') {
                // Update analytics
                await this.updateAnalytics(deviceId, 'received');
            }
        });
        
        return sock;
    }
    
    async disconnectDevice(deviceId) {
        const connection = this.connections.get(deviceId);
        if (connection) {
            connection.socket.logout();
            this.connections.delete(deviceId);
            await this.updateDeviceStatus(deviceId, 'disconnected');
        }
    }
    
    async updateDeviceStatus(deviceId, status, phone = null, jid = null) {
        const db = getDB();
        try {
            const updateFields = ['status = $2', 'last_seen = NOW()'];
            const values = [deviceId, status];
            let paramCount = 2;
            
            if (phone) {
                paramCount++;
                updateFields.push(`phone = $${paramCount}`);
                values.push(phone);
            }
            
            if (jid) {
                paramCount++;
                updateFields.push(`jid = $${paramCount}`);
                values.push(jid);
            }
            
            await db.query(
                `UPDATE user_devices SET ${updateFields.join(', ')} WHERE id = $1`,
                values
            );
        } catch (error) {
            console.error('Error updating device status:', error);
        }
    }
    
    async updateAnalytics(deviceId, type) {
        const db = getDB();
        try {
            const field = type === 'sent' ? 'messages_sent' : 'messages_received';
            await db.query(
                `INSERT INTO message_analytics (device_id, user_id, date, ${field})
                 SELECT $1, user_id, CURRENT_DATE, 1 FROM user_devices WHERE id = $1
                 ON CONFLICT (user_id, device_id, date) 
                 DO UPDATE SET ${field} = message_analytics.${field} + 1`,
                [deviceId]
            );
        } catch (error) {
            console.error('Error updating analytics:', error);
        }
    }
    
    getConnection(deviceId) {
        return this.connections.get(deviceId);
    }
    
    async getChats(deviceId) {
        const connection = this.connections.get(deviceId);
        if (!connection || !connection.isConnected) {
            throw new Error('Device not connected');
        }
        
        const chats = await connection.socket.store.chats.all();
        return chats.map(chat => ({
            id: chat.id,
            name: chat.name || chat.id.split('@')[0],
            lastMessage: chat.lastMessage,
            unreadCount: chat.unreadCount || 0,
            isGroup: chat.id.includes('@g.us'),
            isBroadcast: chat.id.includes('@broadcast')
        }));
    }
    
    async getMessages(deviceId, chatId, limit = 50) {
        const connection = this.connections.get(deviceId);
        if (!connection || !connection.isConnected) {
            throw new Error('Device not connected');
        }
        
        const messages = await connection.socket.store.messages.all();
        const chatMessages = messages
            .filter(m => m.key.remoteJid === chatId)
            .sort((a, b) => b.messageTimestamp - a.messageTimestamp)
            .slice(0, limit);
            
        return chatMessages;
    }
    
    async sendMessage(deviceId, to, message, options = {}) {
        const connection = this.connections.get(deviceId);
        if (!connection || !connection.isConnected) {
            throw new Error('Device not connected');
        }
        
        // Format phone number if needed
        if (!to.includes('@')) {
            to = to.replace(/\D/g, '') + '@s.whatsapp.net';
        }
        
        const result = await connection.socket.sendMessage(to, { text: message, ...options });
        
        // Update analytics
        await this.updateAnalytics(deviceId, 'sent');
        
        return result;
    }
    
    async getContacts(deviceId) {
        const connection = this.connections.get(deviceId);
        if (!connection || !connection.isConnected) {
            throw new Error('Device not connected');
        }
        
        const contacts = await connection.socket.store.contacts.all();
        return Object.values(contacts).map(contact => ({
            id: contact.id,
            name: contact.name || contact.notify || contact.id.split('@')[0],
            phone: contact.id.split('@')[0],
            isWhatsAppUser: contact.id.includes('@s.whatsapp.net')
        }));
    }
    
    async shutdown() {
        // Disconnect all devices
        for (const [deviceId, connection] of this.connections) {
            try {
                await connection.socket.logout();
            } catch (error) {
                console.error(`Error disconnecting device ${deviceId}:`, error);
            }
        }
        this.connections.clear();
    }
}

module.exports = { WhatsAppManager };

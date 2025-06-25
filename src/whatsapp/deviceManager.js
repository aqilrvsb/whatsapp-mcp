const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs').promises;
const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

class WhatsAppManager {
    constructor(io) {
        this.io = io;
        this.clients = new Map(); // deviceId -> WhatsApp client
        this.sessions = new Map(); // deviceId -> session data
    }

    // Connect a device
    async connectDevice(deviceId, userId) {
        try {
            // Check if already connected
            if (this.clients.has(deviceId)) {
                console.log(`Device ${deviceId} already connected`);
                return;
            }

            // Create session directory
            const sessionPath = path.join(__dirname, '../../sessions', deviceId);
            await fs.mkdir(sessionPath, { recursive: true });

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            // Create WhatsApp socket
            const sock = makeWASocket({
                auth: state,
                logger: pino({ level: 'warn' }),
                printQRInTerminal: false,
                browser: ['WhatsApp Analytics', 'Chrome', '110.0.0.0']
            });

            // Store client
            this.clients.set(deviceId, sock);

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    // Send QR to frontend
                    this.io.emit('qr', { deviceId, qr });
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    
                    if (shouldReconnect) {
                        console.log(`Reconnecting device ${deviceId}...`);
                        setTimeout(() => this.connectDevice(deviceId, userId), 5000);
                    } else {
                        console.log(`Device ${deviceId} logged out`);
                        this.clients.delete(deviceId);
                        await this.updateDeviceStatus(deviceId, 'offline');
                    }
                }
                if (connection === 'open') {
                    console.log(`Device ${deviceId} connected!`);
                    
                    // Update device status and info
                    const jid = sock.user?.id;
                    const phone = jid ? jid.split('@')[0].split(':')[0] : null;
                    
                    await this.updateDeviceStatus(deviceId, 'online', phone, jid);
                    
                    // Notify frontend
                    this.io.emit('device-connected', { deviceId });
                }
            });

            // Save credentials
            sock.ev.on('creds.update', saveCreds);

            // Handle messages (for analytics)
            sock.ev.on('messages.upsert', async (m) => {
                // Handle incoming messages for analytics
                // We don't store messages, just count them
                const messages = m.messages;
                for (const msg of messages) {
                    if (msg.key.fromMe) {
                        // Message sent
                        await this.trackMessage(deviceId, userId, 'sent');
                    } else {
                        // Message received
                        await this.trackMessage(deviceId, userId, 'received');
                    }
                }
            });

            // Socket events are handled globally in server.js

        } catch (error) {
            console.error(`Error connecting device ${deviceId}:`, error);
            throw error;
        }
    }

    // Disconnect a device
    async disconnectDevice(deviceId) {
        try {
            const client = this.clients.get(deviceId);
            if (client) {
                await client.logout();
                this.clients.delete(deviceId);
            }
        } catch (error) {
            console.error(`Error disconnecting device ${deviceId}:`, error);
        }
    }
    // Get WhatsApp client for a device
    getClient(deviceId) {
        return this.clients.get(deviceId);
    }

    // Update device status in database
    async updateDeviceStatus(deviceId, status, phone = null, jid = null) {
        try {
            const db = getDB();
            const userRepo = getUserRepository(db);
            await userRepo.updateDeviceStatus(deviceId, status, phone, jid);
        } catch (error) {
            console.error('Error updating device status:', error);
        }
    }

    // Track message for analytics (no storage)
    async trackMessage(deviceId, userId, type) {
        try {
            // This would update analytics counters
            // Implementation depends on analytics requirements
            console.log(`Message ${type} for device ${deviceId}`);
        } catch (error) {
            console.error('Error tracking message:', error);
        }
    }

    // Get chats for a device
    async getChats(deviceId) {
        try {
            const client = this.clients.get(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }

            // Get chats from WhatsApp
            const chats = await client.groupFetchAllParticipating();
            
            // Return formatted chats
            return Object.values(chats).map(chat => ({
                id: chat.id,
                name: chat.subject || chat.id.split('@')[0],
                isGroup: chat.id.includes('@g.us'),
                participants: chat.participants?.length || 0
            }));
        } catch (error) {
            console.error('Error getting chats:', error);
            throw error;
        }
    }

    // Send message
    async sendMessage(deviceId, to, message) {
        try {
            const client = this.clients.get(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }

            // Ensure JID format
            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            await client.sendMessage(jid, { text: message });
            return { success: true };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}

module.exports = { WhatsAppManager };
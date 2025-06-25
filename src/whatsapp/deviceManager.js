const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');
const { getUserRepository } = require('../repository/userRepository');
const { getDB } = require('../config/database');

class WhatsAppManager {
    constructor(io) {
        this.io = io;
        this.clients = new Map(); // deviceId -> WhatsApp client
        this.sessions = new Map(); // deviceId -> session data
        this.qrTimeouts = new Map(); // deviceId -> timeout
    }

    // Connect a device
    async connectDevice(deviceId, userId) {
        try {
            console.log(`Starting connection for device ${deviceId}, user ${userId}`);
            
            // Check if already connected
            if (this.clients.has(deviceId)) {
                console.log(`Device ${deviceId} already connected`);
                return;
            }

            // Clear any existing QR timeout
            if (this.qrTimeouts.has(deviceId)) {
                clearTimeout(this.qrTimeouts.get(deviceId));
                this.qrTimeouts.delete(deviceId);
            }

            // Create session directory - IMPORTANT: Use userId to isolate sessions
            const sessionPath = path.join(__dirname, '../../sessions', userId, deviceId);
            await fs.mkdir(sessionPath, { recursive: true });

            // Initialize auth state
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            // Get latest version
            const { version } = await fetchLatestBaileysVersion();
            console.log(`Using WA version: ${version}`);

            // Create WhatsApp socket with proper configuration
            const sock = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: 'silent' }), // Reduce logging
                printQRInTerminal: false,
                browser: ['Chrome (Linux)', '', ''], // More realistic browser
                connectTimeoutMs: 60000,
                qrTimeout: 120000, // 2 minutes
                defaultQueryTimeoutMs: undefined,
                keepAliveIntervalMs: 10000,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                markOnlineOnConnect: true,
                // Add connection retry config
                retryRequestDelayMs: 2000,
                maxMsgRetryCount: 5,
                // Ensure connection stays stable
                getMessage: async (key) => {
                    return { conversation: 'Hello' };
                }
            });

            // Store client
            this.clients.set(deviceId, sock);

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log(`QR code received for device ${deviceId}`);
                    
                    // Generate QR code as data URL
                    try {
                        const qrDataUrl = await QRCode.toDataURL(qr, {
                            errorCorrectionLevel: 'M',
                            type: 'image/png',
                            quality: 0.92,
                            margin: 1,
                            color: {
                                dark: '#000000',
                                light: '#FFFFFF'
                            },
                            scale: 8
                        });
                        
                        // Send QR to frontend with data URL
                        this.io.emit('qr', { 
                            deviceId, 
                            qr: qrDataUrl,
                            rawQr: qr // Also send raw QR for backup
                        });
                        
                        // Store for API access
                        this.sessions.set(deviceId, { 
                            qr: qrDataUrl, 
                            rawQr: qr,
                            status: 'pending',
                            timestamp: new Date()
                        });

                        // Set QR timeout
                        const timeout = setTimeout(() => {
                            console.log(`QR timeout for device ${deviceId}`);
                            this.io.emit('qr-timeout', { deviceId });
                            this.sessions.delete(deviceId);
                            sock.end(new Error('QR timeout'));
                        }, 120000); // 2 minutes

                        this.qrTimeouts.set(deviceId, timeout);
                    } catch (error) {
                        console.error('Error generating QR code:', error);
                    }
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log(`Connection closed for device ${deviceId}, shouldReconnect: ${shouldReconnect}`);
                    
                    // Clear QR timeout
                    if (this.qrTimeouts.has(deviceId)) {
                        clearTimeout(this.qrTimeouts.get(deviceId));
                        this.qrTimeouts.delete(deviceId);
                    }
                    
                    if (shouldReconnect) {
                        console.log(`Reconnecting device ${deviceId}...`);
                        this.clients.delete(deviceId);
                        setTimeout(() => this.connectDevice(deviceId, userId), 5000);
                    } else {
                        console.log(`Device ${deviceId} logged out`);
                        this.clients.delete(deviceId);
                        this.sessions.delete(deviceId);
                        await this.updateDeviceStatus(deviceId, 'offline');
                    }
                }

                if (connection === 'open') {
                    console.log(`Device ${deviceId} connected successfully!`);
                    
                    // Clear QR timeout
                    if (this.qrTimeouts.has(deviceId)) {
                        clearTimeout(this.qrTimeouts.get(deviceId));
                        this.qrTimeouts.delete(deviceId);
                    }
                    
                    // Update device status and info
                    const jid = sock.user?.id;
                    const phone = jid ? jid.split('@')[0].split(':')[0] : null;
                    
                    await this.updateDeviceStatus(deviceId, 'online', phone, jid);
                    
                    // Clear session
                    this.sessions.delete(deviceId);
                    
                    // Notify frontend
                    this.io.emit('device-connected', { deviceId, phone, jid });
                }
            });

            // Save credentials
            sock.ev.on('creds.update', saveCreds);

            // Handle messages for analytics
            sock.ev.on('messages.upsert', async (m) => {
                const messages = m.messages;
                for (const msg of messages) {
                    if (msg.key.fromMe) {
                        await this.trackMessage(deviceId, userId, 'sent');
                    } else {
                        await this.trackMessage(deviceId, userId, 'received');
                    }
                }
            });
            
            // Add connection stability - keep alive
            const keepAlive = setInterval(() => {
                if (sock.user && sock.ws && sock.ws.readyState === 1) {
                    // Send presence update to keep connection alive
                    sock.sendPresenceUpdate('available').catch(() => {
                        console.log(`Keep-alive failed for device ${deviceId}`);
                    });
                }
            }, 30000); // Every 30 seconds
            
            // Store client with keepAlive reference
            this.clients.set(deviceId, { sock, keepAlive });

        } catch (error) {
            console.error(`Error connecting device ${deviceId}:`, error);
            this.io.emit('connection-error', { 
                deviceId, 
                error: error.message || 'Connection failed' 
            });
            throw error;
        }
    }

    // Disconnect a device
    async disconnectDevice(deviceId) {
        try {
            const clientData = this.clients.get(deviceId);
            if (clientData) {
                // Clear keep-alive interval
                if (clientData.keepAlive) {
                    clearInterval(clientData.keepAlive);
                }
                
                // Logout from WhatsApp
                const client = clientData.sock || clientData;
                if (client && client.logout) {
                    await client.logout();
                }
                
                this.clients.delete(deviceId);
            }
            
            // Clear QR timeout
            if (this.qrTimeouts.has(deviceId)) {
                clearTimeout(this.qrTimeouts.get(deviceId));
                this.qrTimeouts.delete(deviceId);
            }
            
            // Clear session
            this.sessions.delete(deviceId);
        } catch (error) {
            console.error(`Error disconnecting device ${deviceId}:`, error);
        }
    }

    // Get WhatsApp client for a device
    getClient(deviceId) {
        const clientData = this.clients.get(deviceId);
        if (clientData) {
            return clientData.sock || clientData;
        }
        return null;
    }

    // Get QR code for a device
    getQRCode(deviceId) {
        const session = this.sessions.get(deviceId);
        return session ? session.qr : null;
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

    // Track message for analytics
    async trackMessage(deviceId, userId, type) {
        try {
            console.log(`Message ${type} for device ${deviceId}`);
            // Update analytics in database if needed
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

            const chats = await client.groupFetchAllParticipating();
            
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
    async sendMessage(deviceId, to, message, options = {}) {
        try {
            const client = this.clients.get(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }

            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            await client.sendMessage(jid, { text: message });
            return { success: true };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // Send image
    async sendImage(deviceId, to, imageUrl, caption = '') {
        try {
            const client = this.clients.get(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }

            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            await client.sendMessage(jid, {
                image: { url: imageUrl },
                caption: caption
            });
            return { success: true };
        } catch (error) {
            console.error('Error sending image:', error);
            throw error;
        }
    }

    // Check if number is registered on WhatsApp
    async checkNumber(deviceId, phoneNumber) {
        try {
            const client = this.clients.get(deviceId);
            if (!client) {
                throw new Error('Device not connected');
            }

            const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
            const [result] = await client.onWhatsApp(jid);
            
            return {
                exists: result?.exists || false,
                jid: result?.jid || jid
            };
        } catch (error) {
            console.error('Error checking number:', error);
            throw error;
        }
    }
}

module.exports = { WhatsAppManager };

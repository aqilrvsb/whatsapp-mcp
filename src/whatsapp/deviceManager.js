const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
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
        this.recentChats = new Map(); // deviceId -> Set of recent chat IDs
        this.statusCheckIntervals = new Map(); // deviceId -> interval for status check
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
            let version;
            try {
                const versionResult = await fetchLatestBaileysVersion();
                version = versionResult.version;
                console.log(`Using WA version: ${version}`);
            } catch (error) {
                console.log('Failed to fetch latest version, using default');
                version = [2, 2413, 1]; // Default version
            }

            // Try to create store if available
            let store;
            try {
                if (makeInMemoryStore) {
                    store = makeInMemoryStore({
                        logger: pino({ level: 'silent' })
                    });
                    console.log('In-memory store created successfully');
                }
            } catch (error) {
                console.log('Store creation failed, continuing without store:', error.message);
                store = null;
            }

            // Create WhatsApp socket with proper configuration
            const sock = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: 'silent' }), // Reduce logging
                printQRInTerminal: false,
                browser: ['WhatsApp MCP', 'Chrome', '3.0'], // Custom browser name
                connectTimeoutMs: 60000,
                qrTimeout: 120000, // 2 minutes
                defaultQueryTimeoutMs: undefined,
                keepAliveIntervalMs: 10000,
                generateHighQualityLinkPreview: false,
                syncFullHistory: true, // Enable to get chats
                markOnlineOnConnect: true,
                // Add connection retry config
                retryRequestDelayMs: 2000,
                maxMsgRetryCount: 5
            });

            // Bind store to socket if available
            if (store) {
                store.bind(sock.ev);
                sock.store = store; // Attach store to socket for easy access
            }

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
                        
                        console.log(`QR data URL generated for device ${deviceId}, length: ${qrDataUrl.length}`);
                        
                        // Send QR to frontend with data URL
                        this.io.emit('qr', { 
                            deviceId, 
                            qr: qrDataUrl,
                            rawQr: qr // Also send raw QR for backup
                        });
                        
                        // Also emit to specific room if available
                        this.io.to(`device-${deviceId}`).emit('qr', { 
                            deviceId, 
                            qr: qrDataUrl,
                            rawQr: qr
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
                        this.io.emit('qr-error', { 
                            deviceId, 
                            error: 'Failed to generate QR code' 
                        });
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
                    
                    // Set up contact resolver
                    sock.ev.on('contacts.update', async (contacts) => {
                        console.log(`Received ${contacts.length} contact updates`);
                        const db = getDB();
                        
                        for (const contact of contacts) {
                            if (contact.id && contact.id.endsWith('@s.whatsapp.net')) {
                                // Update chat name if we have a chat with this contact
                                await db.none(`
                                    UPDATE whatsapp_chats 
                                    SET chat_name = $1, updated_at = CURRENT_TIMESTAMP
                                    WHERE device_id = $2 AND chat_jid = $3
                                    AND chat_name = SUBSTRING(chat_jid FROM 1 FOR POSITION('@' IN chat_jid) - 1)
                                `, [
                                    contact.name || contact.notify || contact.id.split('@')[0],
                                    deviceId,
                                    contact.id
                                ]);
                            }
                        }
                    });
                    
                    // Load initial chats after connection
                    setTimeout(async () => {
                        try {
                            console.log(`Loading initial chats for device ${deviceId}`);
                            
                            // Try to fetch existing chats from WhatsApp
                            // This will populate the database with existing personal chats
                            await this.syncExistingChats(deviceId, sock);
                            
                            const chats = await this.getChats(deviceId);
                            console.log(`Loaded ${chats.length} chats for device ${deviceId}`);
                        } catch (err) {
                            console.error('Error loading initial chats:', err);
                        }
                    }, 2000); // Wait 2 seconds for connection to stabilize
                    
                    // Start periodic status check
                    const statusCheckInterval = setInterval(async () => {
                        try {
                            const clientData = this.clients.get(deviceId);
                            if (clientData && clientData.sock) {
                                const sock = clientData.sock;
                                if (!sock.user || sock.ws?.readyState !== 1) {
                                    console.log(`Device ${deviceId} connection lost`);
                                    await this.updateDeviceStatus(deviceId, 'offline');
                                    this.io.emit('device-disconnected', { deviceId });
                                    clearInterval(statusCheckInterval);
                                    this.statusCheckIntervals.delete(deviceId);
                                }
                            }
                        } catch (err) {
                            console.error('Status check error:', err);
                        }
                    }, 10000); // Check every 10 seconds
                    
                    this.statusCheckIntervals.set(deviceId, statusCheckInterval);
                }
            });

            // Save credentials
            sock.ev.on('creds.update', saveCreds);

            // Handle messages for analytics and storage
            sock.ev.on('messages.upsert', async (m) => {
                const messages = m.messages;
                
                for (const msg of messages) {
                    // Track message for analytics
                    if (msg.key.fromMe) {
                        await this.trackMessage(deviceId, userId, 'sent');
                    } else {
                        await this.trackMessage(deviceId, userId, 'received');
                    }
                    
                    // Store message in PostgreSQL
                    try {
                        const chatId = msg.key.remoteJid;
                        
                        // Only store personal chats
                        if (chatId && chatId.includes('@s.whatsapp.net')) {
                            const db = getDB();
                            
                            // First, ensure chat exists in whatsapp_chats table
                            const contactName = msg.pushName || msg.key.participant?.split('@')[0] || chatId.split('@')[0];
                            
                            await db.none(`
                                INSERT INTO whatsapp_chats (device_id, chat_jid, chat_name, is_group, last_message_text, last_message_time, unread_count)
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                                ON CONFLICT (device_id, chat_jid) 
                                DO UPDATE SET 
                                    chat_name = CASE 
                                        WHEN whatsapp_chats.chat_name = SUBSTRING(whatsapp_chats.chat_jid FROM 1 FOR POSITION('@' IN whatsapp_chats.chat_jid) - 1)
                                        THEN EXCLUDED.chat_name
                                        ELSE whatsapp_chats.chat_name
                                    END,
                                    last_message_text = EXCLUDED.last_message_text,
                                    last_message_time = EXCLUDED.last_message_time,
                                    unread_count = CASE 
                                        WHEN $8 = true THEN 0
                                        WHEN whatsapp_chats.last_message_time < EXCLUDED.last_message_time 
                                        THEN whatsapp_chats.unread_count + 1 
                                        ELSE whatsapp_chats.unread_count 
                                    END,
                                    updated_at = CURRENT_TIMESTAMP
                            `, [
                                deviceId,
                                chatId,
                                contactName,
                                false,
                                msg.message?.conversation || msg.message?.extendedTextMessage?.text || 'Media',
                                new Date(msg.messageTimestamp * 1000),
                                msg.key.fromMe ? 0 : 1,
                                msg.key.fromMe
                            ]);
                            
                            // Store the message
                            await db.none(`
                                INSERT INTO whatsapp_messages (device_id, chat_jid, message_id, sender_jid, sender_name, message_text, message_type, is_sent, timestamp)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                                ON CONFLICT (device_id, message_id) DO NOTHING
                            `, [
                                deviceId,
                                chatId,
                                msg.key.id,
                                msg.key.fromMe ? sock.user.id : chatId,
                                msg.key.fromMe ? 'Me' : (msg.pushName || chatId.split('@')[0]),
                                msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
                                msg.message?.imageMessage ? 'image' : msg.message?.videoMessage ? 'video' : msg.message?.documentMessage ? 'document' : 'text',
                                msg.key.fromMe,
                                new Date(msg.messageTimestamp * 1000)
                            ]);
                        }
                    } catch (error) {
                        console.error('Error storing message:', error);
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
            
            // Clear status check interval
            if (this.statusCheckIntervals.has(deviceId)) {
                clearInterval(this.statusCheckIntervals.get(deviceId));
                this.statusCheckIntervals.delete(deviceId);
            }
            
            // Clear QR timeout
            if (this.qrTimeouts.has(deviceId)) {
                clearTimeout(this.qrTimeouts.get(deviceId));
                this.qrTimeouts.delete(deviceId);
            }
            
            // Clear session
            this.sessions.delete(deviceId);
            
            // Update device status in database to offline
            await this.updateDeviceStatus(deviceId, 'offline');
            
            // Emit disconnect event to frontend
            this.io.emit('device-disconnected', { deviceId });
            
        } catch (error) {
            console.error(`Error disconnecting device ${deviceId}:`, error);
            // Still update status even if logout fails
            await this.updateDeviceStatus(deviceId, 'offline');
        }
    }

    // Sync existing chats from WhatsApp to database
    async syncExistingChats(deviceId, sock) {
        try {
            console.log('Syncing existing chats from WhatsApp...');
            const db = getDB();
            
            // Method 1: Try to get recent messages to discover chats
            sock.ev.on('messages.set', async ({ messages }) => {
                console.log(`Received ${messages.length} historical messages`);
                
                for (const msg of messages) {
                    const chatId = msg.key.remoteJid;
                    
                    // Only process personal chats
                    if (chatId && chatId.endsWith('@s.whatsapp.net')) {
                        const contactName = msg.pushName || msg.key.participant?.split('@')[0] || chatId.split('@')[0];
                        
                        // Create/update chat
                        await db.none(`
                            INSERT INTO whatsapp_chats (device_id, chat_jid, chat_name, is_group, last_message_text, last_message_time, unread_count)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            ON CONFLICT (device_id, chat_jid) 
                            DO UPDATE SET 
                                chat_name = CASE 
                                    WHEN whatsapp_chats.chat_name = SUBSTRING(whatsapp_chats.chat_jid FROM 1 FOR POSITION('@' IN whatsapp_chats.chat_jid) - 1)
                                    THEN EXCLUDED.chat_name
                                    ELSE whatsapp_chats.chat_name
                                END,
                                updated_at = CURRENT_TIMESTAMP
                        `, [
                            deviceId,
                            chatId,
                            contactName,
                            false,
                            msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
                            msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date(),
                            0
                        ]);
                        
                        // Store the message
                        await db.none(`
                            INSERT INTO whatsapp_messages (device_id, chat_jid, message_id, sender_jid, sender_name, message_text, message_type, is_sent, timestamp)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (device_id, message_id) DO NOTHING
                        `, [
                            deviceId,
                            chatId,
                            msg.key.id,
                            msg.key.fromMe ? sock.user.id : chatId,
                            msg.key.fromMe ? 'Me' : contactName,
                            msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
                            msg.message?.imageMessage ? 'image' : msg.message?.videoMessage ? 'video' : 'text',
                            msg.key.fromMe,
                            msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date()
                        ]);
                    }
                }
            });
            
            // Method 2: Try to trigger chat sync
            if (sock.syncFullHistory) {
                console.log('Requesting full history sync...');
                sock.syncFullHistory = true;
            }
            
            console.log('Chat sync initiated, chats will populate as messages are received');
            
        } catch (error) {
            console.error('Error syncing chats:', error);
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
            const clientData = this.clients.get(deviceId);
            if (!clientData) {
                throw new Error('Device not connected');
            }
            
            // Get personal chats only from PostgreSQL
            const db = getDB();
            const chats = await db.any(`
                SELECT 
                    chat_jid as id,
                    chat_name as name,
                    is_group,
                    last_message_text,
                    last_message_time,
                    unread_count,
                    avatar_url,
                    updated_at
                FROM whatsapp_chats
                WHERE device_id = $1 
                AND is_group = false
                AND chat_jid LIKE '%@s.whatsapp.net'
                ORDER BY last_message_time DESC NULLS LAST
            `, [deviceId]);
            
            // Format chats for frontend
            return chats.map(chat => ({
                id: chat.id,
                name: chat.name || chat.id.split('@')[0],
                phone: chat.id.split('@')[0],
                isGroup: false,
                lastMessage: chat.last_message_time ? chat.last_message_time.toISOString() : null,
                lastMessageContent: chat.last_message_text || '',
                unreadCount: chat.unread_count || 0,
                avatarUrl: chat.avatar_url || null,
                timestamp: chat.last_message_time ? chat.last_message_time.getTime() / 1000 : 0
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
            
            const sock = client.sock || client;
            
            // Check if client is properly connected
            if (!sock.user || !sock.user.id) {
                // Update device status to offline
                await this.updateDeviceStatus(deviceId, 'offline');
                throw new Error('WhatsApp is not connected. Please scan QR code again.');
            }

            const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            await sock.sendMessage(jid, { text: message });
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

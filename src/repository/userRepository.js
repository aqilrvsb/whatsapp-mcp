const { v4: uuidv4 } = require('uuid');
const { User, UserSession, UserDevice } = require('../models');

class UserRepository {
    constructor(db) {
        this.db = db;
        this.initializeAdmin();
    }

    async initializeAdmin() {
        try {
            // Check if admin exists
            const adminExists = await this.getUserByEmail('admin@whatsapp.com');
            if (!adminExists) {
                // Create default admin user
                await this.createUser('admin@whatsapp.com', 'Administrator', 'changeme123');
                console.log('✅ Default admin user created');
            }
        } catch (error) {
            console.log('Admin user initialization:', error.message);
        }
    }

    // Create a new user with base64 encoded password (like Go project)
    async createUser(email, fullName, password) {
        try {
            // Check if user exists
            const existingUser = await this.db.oneOrNone(
                'SELECT id FROM users WHERE email = $1',
                [email]
            );
            
            if (existingUser) {
                throw new Error(`User with email ${email} already exists`);
            }

            // Encode password with base64 (matching Go implementation)
            const encodedPassword = Buffer.from(password).toString('base64');

            // Create user
            const userId = uuidv4();
            const user = await this.db.one(
                `INSERT INTO users (id, email, full_name, password_hash, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                 RETURNING *`,
                [userId, email, fullName, encodedPassword, true]
            );

            return new User(user);
        } catch (error) {
            throw error;
        }
    }

    // Get user by email
    async getUserByEmail(email) {
        try {
            console.log(`Debug getUserByEmail: Looking for email: '${email}'`);
            const user = await this.db.oneOrNone(
                `SELECT id, email, full_name, password_hash, is_active, created_at, updated_at, last_login
                 FROM users WHERE email = $1`,
                [email]
            );
            
            if (!user) {
                console.log(`Debug getUserByEmail: User not found for email: '${email}'`);
                return null;
            }

            return new User(user);
        } catch (error) {
            throw error;
        }
    }

    // Get user by ID
    async getUserById(userId) {
        try {
            const user = await this.db.oneOrNone(
                `SELECT id, email, full_name, password_hash, is_active, created_at, updated_at, last_login
                 FROM users WHERE id = $1`,
                [userId]
            );
            
            return user ? new User(user) : null;
        } catch (error) {
            throw error;
        }
    }

    // Validate password (base64 decode and compare)
    async validatePassword(email, password) {
        try {
            const user = await this.getUserByEmail(email);
            if (!user) {
                throw new Error('User not found');
            }

            if (!user.isActive) {
                throw new Error('User account is disabled');
            }
            // Debug logging (like Go implementation)
            console.log(`Debug: Validating password for email: ${email}`);
            console.log(`Debug: Password provided: ${password}`);
            console.log(`Debug: Encoded password from DB: ${user.passwordHash}`);

            // Decode the stored password
            const decodedPassword = Buffer.from(user.passwordHash, 'base64').toString('utf-8');
            console.log(`Debug: Decoded password: ${decodedPassword}`);

            // Check if password matches
            if (decodedPassword !== password) {
                throw new Error('Invalid password');
            }

            // Update last login
            await this.updateLastLogin(user.id);

            return user;
        } catch (error) {
            throw error;
        }
    }

    // Update last login timestamp
    async updateLastLogin(userId) {
        try {
            await this.db.none(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [userId]
            );
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    // Create session (cookie-based like Go)
    async createSession(userId) {
        try {
            const session = {
                id: uuidv4(),
                userId: userId,
                token: uuidv4(),
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                createdAt: new Date()
            };
            await this.db.none(
                `INSERT INTO user_sessions (id, user_id, token, expires_at, created_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [session.id, session.userId, session.token, session.expiresAt, session.createdAt]
            );

            return new UserSession(session);
        } catch (error) {
            throw error;
        }
    }

    // Get session by token
    async getSession(token) {
        try {
            const session = await this.db.oneOrNone(
                `SELECT id, user_id, token, expires_at, created_at
                 FROM user_sessions 
                 WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP`,
                [token]
            );

            if (!session) {
                throw new Error('Session not found or expired');
            }

            return new UserSession(session);
        } catch (error) {
            throw error;
        }
    }

    // Delete session (logout)
    async deleteSession(token) {
        try {
            await this.db.none(
                'DELETE FROM user_sessions WHERE token = $1',
                [token]
            );
        } catch (error) {
            throw error;
        }
    }

    // Add user device
    async addUserDevice(userId, deviceName) {
        try {
            const deviceId = uuidv4();            const device = await this.db.one(
                `INSERT INTO user_devices (id, user_id, device_name, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, NOW(), NOW())
                 RETURNING *`,
                [deviceId, userId, deviceName, 'offline']
            );

            return new UserDevice(device);
        } catch (error) {
            throw error;
        }
    }

    // Get user devices
    async getUserDevices(userId) {
        try {
            const devices = await this.db.manyOrNone(
                `SELECT * FROM user_devices 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );

            return devices.map(d => new UserDevice(d));
        } catch (error) {
            throw error;
        }
    }

    // Get device by ID
    async getDevice(deviceId) {
        try {
            const device = await this.db.oneOrNone(
                'SELECT * FROM user_devices WHERE id = $1',
                [deviceId]
            );

            return device ? new UserDevice(device) : null;
        } catch (error) {
            throw error;
        }
    }

    // Update device status
    async updateDeviceStatus(deviceId, status, phone = null, jid = null) {
        try {
            const updateFields = ['status = $2', 'last_seen = NOW()'];
            const params = [deviceId, status];
            if (phone) {
                updateFields.push(`phone = $${params.length + 1}`);
                params.push(phone);
            }

            if (jid) {
                updateFields.push(`jid = $${params.length + 1}`);
                params.push(jid);
            }

            await this.db.none(
                `UPDATE user_devices SET ${updateFields.join(', ')} WHERE id = $1`,
                params
            );
        } catch (error) {
            throw error;
        }
    }

    // Update device phone
    async updateDevicePhone(deviceId, phone) {
        try {
            await this.db.none(
                'UPDATE user_devices SET phone = $2, updated_at = NOW() WHERE id = $1',
                [deviceId, phone]
            );
        } catch (error) {
            throw error;
        }
    }

    // Delete device
    async deleteDevice(deviceId) {
        try {
            await this.db.none(
                'DELETE FROM user_devices WHERE id = $1',
                [deviceId]
            );
        } catch (error) {
            throw error;
        }
    }

    // Check if user owns device
    async userOwnsDevice(userId, deviceId) {
        try {
            const result = await this.db.oneOrNone(
                'SELECT id FROM user_devices WHERE id = $1 AND user_id = $2',
                [deviceId, userId]
            );
            return result !== null;
        } catch (error) {
            throw error;
        }
    }
}

// Singleton instance
let userRepository = null;

function getUserRepository(db) {
    if (!userRepository) {
        userRepository = new UserRepository(db);
    }
    return userRepository;
}

module.exports = {
    getUserRepository
};
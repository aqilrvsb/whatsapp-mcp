// User model - matches Go project structure
class User {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.fullName = data.full_name || data.fullName;
        this.passwordHash = data.password_hash || data.passwordHash;
        this.isActive = data.is_active !== undefined ? data.is_active : true;
        this.createdAt = data.created_at || data.createdAt || new Date();
        this.updatedAt = data.updated_at || data.updatedAt || new Date();
        this.lastLogin = data.last_login || data.lastLogin || null;
    }
}

// UserDevice model
class UserDevice {
    constructor(data) {
        this.id = data.id;
        this.userId = data.user_id || data.userId;
        this.deviceName = data.device_name || data.deviceName;
        this.phone = data.phone || '';
        this.jid = data.jid || '';
        this.status = data.status || 'offline'; // online, offline, connecting
        this.lastSeen = data.last_seen || data.lastSeen || new Date();
        this.createdAt = data.created_at || data.createdAt || new Date();
        this.updatedAt = data.updated_at || data.updatedAt || new Date();
        this.sessionData = data.session_data || data.sessionData || null;
    }
}

// UserSession model for cookie sessions
class UserSession {
    constructor(data) {
        this.id = data.id;
        this.userId = data.user_id || data.userId;
        this.token = data.token;
        this.expiresAt = data.expires_at || data.expiresAt;
        this.createdAt = data.created_at || data.createdAt || new Date();
    }
}

module.exports = {
    User,
    UserDevice,
    UserSession
};
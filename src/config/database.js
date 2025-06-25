const { Pool } = require('pg');
const config = require('./environment');

let pool;

async function connectDB() {
    try {
        pool = new Pool({
            connectionString: config.database.uri,
            ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
            max: config.database.poolSize,
        });
        
        // Test connection
        await pool.query('SELECT NOW()');
        
        // Create tables if they don't exist
        await createTables();
        
        return pool;
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
}

async function createTables() {
    const queries = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW(),
            last_login TIMESTAMP
        )`,
        
        // User sessions table
        `CREATE TABLE IF NOT EXISTS user_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(255) UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )`,
        
        // Devices table
        `CREATE TABLE IF NOT EXISTS user_devices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            device_name VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            jid VARCHAR(100),
            status VARCHAR(50) DEFAULT 'disconnected',
            last_seen TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            session_data TEXT
        )`,
        
        // Message analytics table (no message storage)
        `CREATE TABLE IF NOT EXISTS message_analytics (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id),
            device_id UUID REFERENCES user_devices(id),
            date DATE NOT NULL,
            messages_sent INTEGER DEFAULT 0,
            messages_received INTEGER DEFAULT 0,
            contacts_messaged INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, device_id, date)
        )`,
        
        // Broadcast campaigns
        `CREATE TABLE IF NOT EXISTS campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            name VARCHAR(255),
            message TEXT,
            media_url TEXT,
            recipients_count INTEGER,
            sent_count INTEGER DEFAULT 0,
            delivered_count INTEGER DEFAULT 0,
            read_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status VARCHAR(50) DEFAULT 'draft',
            scheduled_at TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )`,
        
        // Campaign recipients
        `CREATE TABLE IF NOT EXISTS campaign_recipients (
            id SERIAL PRIMARY KEY,
            campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
            phone VARCHAR(50),
            device_id UUID REFERENCES user_devices(id),
            status VARCHAR(50) DEFAULT 'pending',
            sent_at TIMESTAMP,
            delivered_at TIMESTAMP,
            read_at TIMESTAMP,
            error_message TEXT
        )`,
        
        // Create indexes
        `CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_user_devices_status ON user_devices(status)`,
        `CREATE INDEX IF NOT EXISTS idx_message_analytics_date ON message_analytics(date)`,
        `CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`,
        
        // Create default admin user if not exists
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ('admin@whatsapp.com', '$2b$10$8Kx4AOelP3gNJBUaWZwPaO1MfBkN7cHmVJ.bRo1w7LfCY1S.dYDcq', 'Administrator')
         ON CONFLICT (email) DO NOTHING`
    ];
    
    for (const query of queries) {
        try {
            await pool.query(query);
        } catch (error) {
            console.error('Error creating table:', error);
            throw error;
        }
    }
    
    console.log('✅ Database tables created/verified');
}

function getDB() {
    if (!pool) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return pool;
}

module.exports = {
    connectDB,
    getDB
};

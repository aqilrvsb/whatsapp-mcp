-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Base64 encoded password
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create user_devices table
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    jid VARCHAR(255),
    status VARCHAR(50) DEFAULT 'offline', -- online, offline, connecting
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_data TEXT, -- Store WhatsApp session data
    UNIQUE(user_id, jid)
);

-- Create user_sessions table (for cookie sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create message_analytics table (NO message storage, only analytics)
CREATE TABLE IF NOT EXISTS message_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES user_devices(id) ON DELETE SET NULL,
    message_id VARCHAR(255) NOT NULL,
    jid VARCHAR(255) NOT NULL,
    content TEXT, -- Optional, can be left empty for privacy
    is_from_me BOOLEAN DEFAULT false,
    status VARCHAR(50) NOT NULL, -- sent, delivered, read, replied
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id)
);

-- Create leads table (Phase 2)
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES user_devices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    niche VARCHAR(255),
    journey TEXT,
    status VARCHAR(50) DEFAULT 'new',
    last_interaction TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create campaigns table (Phase 2)
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,    message TEXT NOT NULL,
    niche VARCHAR(255),
    image_url TEXT,
    scheduled_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, campaign_date)
);

-- Create whatsapp_chats table (for storing chat list)
CREATE TABLE IF NOT EXISTS whatsapp_chats (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    chat_jid VARCHAR(255) NOT NULL,
    chat_name VARCHAR(255) NOT NULL,
    is_group BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    last_message_text TEXT,
    last_message_time TIMESTAMP,
    unread_count INTEGER DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, chat_jid)
);

-- Create whatsapp_messages table (for storing message history)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    chat_jid VARCHAR(255) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    sender_jid VARCHAR(255),
    sender_name VARCHAR(255),
    message_text TEXT,
    message_type VARCHAR(50), -- text, image, video, document, etc
    media_url TEXT,    is_sent BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(device_id, message_id)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_status ON user_devices(status);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_message_analytics_user_id ON message_analytics(user_id);
CREATE INDEX idx_message_analytics_device_id ON message_analytics(device_id);
CREATE INDEX idx_message_analytics_created_at ON message_analytics(created_at);
CREATE INDEX idx_message_analytics_status ON message_analytics(status);
CREATE INDEX idx_leads_device_id ON leads(device_id);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_date ON campaigns(campaign_date);
CREATE INDEX idx_whatsapp_chats_device_id ON whatsapp_chats(device_id);
CREATE INDEX idx_whatsapp_chats_updated ON whatsapp_chats(updated_at DESC);
CREATE INDEX idx_whatsapp_messages_device_chat ON whatsapp_messages(device_id, chat_jid);
CREATE INDEX idx_whatsapp_messages_timestamp ON whatsapp_messages(timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON user_devices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_analytics_updated_at BEFORE UPDATE ON message_analytics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_chats_updated_at BEFORE UPDATE ON whatsapp_chats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (base64 encoded password: changeme123 = Y2hhbmdlbWUxMjM=)
INSERT INTO users (email, full_name, password_hash, is_active)
VALUES ('admin@whatsapp.com', 'Administrator', 'Y2hhbmdlbWUxMjM=', true)
ON CONFLICT (email) DO NOTHING;
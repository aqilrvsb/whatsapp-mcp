-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    niche VARCHAR(100),
    message TEXT NOT NULL,
    image_url TEXT,
    scheduled_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_campaigns_user_date ON campaigns(user_id, campaign_date);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Add status check constraint
ALTER TABLE campaigns ADD CONSTRAINT check_campaign_status 
CHECK (status IN ('scheduled', 'sending', 'delivered', 'failed', 'cancelled'));

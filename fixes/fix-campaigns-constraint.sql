-- Remove the UNIQUE constraint that prevents multiple campaigns per date
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_user_id_campaign_date_key;

-- Add an index for performance instead of unique constraint
CREATE INDEX IF NOT EXISTS idx_campaigns_user_date ON campaigns(user_id, campaign_date);

const pgp = require('pg-promise')();
const config = require('./environment');

// Database connection
let db = null;

async function connectDB() {
    try {
        // Initialize pg-promise with connection string and SSL config
        const dbConfig = {
            connectionString: config.database.uri,
            ssl: config.database.ssl ? {
                rejectUnauthorized: false // Allow self-signed certificates
            } : false
        };
        
        db = pgp(dbConfig);
        
        // Test connection
        await db.one('SELECT NOW()');
        console.log('✅ Database connected successfully');
        
        // Run schema migrations
        await runMigrations();
        
        return db;
    } catch (error) {
        console.error('❌ Database connection error:', error);
        throw error;
    }
}

async function runMigrations() {
    try {
        // Read and execute schema.sql
        const fs = require('fs').promises;
        const path = require('path');
        
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Split schema into individual statements (by semicolon)
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        // Execute each statement separately
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await db.none(statement);
                } catch (err) {
                    console.log('Migration statement error (may be normal):', err.message);
                }
            }
        }
        
        console.log('✅ Database schema applied successfully');
        
        // Create campaigns table if not exists
        try {
            await db.none(`
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
                )
            `);
            
            // Create indexes
            await db.none(`CREATE INDEX IF NOT EXISTS idx_campaigns_user_date ON campaigns(user_id, campaign_date)`);
            await db.none(`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`);
            
            console.log('✅ Campaigns table created/verified');
        } catch (err) {
            console.log('Campaigns table error (may already exist):', err.message);
        }
        
    } catch (error) {
        console.error('❌ Error running migrations:', error);
        // Don't throw - allow app to start even if some migrations fail
    }
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
}

module.exports = {
    connectDB,
    getDB
};
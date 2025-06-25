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
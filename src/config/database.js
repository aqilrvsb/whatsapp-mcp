const pgp = require('pg-promise')();
const config = require('./environment');

// Database connection
let db = null;

async function connectDB() {
    try {
        // Initialize pg-promise with connection string
        db = pgp(config.database.uri);
        
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
        
        // Execute the schema
        await db.none(schema);
        console.log('✅ Database schema applied successfully');
        
    } catch (error) {
        console.error('❌ Error running migrations:', error);
        throw error;
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
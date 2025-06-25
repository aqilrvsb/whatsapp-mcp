const pgp = require('pg-promise')();
const fs = require('fs').promises;
const path = require('path');

async function migrate() {
    // Get database URL from environment
    const dbUrl = process.env.DB_URI || process.env.DATABASE_URL;
    
    if (!dbUrl) {
        console.error('❌ No database URL found. Set DB_URI or DATABASE_URL environment variable.');
        process.exit(1);
    }
    
    console.log('🔄 Connecting to database...');
    
    // Connect with SSL support
    const db = pgp({
        connectionString: dbUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });
    
    try {
        // Test connection
        await db.one('SELECT NOW()');
        console.log('✅ Connected to database');
        
        // Read schema
        console.log('📄 Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Split into individual statements
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        console.log(`🔧 Running ${statements.length} SQL statements...`);
        
        let success = 0;
        let skipped = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i].trim();
            if (stmt) {
                try {
                    await db.none(stmt);
                    console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
                    success++;
                } catch (err) {
                    if (err.message.includes('already exists')) {
                        console.log(`⏭️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
                        skipped++;
                    } else {
                        console.error(`❌ Statement ${i + 1}/${statements.length} failed:`, err.message);
                    }
                }
            }
        }
        
        console.log(`\n✅ Migration complete! ${success} executed, ${skipped} skipped`);
        
        // Check if admin user was created
        const adminUser = await db.oneOrNone("SELECT email FROM users WHERE email = 'admin@whatsapp.com'");
        if (adminUser) {
            console.log('👤 Admin user exists: admin@whatsapp.com / changeme123');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        pgp.end();
    }
}

// Run migration
migrate();
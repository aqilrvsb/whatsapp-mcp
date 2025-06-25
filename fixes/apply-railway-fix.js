const { Pool } = require('pg');
require('dotenv').config();

async function applyRailwayDatabaseFix() {
    console.log('🚀 Applying database fix to Railway PostgreSQL...\n');
    
    const pool = new Pool({
        connectionString: process.env.DB_URI,
        ssl: {
            rejectUnauthorized: false,
            sslmode: 'require'
        }
    });

    try {
        // First, check if the constraint exists
        console.log('📋 Checking for existing constraints...');
        const constraintCheck = await pool.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'campaigns' 
            AND constraint_type = 'UNIQUE'
        `);
        
        if (constraintCheck.rows.length > 0) {
            console.log('Found constraints:', constraintCheck.rows.map(r => r.constraint_name).join(', '));
            
            // Remove the unique constraint
            console.log('\n🔧 Removing unique constraint...');
            try {
                await pool.query('ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_user_id_campaign_date_key');
                console.log('✅ Unique constraint removed successfully');
            } catch (err) {
                console.log('⚠️  Constraint might already be removed:', err.message);
            }
        } else {
            console.log('✅ No unique constraints found - already fixed!');
        }
        
        // Add index for performance
        console.log('\n📊 Adding performance index...');
        try {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_campaigns_user_date ON campaigns(user_id, campaign_date)');
            console.log('✅ Performance index added');
        } catch (err) {
            console.log('⚠️  Index might already exist:', err.message);
        }
        
        // Verify the fix
        console.log('\n🔍 Verifying fix...');
        const verifyCheck = await pool.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'campaigns' 
            AND constraint_type = 'UNIQUE'
        `);
        
        if (verifyCheck.rows.length === 0) {
            console.log('✅ Fix verified - No unique constraints on campaigns table');
            console.log('✅ You can now create multiple campaigns per date!');
        } else {
            console.log('⚠️  Some constraints still exist:', verifyCheck.rows);
        }
        
        // Test by checking if we can see the campaigns table structure
        console.log('\n📊 Campaigns table structure:');
        const tableInfo = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'campaigns'
            ORDER BY ordinal_position
        `);
        
        console.table(tableInfo.rows);
        
    } catch (error) {
        console.error('❌ Error applying fix:', error);
        console.error('Details:', error.message);
    } finally {
        await pool.end();
        console.log('\n✨ Database fix process completed!');
    }
}

// Run the fix
applyRailwayDatabaseFix();

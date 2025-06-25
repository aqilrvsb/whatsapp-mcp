// Test script to verify WhatsApp MCP fixes
const { connectDB, getDB } = require('../src/config/database');

async function testFixes() {
    console.log('🧪 Testing WhatsApp MCP Fixes...\n');
    
    try {
        // Connect to database
        await connectDB();
        const db = getDB();
        console.log('✅ Database connected');
        
        // Test 1: Check if campaign constraint is removed
        console.log('\n📋 Test 1: Campaign Constraint Check');
        const constraints = await db.manyOrNone(`
            SELECT con.conname
            FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'campaigns'
            AND con.contype = 'u'
        `);
        
        const hasUniqueConstraint = constraints.some(c => 
            c.conname === 'campaigns_user_id_campaign_date_key'
        );
        
        if (!hasUniqueConstraint) {
            console.log('✅ Campaign unique constraint removed - Multiple campaigns per date allowed');
        } else {
            console.log('❌ Campaign unique constraint still exists - Run: psql -U postgres -d whatsapp_mcp -f fixes/fix-campaigns-constraint.sql');
        }
        
        // Test 2: Check session directory structure
        console.log('\n📁 Test 2: Session Directory Check');
        const fs = require('fs').promises;
        const path = require('path');
        const sessionsDir = path.join(__dirname, '../sessions');
        
        try {
            await fs.access(sessionsDir);
            console.log('✅ Sessions directory exists');
            
            // Check if it's writable
            await fs.writeFile(path.join(sessionsDir, 'test.txt'), 'test');
            await fs.unlink(path.join(sessionsDir, 'test.txt'));
            console.log('✅ Sessions directory is writable');
        } catch (error) {
            console.log('❌ Sessions directory issue:', error.message);
        }
        
        // Test 3: Check Baileys dependency
        console.log('\n📦 Test 3: Dependencies Check');
        try {
            require('@whiskeysockets/baileys');
            console.log('✅ Baileys WhatsApp library installed');
        } catch (error) {
            console.log('❌ Baileys not installed - Run: npm install');
        }
        
        try {
            require('qrcode');
            console.log('✅ QRCode library installed');
        } catch (error) {
            console.log('❌ QRCode not installed - Run: npm install');
        }
        
        // Test 4: Check if WhatsApp manager can be initialized
        console.log('\n🔧 Test 4: WhatsApp Manager Check');
        try {
            const { WhatsAppManager } = require('../src/whatsapp/deviceManager');
            const manager = new WhatsAppManager(null); // Pass null for io in test
            console.log('✅ WhatsApp Manager initialized successfully');
        } catch (error) {
            console.log('❌ WhatsApp Manager initialization error:', error.message);
        }
        
        // Test 5: Database tables check
        console.log('\n🗄️ Test 5: Database Tables Check');
        const tables = await db.manyOrNone(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        const requiredTables = ['users', 'user_devices', 'campaigns', 'user_sessions'];
        const existingTables = tables.map(t => t.tablename);
        
        requiredTables.forEach(table => {
            if (existingTables.includes(table)) {
                console.log(`✅ Table '${table}' exists`);
            } else {
                console.log(`❌ Table '${table}' missing`);
            }
        });
        
        console.log('\n✨ Test Summary:');
        console.log('- Database connectivity: OK');
        console.log('- Run the campaign fix SQL if not already done');
        console.log('- Make sure to restart the server after fixes');
        console.log('- Clear sessions directory if switching between users');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        process.exit(0);
    }
}

// Run tests
testFixes();

// Test script to verify QR code generation
const { WhatsAppManager } = require('../src/whatsapp/deviceManager');
const QRCode = require('qrcode');

async function testQRGeneration() {
    console.log('🧪 Testing QR Code Generation...\n');
    
    try {
        // Test 1: Generate a test QR code
        console.log('📱 Test 1: Generating test QR code...');
        const testData = '2@ABC123DEF456,XYZ789+/=,1234567890';
        const qrDataUrl = await QRCode.toDataURL(testData, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            scale: 8
        });
        
        console.log('✅ QR code generated successfully');
        console.log('📊 Data URL length:', qrDataUrl.length);
        console.log('🔗 First 100 chars:', qrDataUrl.substring(0, 100) + '...');
        
        // Test 2: Check WhatsApp Manager initialization
        console.log('\n🔧 Test 2: WhatsApp Manager check...');
        const manager = new WhatsAppManager(null);
        console.log('✅ WhatsApp Manager can be initialized');
        
        // Test 3: Verify Baileys is installed
        console.log('\n📦 Test 3: Checking Baileys installation...');
        try {
            const baileys = require('@whiskeysockets/baileys');
            console.log('✅ Baileys is installed');
            console.log('📦 Baileys exports:', Object.keys(baileys).slice(0, 5).join(', ') + '...');
        } catch (error) {
            console.log('❌ Baileys not found:', error.message);
        }
        
        console.log('\n✨ QR Code generation test completed!');
        console.log('\nTo fix QR issues:');
        console.log('1. Ensure Socket.io is properly connected');
        console.log('2. Check browser console for errors');
        console.log('3. Verify WhatsApp Manager is initialized on server start');
        console.log('4. Make sure sessions directory is writable');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run test
testQRGeneration();

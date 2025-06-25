module.exports = {
    // Server configuration
    port: process.env.PORT || 8080,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Database configuration
    database: {
        uri: process.env.DB_URI || 'postgresql://postgres:password@localhost:5432/whatsapp_mcp',
        ssl: process.env.NODE_ENV === 'production',
        poolSize: 10
    },
    
    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    
    // WhatsApp configuration
    whatsapp: {
        maxDevicesPerUser: parseInt(process.env.WHATSAPP_MAX_DEVICES) || 50,
        sessionPath: process.env.WHATSAPP_SESSION_PATH || './sessions',
        logLevel: process.env.WHATSAPP_LOG_LEVEL || 'INFO',
        reconnectInterval: 5000, // 5 seconds
        maxReconnectAttempts: 5
    },
    
    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    },
    
    // Basic auth for admin (from original project)
    basicAuth: process.env.APP_BASIC_AUTH || 'admin:changeme123'
};

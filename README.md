# WhatsApp Analytics Multi-Device Dashboard (MCP Edition)

**Last Updated: June 26, 2025 - 10:30 AM**  
**Latest Development: Added missing UI components and fixed deployment**  
**Railway App**: whatsapp-mcp-production-a15a.up.railway.app (deploying...)

## 🚀 Project Overview

This is a complete rebuild of the WhatsApp Analytics Dashboard using the `whatsapp-mcp` architecture. It combines the simplicity of real-time WhatsApp reading with enterprise features like multi-user support, device management, and analytics.

### Key Features:
- ✅ **Multi-User System** - Multiple users with separate accounts
- ✅ **Multi-Device Support** - Each user can connect up to 50 WhatsApp devices
- ✅ **Real-time Message Reading** - No database syncing, reads directly from WhatsApp
- ✅ **Analytics Dashboard** - Track messages sent/received per device
- ✅ **Broadcast System** - Send bulk messages with rate limiting
- ✅ **Message Viewing** - WhatsApp Web-like interface for reading chats
- ✅ **MCP Ready** - Built for AI/LLM integration
- ✅ **No Message Storage** - Privacy-focused, no messages stored in database

## 📝 Development Log

### June 26, 2025 - 10:30 AM - UI Complete & Deployment Fixed
- ✅ Added messages.html - Complete WhatsApp chat interface
- ✅ Added broadcast.html - Bulk messaging interface
- ✅ Fixed deployment issues (added Dockerfile)
- ✅ Added missing dependencies (ejs, @hapi/boom)
- ✅ Updated navigation between pages
- ✅ All major features now implemented

### June 26, 2025 - 10:00 AM - Initial Build
- Created complete Node.js/Express application
- Implemented user authentication system
- Built WhatsApp device manager using Baileys
- Created dashboard UI (ported from Go project)
- Set up PostgreSQL database schema
- Implemented real-time updates with Socket.io
- Configured for Railway deployment

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Railway App (Node.js)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │   Web Server    │  │   WhatsApp Bridge Manager   │  │
│  │   (Express)     │  │   (Baileys connections)     │  │
│  │                 │  │                             │  │
│  │ - User Auth     │  │ - Device connections        │  │
│  │ - Dashboard     │  │ - Real-time message read    │  │
│  │ - Device Mgmt   │  │ - Contact sync              │  │
│  │ - Analytics     │  │ - No message storage        │  │
│  └─────────────────┘  └─────────────────────────────┘  │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │              PostgreSQL (Railway)                │   │
│  │                                                  │   │
│  │  - Users & authentication                       │   │
│  │  - Device configurations                        │   │
│  │  - Analytics & statistics                       │   │
│  │  - NO message storage (privacy-focused)         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Railway account (for deployment)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/aqilrvsb/whatsapp-mcp.git
cd whatsapp-mcp
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. **Start the server**
```bash
npm start
# Or for development with auto-reload
npm run dev
```

5. **Access the application**
```
http://localhost:8080
Default login: admin@whatsapp.com / changeme123
```

## 🔧 Environment Variables

```env
# Database (Railway PostgreSQL)
DB_URI=postgresql://postgres:password@host:port/database?sslmode=require

# App Configuration  
PORT=8080
NODE_ENV=production
SESSION_SECRET=your-secret-key-change-this

# WhatsApp Configuration
WHATSAPP_MAX_DEVICES=50
WHATSAPP_SESSION_PATH=./sessions
WHATSAPP_LOG_LEVEL=INFO

# Basic Auth (optional)
APP_BASIC_AUTH=admin:changeme123
```

## 📦 API Documentation

### Authentication Endpoints
```
POST   /api/auth/register     # Register new user
POST   /api/auth/login        # User login
POST   /api/auth/logout       # User logout
GET    /api/auth/session      # Check session
```

### Device Management
```
GET    /api/devices           # List user devices
POST   /api/devices           # Add new device
GET    /api/devices/:id       # Get device details
DELETE /api/devices/:id       # Delete device
GET    /api/devices/:id/qr    # Get QR code for connection
POST   /api/devices/:id/logout # Logout WhatsApp device
```

### Message Operations
```
GET    /api/devices/:id/chats       # Get chat list (real-time)
GET    /api/devices/:id/contacts    # Get contacts
GET    /api/messages/:deviceId/chat/:chatId  # Get messages from chat
POST   /api/messages/:deviceId/send          # Send message
POST   /api/messages/:deviceId/broadcast     # Send bulk messages
```

### Analytics
```
GET    /api/analytics/dashboard     # Dashboard statistics
GET    /api/analytics/devices       # Device performance
GET    /api/analytics/campaigns     # Broadcast campaigns
```

## 🗄️ Database Schema

```sql
-- Users (authentication)
users
├── id (UUID, PK)
├── email (unique)
├── password_hash
├── full_name
└── created_at

-- Devices (WhatsApp connections)
user_devices
├── id (UUID, PK)
├── user_id (FK)
├── device_name
├── phone
├── jid
├── status
└── session_data

-- Analytics (statistics only, no messages)
message_analytics
├── id
├── user_id (FK)
├── device_id (FK)
├── date
├── messages_sent
├── messages_received
└── contacts_messaged

-- Campaigns (broadcast history)
campaigns
├── id (UUID, PK)
├── user_id (FK)
├── name
├── message
├── recipients_count
├── sent_count
├── status
└── created_at
```

## 🚀 Railway Deployment

1. **Fork/Clone to your GitHub**
2. **Create new project in Railway**
3. **Connect GitHub repository**
4. **Add PostgreSQL database**
5. **Set environment variables**
6. **Deploy!**

Railway will auto-deploy on every push to main branch.

## 🛠️ Development Guidelines

### After Making Changes:

1. **Test locally first**
```bash
npm run dev
```

2. **Update this README**
- Add what you changed
- Update the "Last Updated" date
- Document any new features

3. **Commit with clear message**
```bash
git add -A
git commit -m "Clear description of what was changed"
```

4. **Push to main for auto-deploy**
```bash
git push origin main
```

### Code Structure:
```
src/
├── server.js           # Main Express server
├── config/            
│   ├── database.js     # PostgreSQL connection
│   └── environment.js  # Environment config
├── whatsapp/
│   └── deviceManager.js # WhatsApp device handler
├── routes/
│   ├── auth.js         # Authentication routes
│   ├── devices.js      # Device management
│   ├── messages.js     # Message operations
│   └── analytics.js    # Analytics routes
└── views/
    ├── login.html      # Login page
    ├── register.html   # Registration page
    └── dashboard.html  # Main dashboard
```

## 🔄 Differences from Original Go Version

| Feature | Go Version | MCP Version |
|---------|------------|-------------|
| Message Storage | Stored in database | Real-time only |
| Architecture | Complex syncing | Simple direct read |
| Multi-device | Single global client | True multi-device |
| Performance | Heavy database ops | Lightweight |
| Privacy | Stores all messages | No message storage |

## 🐛 Known Issues & Solutions

### Issue: Deployment healthcheck failing
**Solution**: Removed healthcheck from railway.json, using Dockerfile instead

### Issue: QR Code not appearing
**Solution**: Check browser console, ensure device ID is being passed correctly

### Issue: Messages not loading
**Solution**: WhatsApp needs a few seconds after connection to sync

### Issue: Device shows offline but is connected
**Solution**: Refresh the page, check Railway logs

## ✅ Completed Features

All major features from the original Go project have been successfully ported:

1. **User Authentication** ✅
   - Login/Register system
   - Session management
   - Password hashing with bcrypt

2. **Device Management** ✅
   - Add/Delete devices
   - QR code scanning
   - Real-time status updates
   - Multi-device support per user

3. **Message Interface** ✅
   - WhatsApp Web-like chat view
   - Real-time message reading
   - Send messages
   - Search functionality

4. **Broadcast System** ✅
   - Bulk message sending
   - Contact import
   - Campaign tracking
   - Rate limiting to prevent bans

5. **Analytics Dashboard** ✅
   - Message statistics
   - Device performance
   - Daily/weekly/monthly views
   - Chart visualization

## 📈 Future Enhancements

- [ ] Media message support (images, videos)
- [ ] Scheduled messages
- [ ] Webhook support for automation
- [ ] Advanced contact management
- [ ] Export functionality (CSV/Excel)
- [ ] API rate limiting
- [ ] Comprehensive unit tests
- [ ] Docker compose for local development

## 🤝 Contributing

1. Always update README after changes
2. Test locally before pushing
3. Use clear commit messages
4. Document new features
5. Keep privacy in mind - no message storage!

## 📝 License

MIT License - See LICENSE file

## 🙏 Credits

- Original [whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) for inspiration
- [Baileys](https://github.com/WhiskeySockets/Baileys) for WhatsApp Web API
- Original Go project for UI design

---

**Remember**: After any development or fixes, always update this README to keep track of changes!
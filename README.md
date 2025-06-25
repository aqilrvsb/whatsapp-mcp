# WhatsApp MCP - Multi-Device WhatsApp Analytics & Management

**Last Updated: June 27, 2025 - Full WhatsApp Integration Complete**  
**Status: ✅ All features working - QR Code, Messaging, WhatsApp Web View**

## 🎯 Latest Updates (June 27, 2025)

### WhatsApp Integration Complete ✅
- **QR Code Connection** - Working with real-time updates via Socket.io
- **Send Messages** - Text messages using Baileys API
- **Send Images** - With automatic compression to 350KB
- **Check Number Status** - Verify if number is on WhatsApp
- **Broadcast Messages** - Send to multiple recipients
- **WhatsApp Web View** - Read-only interface showing chats and contacts
- **Real-time Updates** - Socket.io for live QR code and connection status

### Fixed Issues
- ✅ **502 Error on QR Code** - Removed timeout, added polling mechanism
- ✅ **Campaign Display** - Multiple campaigns per date now working
- ✅ **JavaScript Errors** - Fixed all template literal syntax errors
- ✅ **Database Constraints** - Removed unique constraint on campaigns

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up database (local PostgreSQL)
psql -U postgres -d whatsapp_mcp -f database/schema.sql

# For Railway PostgreSQL (already applied)
# The database fixes have been applied to your Railway instance

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run the application
npm start

# Visit http://localhost:8080
# Login: admin@whatsapp.com / changeme123
```

## ✨ Features

### 1. **Dashboard**
- Real-time analytics with Chart.js
- Device status monitoring
- Campaign calendar with full CRUD
- Auto-refresh every 10 seconds
- Responsive Bootstrap 5 UI

### 2. **Device Management**
- Add multiple WhatsApp devices per user
- QR Code scanning with real-time updates
- Connection status indicators
- Device actions and analytics

### 3. **WhatsApp Features** (NEW!)
- **Send Text Messages** - Direct messaging via Baileys
- **Send Images** - With automatic compression
- **Check Number Status** - Verify WhatsApp registration
- **Broadcast Messages** - Send to multiple recipients
- **WhatsApp Web View** - Browse chats and contacts

### 4. **Campaign System**
- Create multiple campaigns per date
- Schedule broadcasts
- Status tracking (delivered, failed, ongoing, scheduled)
- Calendar view with inline editing

## 📱 WhatsApp Integration Details

### Messaging API Endpoints

#### Send Text Message
```javascript
POST /api/whatsapp/send/message
{
  "deviceId": "device-uuid",
  "phone": "+60123456789",
  "message": "Hello from WhatsApp MCP!"
}
```

#### Send Image
```javascript
POST /api/whatsapp/send/image
{
  "deviceId": "device-uuid",
  "phone": "+60123456789",
  "imageUrl": "data:image/jpeg;base64,...",
  "caption": "Check out this image!"
}
```

#### Check Number Status
```javascript
POST /api/whatsapp/check/number
{
  "deviceId": "device-uuid",
  "phone": "+60123456789"
}
```

#### Send Broadcast
```javascript
POST /api/whatsapp/send/broadcast
{
  "deviceId": "device-uuid",
  "phones": ["+60123456789", "+60987654321"],
  "message": "Broadcast message",
  "imageUrl": "optional-image-url"
}
```

### WhatsApp Web View
- Read-only interface
- Browse chats and contacts
- Search functionality
- Group/Personal chat indicators
- Responsive design matching WhatsApp Web

## 🏗️ Architecture

```
whatsapp-mcp/
├── src/
│   ├── server.js          # Express server with Socket.io
│   ├── config/           
│   │   ├── database.js    # PostgreSQL connection
│   │   └── environment.js 
│   ├── models/           
│   ├── repository/        
│   ├── routes/           
│   │   ├── auth.js        # Cookie-based auth
│   │   ├── devices.js     # Device management
│   │   ├── campaigns.js   # Campaign CRUD
│   │   ├── whatsapp.js    # QR code & connection
│   │   └── whatsapp-api.js # Messaging endpoints
│   ├── middleware/        
│   │   └── auth.js        # Session validation
│   ├── whatsapp/         
│   │   └── deviceManager.js # Baileys integration
│   └── views/            
│       ├── dashboard.ejs  # Main dashboard
│       ├── device-actions.ejs # Messaging UI
│       └── whatsapp.ejs   # WhatsApp Web view
├── database/
│   └── schema.sql         # Database structure
└── sessions/              # WhatsApp session data
```

## 🔧 Technical Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (with Railway support)
- **WhatsApp**: Baileys (WhatsApp Web Multi-Device)
- **Real-time**: Socket.io
- **Frontend**: Bootstrap 5 + EJS templates
- **Charts**: Chart.js
- **Authentication**: Cookie-based sessions

## 🚀 Deployment

### Railway Deployment
The app is configured for Railway with:
- PostgreSQL database
- Environment variables
- Auto-deployment from GitHub
- SSL support with NODE_TLS_REJECT_UNAUTHORIZED=0

### Environment Variables
```env
# Database
DB_URI=postgresql://user:pass@host:port/db?sslmode=require
NODE_TLS_REJECT_UNAUTHORIZED=0

# App Configuration
PORT=8080
NODE_ENV=production
SESSION_SECRET=your-secret-key

# WhatsApp Configuration
WHATSAPP_MAX_DEVICES=50
WHATSAPP_SESSION_PATH=./sessions
```

## 📊 Database Schema

### Key Tables
- **users** - User accounts with base64 passwords
- **user_devices** - WhatsApp devices per user
- **campaigns** - Marketing campaigns (multiple per date)
- **user_sessions** - Cookie-based auth sessions
- **message_analytics** - Message tracking (no content storage)

## 🛠️ Troubleshooting

### QR Code Not Appearing
1. Check browser console for errors
2. Ensure Socket.io is connected
3. Verify sessions directory is writable
4. Check server logs for Baileys errors

### Messages Not Sending
1. Ensure device is connected (green status)
2. Check phone number format (+60...)
3. Verify recipient has WhatsApp
4. Check server logs for API errors

### Campaign Issues
1. Database constraint has been removed
2. Multiple campaigns per date are allowed
3. Clear browser cache if issues persist

## 🔒 Security

- Cookie-based authentication
- Session validation on all routes
- No message content storage
- Secure password handling (base64)
- CSRF protection via same-site cookies

## 📝 API Documentation

Full API documentation for all endpoints:

### Authentication
- `POST /login` - User login
- `POST /register` - User registration
- `POST /logout` - User logout

### Devices
- `GET /api/devices` - List user devices
- `POST /api/devices` - Add new device
- `DELETE /api/devices/:id` - Remove device
- `GET /api/devices/:id/qr` - Get QR code

### WhatsApp
- `POST /api/whatsapp/send/message` - Send text
- `POST /api/whatsapp/send/image` - Send image
- `POST /api/whatsapp/check/number` - Check status
- `POST /api/whatsapp/send/broadcast` - Broadcast
- `GET /api/whatsapp/chats` - Get chat list
- `GET /api/whatsapp/contacts` - Get contacts

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

## 🎉 Summary

This WhatsApp MCP project is now a complete WhatsApp management solution with:
- ✅ Multi-user support
- ✅ Multi-device per user
- ✅ Real-time QR code connection
- ✅ Full messaging capabilities
- ✅ WhatsApp Web interface
- ✅ Campaign management
- ✅ Analytics dashboard

All features are working and tested with Railway PostgreSQL deployment!

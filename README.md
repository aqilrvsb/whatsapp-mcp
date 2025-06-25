# WhatsApp MCP - Exact Duplicate of Go WhatsApp Web Multi-Device

**Last Updated: June 26, 2025 - 8:30 PM**  
**Status: Complete 1:1 duplicate of Go project in Node.js**

## 🎯 Project Mission

This is a **100% exact duplicate** of the `go-whatsapp-web-multidevice-main` project, rebuilt in Node.js. Every feature, database table, authentication method, and UI element has been copied exactly as-is from the Go project.

### What We're Currently Doing:
1. **Duplicated entire Go project structure to Node.js**
2. **Kept exact same authentication** (base64 passwords, cookie sessions)
3. **Same database schema** (PostgreSQL with all tables)
4. **Same UI/UX** (converted HTML to EJS templates)
5. **Same API endpoints** (all routes match Go project)

## 📋 Complete Feature Comparison

| Component | Go Project | This Node.js Project | Status |
|-----------|-----------|---------------------|--------|
| **Authentication** | Base64 passwords + cookies | Base64 passwords + cookies | ✅ Identical |
| **Session Management** | session_token cookie | session_token cookie | ✅ Identical |
| **Database** | PostgreSQL | PostgreSQL | ✅ Identical |
| **Password Storage** | Base64 encoded | Base64 encoded | ✅ Identical |
| **Default Admin** | admin@whatsapp.com / changeme123 | admin@whatsapp.com / changeme123 | ✅ Identical |
| **Repository Pattern** | UserRepository | UserRepository | ✅ Identical |
| **Multi-User** | Yes | Yes | ✅ Identical |
| **Multi-Device** | 50 devices/user | 50 devices/user | ✅ Identical |
| **UI Framework** | HTML + Go templates | EJS templates | ✅ Same UI |
| **WhatsApp API** | go-whatsapp | Baileys | ⚠️ Different lib |

## 🗂️ Database Schema (Exact Copy)

```sql
-- Users table (with base64 password_hash)
users (id, email, full_name, password_hash, is_active, created_at, updated_at, last_login)

-- Sessions table (for cookies)
user_sessions (id, user_id, token, expires_at, created_at)

-- Devices table
user_devices (id, user_id, device_name, phone, jid, status, last_seen, created_at, updated_at, session_data)

-- Analytics table
message_analytics (id, user_id, device_id, message_id, jid, content, is_from_me, status, created_at, updated_at)

-- Phase 2 tables
leads (id, device_id, user_id, name, phone, niche, journey, status, last_interaction, created_at, updated_at)
campaigns (id, user_id, campaign_date, title, message, niche, image_url, scheduled_time, status, created_at, updated_at)
whatsapp_chats (id, device_id, chat_jid, chat_name, is_group, is_muted, last_message_text, last_message_time, unread_count, avatar_url)
whatsapp_messages (id, device_id, chat_jid, message_id, sender_jid, sender_name, message_text, message_type, media_url, is_sent, is_read, timestamp)
```

## 🔐 Authentication System (Exact Copy)

### Password Storage:
```javascript
// Exactly like Go project - Base64 encoding
const encodedPassword = Buffer.from(password).toString('base64');
// Example: "changeme123" → "Y2hhbmdlbWUxMjM="
```

### Cookie Sessions:
```javascript
// Set cookie exactly like Go
res.cookie('session_token', session.token, {
    expires: session.expiresAt,  // 24 hours
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
});
```

## 📁 Project Structure (Matching Go)

```
whatsapp-mcp-main/
├── src/
│   ├── server.js          # Main server (like Go main.go)
│   ├── config/           
│   │   ├── database.js    # DB connection (like Go database/connection.go)
│   │   └── environment.js # Config (like Go config/)
│   ├── models/            # Data models (like Go models/)
│   ├── repository/        # Repository pattern (like Go repository/)
│   │   └── userRepository.js
│   ├── routes/            # API routes (like Go ui/rest/)
│   │   ├── auth.js        # Login/register endpoints
│   │   ├── devices.js     # Device management
│   │   ├── messages.js    # WhatsApp operations
│   │   └── analytics.js   # Analytics endpoints
│   ├── middleware/        
│   │   └── auth.js        # Cookie auth middleware
│   ├── whatsapp/         
│   │   └── deviceManager.js # WhatsApp manager (like Go infrastructure/whatsapp/)
│   ├── views/             # EJS templates (like Go views/)
│   │   ├── login.ejs
│   │   ├── register.ejs
│   │   ├── dashboard.ejs
│   │   ├── whatsapp.ejs
│   │   ├── device-actions.ejs
│   │   └── leads.ejs
│   └── public/            # Static files (like Go statics/)
│       ├── css/
│       ├── media/
│       └── qrcode/
├── database/
│   └── schema.sql         # Complete DB schema from Go project
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── Dockerfile
└── README.md
```

## 🚀 Installation & Setup

### 1. Clone and Install
```bash
git clone https://github.com/aqilrvsb/whatsapp-mcp.git
cd whatsapp-mcp
npm install
```

### 2. Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE whatsapp_mcp;"

# Run schema (includes all tables from Go project)
psql -U postgres -d whatsapp_mcp -f database/schema.sql
```

### 3. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Run the Application
```bash
npm start
# Visit http://localhost:8080
# Login: admin@whatsapp.com / changeme123
```

## 🔄 API Endpoints (Exact Match with Go)

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new user
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/session` - Check current session

### Devices
- `GET /api/devices` - List user devices
- `POST /api/devices` - Add new device
- `GET /api/devices/:id` - Get device details
- `DELETE /api/devices/:id` - Delete device
- `GET /api/devices/:id/qr` - Show QR code page
- `POST /api/devices/:id/logout` - Logout WhatsApp
- `PUT /api/devices/:id/phone` - Update phone number

### Messages
- `GET /api/messages/:deviceId/chats` - Get chat list
- `POST /api/messages/:deviceId/send` - Send message

### Analytics
- `GET /api/analytics/dashboard` - Dashboard stats
- `GET /api/analytics/range/:range` - Time-based analytics

### Pages (Views)
- `/login` - Login page
- `/register` - Registration page
- `/dashboard` - Main dashboard
- `/device/:id/whatsapp` - WhatsApp Web viewer
- `/device/:id/actions` - Device actions/testing
- `/device/:id/leads` - Lead management

## 🚀 Deployment to GitHub & Railway

### Push to GitHub (Force Push)
```bash
# Navigate to project
cd C:\Users\ROGSTRIX\whatsapp-mcp-main

# Initialize git if needed
git init

# Add remote
git remote add origin https://github.com/aqilrvsb/whatsapp-mcp.git

# Add all files
git add -A

# Commit
git commit -m "Complete rebuild: 100% duplicate of Go project with exact same auth, DB, and UI"

# Force push to main
git push -f origin main
```

### Deploy to Railway
1. Connect GitHub repo to Railway
2. Add PostgreSQL database
3. Set environment variables:
   ```
   DB_URI=postgresql://[from railway]
   SESSION_SECRET=your-secret-key-here
   NODE_ENV=production
   PORT=8080
   ```
4. Deploy!

## ⚠️ Important Notes

1. **This is NOT a typical Node.js project** - It's an exact copy of a Go project
2. **Passwords are Base64 encoded** - Not bcrypt hashed (matching Go project)
3. **Uses cookie sessions** - Not JWT tokens (matching Go project)
4. **Database schema is identical** - All tables from Go project included
5. **UI is identical** - Same HTML/CSS, just using EJS templates

## 🔧 What's Different

Only the WhatsApp implementation differs:
- **Go Project**: Uses `go-whatsapp` library
- **This Project**: Uses `@whiskeysockets/baileys` library

Everything else is 100% identical.

## 📝 Development Status

### ✅ Completed:
- User authentication system (base64 + cookies)
- Database schema (all tables)
- Repository pattern
- All views/pages
- API endpoints
- Middleware
- Static file serving
- Package configuration

### ⚠️ Needs Testing:
- WhatsApp device connection
- QR code generation
- Message sending
- Real-time updates
- Analytics collection

## 🤝 Contributing

This project is designed to be an exact duplicate of the Go project. Any changes should maintain compatibility with the original Go implementation.

---

**Remember**: This is a direct port of `go-whatsapp-web-multidevice-main` to Node.js, keeping everything exactly the same except the WhatsApp library.
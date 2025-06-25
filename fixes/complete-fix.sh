#!/bin/bash
# Complete fix script for WhatsApp MCP issues

echo "==================================="
echo "WhatsApp MCP Complete Fix Script"
echo "==================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists psql; then
    echo -e "${RED}✗ PostgreSQL client (psql) not found${NC}"
    echo "Please install PostgreSQL first"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js first"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Step 1: Check and fix database constraint
echo -e "${YELLOW}Step 1: Checking database constraints...${NC}"
echo "Enter PostgreSQL password for user 'postgres':"
psql -U postgres -d whatsapp_mcp -t -c "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'campaigns' AND constraint_type = 'UNIQUE';" | grep -q "campaigns_user_id_campaign_date_key"

if [ $? -eq 0 ]; then
    echo -e "${YELLOW}Found unique constraint, removing it...${NC}"
    psql -U postgres -d whatsapp_mcp -f fixes/fix-campaigns-constraint.sql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database constraint fixed${NC}"
    else
        echo -e "${RED}✗ Failed to fix database constraint${NC}"
    fi
else
    echo -e "${GREEN}✓ Database constraint already fixed${NC}"
fi
echo ""

# Step 2: Clear sessions directory
echo -e "${YELLOW}Step 2: Clearing sessions directory...${NC}"
if [ -d "sessions" ]; then
    rm -rf sessions/*
    echo -e "${GREEN}✓ Sessions directory cleared${NC}"
else
    mkdir -p sessions
    echo -e "${GREEN}✓ Sessions directory created${NC}"
fi
echo ""

# Step 3: Install/update dependencies
echo -e "${YELLOW}Step 3: Checking npm dependencies...${NC}"
npm list @whiskeysockets/baileys >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Installing missing dependencies..."
    npm install
fi
echo -e "${GREEN}✓ Dependencies checked${NC}"
echo ""

# Step 4: Run tests
echo -e "${YELLOW}Step 4: Running verification tests...${NC}"
node fixes/test-fixes.js
echo ""

# Step 5: Check server port
echo -e "${YELLOW}Step 5: Checking if port 8080 is available...${NC}"
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${RED}✗ Port 8080 is already in use${NC}"
    echo "Please stop the other process or change the port in .env"
else
    echo -e "${GREEN}✓ Port 8080 is available${NC}"
fi
echo ""

echo -e "${GREEN}==================================="
echo "Fix process completed!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Start the server: npm start"
echo "2. Visit http://localhost:8080"
echo "3. Login with admin@whatsapp.com / changeme123"
echo ""
echo "If you still have issues:"
echo "- Check server logs for detailed errors"
echo "- Ensure PostgreSQL is running"
echo "- Try restarting your computer"
echo -e "${NC}"

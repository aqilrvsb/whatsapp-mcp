#!/bin/bash

echo "Installing WhatsApp Analytics MCP..."

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Create necessary directories
echo "Creating directories..."
mkdir -p sessions
mkdir -p logs

# Copy .env.example to .env if not exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please update .env with your configuration"
fi

echo "Installation complete!"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "For development:"
echo "  npm run dev"
echo ""
echo "Default login: admin@whatsapp.com / changeme123"

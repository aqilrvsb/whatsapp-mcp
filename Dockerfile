FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p sessions logs

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

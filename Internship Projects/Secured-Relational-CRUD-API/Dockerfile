FROM node:22-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose server port
EXPOSE 3002

# Set production environment
ENV NODE_ENV=production
ENV PORT=3002

# Run migration and start server
CMD ["node", "src/server.js"]

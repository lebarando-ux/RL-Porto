# Secure, production-ready lightweight Alpine Node.js base
FROM node:20-alpine

# Set secure working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy package dependency configuration files first to exploit Docker layer caching
COPY package*.json ./

# Install production-only dependencies strictly and securely
RUN npm ci --only=production && npm cache clean --force

# Copy all source files and assets (excluding files matching .gitignore)
COPY . .

# Expose default HTTP port
EXPOSE 3000

# Run the server under a non-root system user for production security hardening
USER node

# Start the Node.js Express server using standard npm script
CMD ["npm", "start"]

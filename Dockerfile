# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source files and config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM lscr.io/linuxserver/wireguard:1.0.20250521

# Install Node.js and libcap (for setcap)
RUN apk add --no-cache nodejs npm libcap

# Give wg binary CAP_NET_ADMIN capability so abc user can run it
RUN setcap cap_net_admin+ep /usr/bin/wg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create s6 service for Node.js app
RUN mkdir -p /etc/s6-overlay/s6-rc.d/nodejs-app
COPY docker/s6-nodejs-app/run /etc/s6-overlay/s6-rc.d/nodejs-app/run
COPY docker/s6-nodejs-app/finish /etc/s6-overlay/s6-rc.d/nodejs-app/finish
COPY docker/s6-nodejs-app/type /etc/s6-overlay/s6-rc.d/nodejs-app/type
RUN chmod +x /etc/s6-overlay/s6-rc.d/nodejs-app/run && \
    chmod +x /etc/s6-overlay/s6-rc.d/nodejs-app/finish

# Create service dependencies (ensures it starts after base services)
RUN mkdir -p /etc/s6-overlay/s6-rc.d/nodejs-app/dependencies.d && \
    touch /etc/s6-overlay/s6-rc.d/nodejs-app/dependencies.d/base

# Add service to default bundle so it starts automatically
RUN mkdir -p /etc/s6-overlay/s6-rc.d/user/contents.d && \
    ln -s /etc/s6-overlay/s6-rc.d/nodejs-app /etc/s6-overlay/s6-rc.d/user/contents.d/nodejs-app || true

# Expose port
EXPOSE 3000

# Keep the original entrypoint from base image (s6-overlay init)
# ENTRYPOINT is already set to ["/init"] in the base image
# This ensures both WireGuard and Node.js app start via s6-overlay

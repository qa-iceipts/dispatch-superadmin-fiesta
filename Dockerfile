# ==============================================================================
# Stage 1: Build & Dependency Installation
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first to leverage Docker build cache
COPY package*.json ./

# Install ONLY production dependencies to keep the final image minimal
# Clean cache immediately to keep the layer small
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force


# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

# Optimize Node.js runtime for production (disables debug logging, enables optimization features in Express/Sequelize)
ENV NODE_ENV=production
ENV PORT=9000

WORKDIR /app

# Copy production node_modules from builder stage and assign ownership to the non-root 'node' user
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy source code and assign ownership to the non-root 'node' user
COPY --chown=node:node . .

# Use the pre-existing non-root 'node' user for security
USER node

# Expose port
EXPOSE 9000

# Health check to monitor container health using the built-in HTTP module (avoids installing curl/wget)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 9000) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# Execute node directly (PID 1) to ensure proper forwarding of SIGTERM/SIGINT signals
CMD ["node", "server.js"]


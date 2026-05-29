# ──────────────────────────────────────────────────────────────────────────────
# NyayaSetu API Server — Dockerfile
# Multi-stage: 'development' target keeps devDeps + nodemon hot-reload
#              'production'  target is lean, no devDeps, no shell
# ──────────────────────────────────────────────────────────────────────────────

# ── Base ───────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install OS-level packages needed at runtime (canvas deps, etc.)
RUN apk add --no-cache \
    dumb-init \
    libc6-compat

WORKDIR /app

# Copy dependency manifests first for Docker layer caching
COPY package*.json ./

# ── Development ────────────────────────────────────────────────────────────────
FROM base AS development

ENV NODE_ENV=development

# Install all deps (including devDependencies for nodemon, jest, etc.)
RUN npm ci

# Copy source — in docker-compose, the host ./server is bind-mounted over this
# so changes are reflected without rebuilding the image
COPY . .

# Create logs directory
RUN mkdir -p logs

EXPOSE 5000

# dumb-init ensures signals propagate correctly to Node (enables graceful shutdown)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

# ── Production ─────────────────────────────────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Create logs directory
RUN mkdir -p logs

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S -u 1001 -G nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

# ── Worker (production) ────────────────────────────────────────────────────────
# Same image, different entry point. Override CMD at deploy time:
#   docker run <image> node src/worker/worker.js
# On Railway/Render: set Start Command = "node src/worker/worker.js"
FROM production AS worker
CMD ["node", "src/worker/worker.js"]

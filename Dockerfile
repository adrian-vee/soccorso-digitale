# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Type-check and build the server
RUN npx tsc --noEmit --project tsconfig.server.json
RUN npm run server:build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install wget for the HEALTHCHECK command
RUN apk add --no-cache wget

# Copy only production artifacts
COPY --from=builder /app/server_dist ./server_dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy server-side templates and static assets needed at runtime
COPY --from=builder /app/server/templates ./server/templates
COPY --from=builder /app/admin/public ./admin/public
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/site ./site

# Create upload directories (preserved by .gitkeep but need to exist in container)
RUN mkdir -p uploads/apk uploads/logos uploads/signatures

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server_dist/index.js"]

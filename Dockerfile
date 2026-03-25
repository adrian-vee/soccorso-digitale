# ── Stage 1: Express Builder ──────────────────────────────────────────────────
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

# ── Stage 2: Dashboard Static Builder ─────────────────────────────────────────
FROM node:18-alpine AS dashboard-builder

WORKDIR /app/dashboard

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_PUBLIC_SUPABASE_URL=https://utafppoxmgaskwyrsdnu.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0YWZwcG94bWdhc2t3eXJzZG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTA0NjIsImV4cCI6MjA4OTkyNjQ2Mn0.O1ZoA1tb70vNKYKe0gDthctJMvPRJZUXhYqy221Er9E

RUN npm run build

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
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

# Copy Next.js static export → served at /dashboard by Express
COPY --from=dashboard-builder /app/dashboard/out ./dashboard-static

# Create upload directories with full subtree needed by APK chunked upload
RUN mkdir -p uploads/apk/temp/chunks uploads/logos uploads/signatures

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Give the nodejs user write access to uploads before switching
RUN chown -R nodejs:nodejs uploads

USER nodejs

ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server_dist/index.js"]

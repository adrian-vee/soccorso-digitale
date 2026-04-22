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

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Install wget (HEALTHCHECK) + Python3 + pdfplumber (PDF table extraction)
RUN apk add --no-cache wget python3 py3-pip && \
    pip install pdfplumber --break-system-packages --quiet

# Copy only production artifacts
COPY --from=builder /app/server_dist ./server_dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy server-side templates, scripts and static assets needed at runtime
COPY --from=builder /app/server/templates ./server/templates
COPY --from=builder /app/server/scripts ./server/scripts
COPY --from=builder /app/admin/public ./admin/public
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/site ./site
COPY --from=builder /app/conicorn ./conicorn

# Create upload directories (fallback when no Railway Volume is mounted).
# When a Railway Volume is mounted at /app/uploads these layer directories are
# shadowed by the volume, so the server's own mkdir calls handle sub-dirs.
RUN mkdir -p uploads/apk/temp/chunks uploads/logos uploads/signatures uploads/document-attachments

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Give the nodejs user write access to uploads before switching
RUN chown -R nodejs:nodejs uploads

USER nodejs

# UPLOADS_DIR: override to point to a Railway Volume mount path.
# Example Railway env: UPLOADS_DIR=/app/uploads  (matches Volume mount path)
ENV NODE_ENV=production
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "server_dist/index.js"]

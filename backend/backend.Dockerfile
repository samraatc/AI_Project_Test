# ============================================================
# EstimateOS Backend — Production Dockerfile
# ============================================================
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production
WORKDIR /app

# Install Chromium for Puppeteer (PDF generation) + other runtime deps
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to use installed Chromium instead of downloading
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled dist from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Switch to non-root
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main"]

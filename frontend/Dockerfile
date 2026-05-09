# ============================================================
# EstimateOS Frontend — Production Dockerfile
# ============================================================
# HOW TO BUILD:
#   docker build -t estimateos-frontend .
#
# WITH CUSTOM API URL:
#   docker build \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 \
#     -t estimateos-frontend .
#
# HOW TO RUN:
#   docker run -p 3001:3000 estimateos-frontend
# ============================================================

# ── Stage 1: Install dependencies ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat needed for some native npm packages on Alpine
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# API URL — override at build time for production
# Example: docker build --build-arg NEXT_PUBLIC_API_URL=https://api.mysite.com/api/v1 .
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Ensure public folder exists (Next.js requires it)
RUN mkdir -p public

RUN npm run build

# ── Stage 3: Production runner (minimal image ~150MB) ────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone output (self-contained Node server)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public folder (may be empty but must exist)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health 2>/dev/null || wget -qO- http://localhost:3000 || exit 1

CMD ["node", "server.js"]

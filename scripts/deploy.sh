#!/bin/bash
# ============================================================
# EstimateOS — Full Deployment Script for Hostinger VPS
# Run: bash deploy.sh
# ============================================================
set -e

APP_DIR="/root/estimateos"
DOMAIN="valuscop.com"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +%H:%M:%S)] $1${NC}"; }
warn()  { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }

echo ""
echo "================================================="
echo "  EstimateOS Production Deploy — $DOMAIN"
echo "================================================="
echo ""

# Check running as root
[ "$EUID" -ne 0 ] && error "Run as root: sudo bash deploy.sh"

# ── STEP 1: System dependencies ───────────────────────────────
log "Step 1: Installing system dependencies..."
apt-get update -qq
apt-get install -y curl git ufw fail2ban openssl 2>/dev/null

# ── STEP 2: Install Docker if not present ─────────────────────
if ! command -v docker &>/dev/null; then
  log "Step 2: Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  log "Step 2: Docker already installed ✓"
fi

# ── STEP 3: Firewall ──────────────────────────────────────────
log "Step 3: Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable
log "Firewall configured ✓"

# ── STEP 4: Validate required files ───────────────────────────
log "Step 4: Checking required files..."
[ ! -f "$APP_DIR/backend/.env.production" ] && error "Missing: backend/.env.production"
[ ! -f "$APP_DIR/docker-compose.prod.yml" ] && error "Missing: docker-compose.prod.yml"

# Check secrets are set
grep -q "CHANGE_THIS_TO_A_RANDOM" "$APP_DIR/backend/.env.production" && \
  error "STOP: Edit backend/.env.production and set real secrets (JWT_SECRET, DB_PASSWORD, etc.)"
grep -q "YOUR_OPENAI_KEY" "$APP_DIR/backend/.env.production" && \
  error "STOP: Add your OPENAI_API_KEY to backend/.env.production"

log "Configuration files OK ✓"

# ── STEP 5: Build and start services ──────────────────────────
log "Step 5: Building Docker images (this takes 5-10 minutes)..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build --no-cache
log "Build complete ✓"

log "Starting all services..."
docker compose -f docker-compose.prod.yml up -d
log "Services started ✓"

# ── STEP 6: Wait for health ────────────────────────────────────
log "Step 6: Waiting for API to be healthy..."
TIMEOUT=120
ELAPSED=0
until docker inspect estimateos-api --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  sleep 5; ELAPSED=$((ELAPSED+5))
  [ $ELAPSED -ge $TIMEOUT ] && { warn "API health timeout. Check: docker compose logs api"; break; }
  echo -n "."
done
echo ""
log "API is healthy ✓"

# ── STEP 7: Seed database ──────────────────────────────────────
log "Step 7: Seeding database..."
sleep 5
docker exec estimateos-postgres psql -U estimateos -d estimateos \
  -c "SELECT COUNT(*) FROM users;" 2>/dev/null | grep -q "0" && {
  log "Running seed data..."
  cat "$APP_DIR/database/seed.sql" | docker exec -i estimateos-postgres \
    psql -U estimateos -d estimateos
  log "Database seeded ✓"
} || log "Database already has data — skipping seed ✓"

# ── STEP 8: Summary ───────────────────────────────────────────
echo ""
echo "================================================="
echo -e "${GREEN}  ✅ Deployment Complete!${NC}"
echo "================================================="
echo ""
echo "  App:     https://$DOMAIN  (after SSL setup)"
echo "  Health:  http://$(curl -s ifconfig.me)/health"
echo ""
echo "  Next step — Get SSL certificate:"
echo "  bash $APP_DIR/scripts/ssl-setup.sh"
echo ""
echo "  Useful commands:"
echo "  docker compose -f $APP_DIR/docker-compose.prod.yml logs -f api"
echo "  docker compose -f $APP_DIR/docker-compose.prod.yml ps"
echo ""

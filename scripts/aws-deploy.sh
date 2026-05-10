#!/bin/bash
# ============================================================
# EstimateOS — AWS EC2 Deployment Script
# Domain: valuscop.com
# Run: sudo bash aws-deploy.sh
# ============================================================
set -e

APP_DIR="/home/ubuntu/estimateos"
DOMAIN="valuscop.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${GREEN}[✓] $1${NC}"; }
step()    { echo -e "\n${CYAN}${BOLD}━━ $1 ━━${NC}"; }
warn()    { echo -e "${YELLOW}[!] $1${NC}"; }
error()   { echo -e "${RED}[✗] $1${NC}"; exit 1; }
info()    { echo -e "    $1"; }

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   EstimateOS — AWS EC2 Deployment            ║"
echo "║   Domain: $DOMAIN                    ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Pre-flight checks ─────────────────────────────────────────
step "Pre-flight checks"

[ "$EUID" -ne 0 ] && error "Run as root: sudo bash aws-deploy.sh"
[ ! -d "$APP_DIR" ] && error "App directory not found: $APP_DIR\nUpload your project first."
[ ! -f "$APP_DIR/backend/.env.production" ] && error "Missing: backend/.env.production\nCreate it from backend/.env.production template."

# Check secrets replaced
grep -q "REPLACE_WITH_GENERATED_SECRET" "$APP_DIR/backend/.env.production" && \
  error "Edit backend/.env.production first — replace all REPLACE_WITH_* values"
grep -q "YOUR_OPENAI_KEY" "$APP_DIR/backend/.env.production" && \
  error "Set your OPENAI_API_KEY in backend/.env.production"

log "Pre-flight checks passed"

# ── Step 1: System update ─────────────────────────────────────
step "Step 1: System update"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git nano unzip \
  ufw fail2ban \
  certbot \
  openssl \
  htop
log "System updated"

# ── Step 2: Install Docker ────────────────────────────────────
step "Step 2: Install Docker & Docker Compose"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  systemctl enable docker
  systemctl start docker
  log "Docker installed"
else
  log "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
fi
log "Docker Compose: $(docker compose version --short)"

# ── Step 3: Firewall ──────────────────────────────────────────
step "Step 3: Configure firewall (UFW)"
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
log "Firewall configured (SSH:22, HTTP:80, HTTPS:443)"
info "NOTE: Also open these in AWS Security Group!"

# ── Step 4: Fail2ban ──────────────────────────────────────────
step "Step 4: Configure Fail2ban (brute-force protection)"
cat > /etc/fail2ban/jail.local << 'F2B'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
F2B
systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2ban configured"

# ── Step 5: Swap (important for small EC2 instances) ─────────
step "Step 5: Configure swap memory"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "4GB swap created"
else
  log "Swap already configured"
fi

# ── Step 6: Build Docker images ───────────────────────────────
step "Step 6: Build Docker images"
info "This takes 5–15 minutes on first run..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml build --no-cache
log "All images built"

# ── Step 7: Start services ────────────────────────────────────
step "Step 7: Start all services"
docker compose -f docker-compose.prod.yml up -d
log "Services started"

# Wait for API health
info "Waiting for API to become healthy..."
TIMEOUT=120; ELAPSED=0
until docker inspect estimateos-api --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  sleep 5; ELAPSED=$((ELAPSED+5))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    warn "API health check timed out after ${TIMEOUT}s"
    warn "Check logs: docker compose -f $APP_DIR/docker-compose.prod.yml logs api"
    break
  fi
  echo -n "."
done
echo ""
log "API healthy"

# ── Step 8: Seed database ──────────────────────────────────────
step "Step 8: Seed database"
sleep 5
USER_COUNT=$(docker exec estimateos-postgres psql -U estimateos -d estimateos -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
USER_COUNT=$(echo "$USER_COUNT" | tr -d '[:space:]')
if [ "$USER_COUNT" = "0" ]; then
  info "Running seed data..."
  cat "$APP_DIR/database/seed.sql" | docker exec -i estimateos-postgres \
    psql -U estimateos -d estimateos
  log "Database seeded"
else
  log "Database already has $USER_COUNT users — skipping seed"
fi

# ── Step 9: Setup systemd auto-start ──────────────────────────
step "Step 9: Configure auto-start on reboot"
cat > /etc/systemd/system/estimateos.service << SVCEOF
[Unit]
Description=EstimateOS Application
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable estimateos.service
log "Auto-start on reboot configured"

# ── Done ──────────────────────────────────────────────────────
SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║   ✅ Deployment Complete!                    ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  Server IP:  ${CYAN}$SERVER_IP${NC}"
echo -e "  Health:     ${CYAN}http://$SERVER_IP/health${NC}"
echo ""
echo -e "${YELLOW}  ⚠ NEXT STEP — Get SSL certificate:${NC}"
echo -e "  ${BOLD}sudo bash $APP_DIR/scripts/ssl-setup.sh${NC}"
echo ""
echo -e "  After SSL — your app will be live at:"
echo -e "  ${GREEN}https://$DOMAIN${NC}"
echo ""
echo "  Useful commands:"
echo "  docker compose -f $APP_DIR/docker-compose.prod.yml ps"
echo "  docker compose -f $APP_DIR/docker-compose.prod.yml logs -f api"
echo "  docker compose -f $APP_DIR/docker-compose.prod.yml logs -f ai-worker"
echo ""

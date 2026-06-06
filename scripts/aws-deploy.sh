#!/bin/bash
# ============================================================
# EstimateOS — Complete AWS Deployment Script
# Run from project root: sudo bash scripts/aws-deploy.sh
# ============================================================
set -e

APP_DIR="/home/ubuntu/estimateos/AI_Project_Test"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✓] $1${NC}"; }
step()  { echo -e "\n${CYAN}${BOLD}━━ $1${NC}"; }
warn()  { echo -e "${YELLOW}[!] $1${NC}"; }
error() { echo -e "${RED}[✗] ERROR: $1${NC}"; exit 1; }
info()  { echo -e "    $1"; }

# ── Must run from project root ────────────────────────────────
cd "$APP_DIR" 2>/dev/null || error "Project not found at $APP_DIR"

echo -e "${BOLD}${CYAN}"
echo "╔════════════════════════════════════════════════╗"
echo "║   EstimateOS — AWS Production Deploy           ║"
echo "║   https://valuscop.com                         ║"
echo "║   https://api.valuscop.com                     ║"
echo "╚════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════
# STEP 1 — System dependencies
# ═══════════════════════════════════════════════════
step "Step 1: System packages"
apt-get update -qq
apt-get install -y -qq curl wget git ufw certbot openssl net-tools dnsutils htop
log "Packages ready"

# ═══════════════════════════════════════════════════
# STEP 2 — Docker
# ═══════════════════════════════════════════════════
step "Step 2: Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker ubuntu
  systemctl enable docker && systemctl start docker
  log "Docker installed"
else
  log "Docker already installed"
fi

# ═══════════════════════════════════════════════════
# STEP 3 — Firewall
# ═══════════════════════════════════════════════════
step "Step 3: Firewall"
ufw --force reset > /dev/null
ufw default deny incoming && ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
log "UFW: ports 22, 80, 443 open"

# ═══════════════════════════════════════════════════
# STEP 4 — Swap memory
# ═══════════════════════════════════════════════════
step "Step 4: Swap memory"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile
  mkswap /swapfile > /dev/null && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "4GB swap created"
else
  log "Swap already exists"
fi

# ═══════════════════════════════════════════════════
# STEP 5 — Stop any host nginx that blocks port 80
# ═══════════════════════════════════════════════════
step "Step 5: Stop host nginx (frees port 80)"
systemctl stop nginx 2>/dev/null && systemctl disable nginx 2>/dev/null || true
log "Host nginx stopped"

# ═══════════════════════════════════════════════════
# STEP 6 — Generate secrets and patch docker-compose
# ═══════════════════════════════════════════════════
step "Step 6: Generating secrets"

# Check if already deployed (passwords already set)
if grep -q "CHANGE_DB_PASSWORD" docker-compose.prod.yml; then
  # Generate safe hex passwords (no special chars)
  DB_PASS=$(openssl rand -hex 16)
  REDIS_PASS=$(openssl rand -hex 16)
  MINIO_KEY=estimateos$(openssl rand -hex 6)
  MINIO_SECRET=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 48)

  info "Generated passwords:"
  info "  DB_PASSWORD:     $DB_PASS"
  info "  REDIS_PASSWORD:  $REDIS_PASS"
  info "  MINIO_ACCESS_KEY: $MINIO_KEY"

  # Patch docker-compose.prod.yml with real passwords
  sed -i "s/CHANGE_DB_PASSWORD/$DB_PASS/g"       docker-compose.prod.yml
  sed -i "s/CHANGE_REDIS_PASSWORD/$REDIS_PASS/g" docker-compose.prod.yml
  sed -i "s/CHANGE_MINIO_KEY/$MINIO_KEY/g"       docker-compose.prod.yml
  sed -i "s/CHANGE_MINIO_SECRET/$MINIO_SECRET/g" docker-compose.prod.yml

  # Patch .env.production with matching passwords
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"                     backend/.env.production
  sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|"                       backend/.env.production
  sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASS}|"               backend/.env.production
  sed -i "s|^MINIO_ACCESS_KEY=.*|MINIO_ACCESS_KEY=${MINIO_KEY}|"           backend/.env.production
  sed -i "s|^MINIO_SECRET_KEY=.*|MINIO_SECRET_KEY=${MINIO_SECRET}|"       backend/.env.production

  log "Secrets generated and applied"
else
  log "Secrets already set — skipping generation"
fi

# Check OpenAI key is set
if grep -q "YOUR_OPENAI_KEY_HERE\|sk-YOUR" backend/.env.production; then
  warn "OPENAI_API_KEY not set in backend/.env.production"
  warn "Edit it now: nano backend/.env.production"
  warn "Then run this script again."
  echo ""
  echo "Find the line: OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE"
  echo "Replace with your real key from: https://platform.openai.com/api-keys"
  echo ""
  read -rp "Press Enter after editing .env.production, or Ctrl+C to exit..."
fi

# ═══════════════════════════════════════════════════
# STEP 7 — Build Docker images
# ═══════════════════════════════════════════════════
step "Step 7: Building Docker images (5–15 min)"
docker compose -f docker-compose.prod.yml build --no-cache
log "All images built"

# ═══════════════════════════════════════════════════
# STEP 8 — Start infra services first
# ═══════════════════════════════════════════════════
step "Step 8: Starting infrastructure"
docker compose -f docker-compose.prod.yml up -d postgres redis minio qdrant
info "Waiting 30s for databases to initialise..."
sleep 30

# Verify postgres
PG_STATUS=$(docker inspect estimateos-postgres --format='{{.State.Health.Status}}' 2>/dev/null || echo "missing")
if [ "$PG_STATUS" != "healthy" ]; then
  warn "Postgres not healthy yet (status: $PG_STATUS), waiting 20s more..."
  sleep 20
fi
log "Databases running"

# ═══════════════════════════════════════════════════
# STEP 9 — Start MinIO buckets then app
# ═══════════════════════════════════════════════════
step "Step 9: Starting application"
docker compose -f docker-compose.prod.yml up -d minio-init
sleep 10

docker compose -f docker-compose.prod.yml up -d api
info "Waiting for API health check (up to 90s)..."

TIMEOUT=90; ELAPSED=0
until docker inspect estimateos-api --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  sleep 5; ELAPSED=$((ELAPSED+5))
  [ $ELAPSED -ge $TIMEOUT ] && break
  echo -n "."
done
echo ""

API_STATUS=$(docker inspect estimateos-api --format='{{.State.Health.Status}}' 2>/dev/null || echo "missing")
if [ "$API_STATUS" = "healthy" ]; then
  log "API is healthy"
else
  warn "API status: $API_STATUS — checking logs..."
  docker logs estimateos-api --tail 20
fi

docker compose -f docker-compose.prod.yml up -d ai-worker frontend
log "AI worker and frontend started"

# ═══════════════════════════════════════════════════
# STEP 10 — Start nginx (HTTP only for now)
# ═══════════════════════════════════════════════════
step "Step 10: Starting nginx (HTTP)"

# Write temporary HTTP-only nginx config for SSL setup
cat > nginx/nginx.conf << 'NGINXEOF'
events { worker_connections 1024; }
http {
  resolver 127.0.0.11 valid=30s;
  server {
    listen 80;
    listen [::]:80;
    server_name valuscop.com www.valuscop.com api.valuscop.com _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location /api/ { set $u http://api:3000; proxy_pass $u; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
    location / { set $u http://frontend:3000; proxy_pass $u; proxy_set_header Host $host; }
    location /health { return 200 "ok\n"; add_header Content-Type text/plain; }
  }
}
NGINXEOF

docker compose -f docker-compose.prod.yml build nginx
docker compose -f docker-compose.prod.yml up -d nginx
sleep 5
log "Nginx running on port 80"

# Test HTTP
HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
log "HTTP health check: $HTTP_TEST"

# ═══════════════════════════════════════════════════
# STEP 11 — Seed database
# ═══════════════════════════════════════════════════
step "Step 11: Seeding database"
sleep 5
USER_COUNT=$(docker exec estimateos-postgres psql -U estimateos -d estimateos -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "$USER_COUNT" = "0" ]; then
  for f in database/migrations/*.sql; do
    docker exec -i estimateos-postgres psql -U estimateos -d estimateos < "$f" 2>/dev/null || true
  done
  # Fix admin password hash (ensure $ signs are correct)
  docker exec estimateos-postgres psql -U estimateos -d estimateos \
    -c "UPDATE users SET password_hash = '\$2b\$12\$QCs9kQPVK/K0FJCLVxNctOhZA7jvH5Im98JzGLvxjtV2Jil6H0C.6', status = 'active' WHERE email = 'admin@estimateos.com';" 2>/dev/null || true
  log "Database seeded"
else
  log "Database already seeded ($USER_COUNT users)"
fi

# ═══════════════════════════════════════════════════
# STEP 12 — Auto-start on reboot
# ═══════════════════════════════════════════════════
step "Step 12: Auto-start service"
cat > /etc/systemd/system/estimateos.service << SVCEOF
[Unit]
Description=EstimateOS Application
Requires=docker.service
After=docker.service network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=300
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload && systemctl enable estimateos.service
log "Auto-start on reboot configured"

# ═══════════════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════════════
SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "YOUR_EC2_IP")
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔════════════════════════════════════════════════╗"
echo "║   ✅ Deployment Complete!                      ║"
echo "╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Server IP : ${CYAN}$SERVER_IP${NC}"
echo -e "  HTTP test : curl http://$SERVER_IP/health"
echo ""
echo -e "${YELLOW}  NEXT STEP — Get SSL certificates:${NC}"
echo -e "  ${BOLD}sudo bash scripts/ssl-setup.sh${NC}"
echo ""
echo "  Container status:"
docker compose -f docker-compose.prod.yml ps

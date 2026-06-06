#!/bin/bash
# ============================================================
# EstimateOS — SSL Certificate Setup
# Run AFTER deploy script AND after DNS propagates
# Run: sudo bash scripts/ssl-setup.sh
# ============================================================
set -e

APP_DIR="/home/ubuntu/estimateos/AI_Project_Test"
FRONTEND_DOMAIN="valuscop.com"
API_DOMAIN="api.valuscop.com"
EMAIL="admin@valuscop.com"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()   { echo -e "${GREEN}[✓] $1${NC}"; }
warn()  { echo -e "${YELLOW}[!] $1${NC}"; }
error() { echo -e "${RED}[✗] $1${NC}"; exit 1; }

cd "$APP_DIR"

echo -e "\n${GREEN}━━ SSL Setup for $FRONTEND_DOMAIN + $API_DOMAIN ━━${NC}\n"

# ── Check DNS ────────────────────────────────────────────────
SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me)
echo "Server IP: $SERVER_IP"

ALL_OK=true
for DOMAIN in "$FRONTEND_DOMAIN" "www.$FRONTEND_DOMAIN" "$API_DOMAIN"; do
  RESOLVED=$(dig +short "$DOMAIN" | tail -1)
  if [ "$RESOLVED" = "$SERVER_IP" ]; then
    log "DNS OK: $DOMAIN → $RESOLVED"
  else
    warn "DNS mismatch: $DOMAIN → '$RESOLVED' (need $SERVER_IP)"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = "false" ]; then
  warn "Some DNS records are not pointing to this server."
  warn "Wait for propagation (5–30 minutes) then retry."
  read -rp "Continue anyway? (y/N): " CONFIRM
  [[ "$CONFIRM" != "y" ]] && exit 1
fi

# ── Install certbot ──────────────────────────────────────────
apt-get install -y -qq certbot
mkdir -p /var/www/certbot

# ── Ensure nginx is running on port 80 ──────────────────────
docker compose -f docker-compose.prod.yml up -d nginx 2>/dev/null || true
sleep 3

# Test port 80
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 http://localhost/health || echo "000")
if [ "$HTTP" != "200" ]; then
  error "Port 80 not responding (got $HTTP). Check nginx: docker logs estimateos-nginx"
fi
log "Port 80 is responding"

# ── Get frontend certificate ─────────────────────────────────
log "Getting certificate for $FRONTEND_DOMAIN + www.$FRONTEND_DOMAIN..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --domains "$FRONTEND_DOMAIN,www.$FRONTEND_DOMAIN"
log "Frontend certificate issued"

# ── Get API certificate ──────────────────────────────────────
log "Getting certificate for $API_DOMAIN..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --domains "$API_DOMAIN"
log "API certificate issued"

# ── Download certbot SSL options files ───────────────────────
if [ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]; then
  wget -q -O /etc/letsencrypt/options-ssl-nginx.conf \
    https://raw.githubusercontent.com/certbot/certbot/main/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf
fi
if [ ! -f /etc/letsencrypt/ssl-dhparams.pem ]; then
  openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048 2>/dev/null
fi
log "SSL options files ready"

# ── Write production HTTPS nginx config ──────────────────────
log "Writing HTTPS nginx config..."
cat > nginx/nginx.conf << 'NGINXEOF'
# EstimateOS Production Nginx — HTTPS
events {
  worker_connections 2048;
}
http {
  resolver 127.0.0.11 valid=30s;

  limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=30r/s;
  limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;

  gzip on;
  gzip_types text/plain text/css application/json application/javascript;

  # HTTP → HTTPS
  server {
    listen 80;
    listen [::]:80;
    server_name valuscop.com www.valuscop.com api.valuscop.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
  }

  # www → apex redirect
  server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name www.valuscop.com;
    ssl_certificate     /etc/letsencrypt/live/valuscop.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/valuscop.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    return 301 https://valuscop.com$request_uri;
  }

  # Frontend — valuscop.com
  server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name valuscop.com;
    ssl_certificate     /etc/letsencrypt/live/valuscop.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/valuscop.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    client_max_body_size 10M;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    location / {
      set $upstream http://frontend:3000;
      proxy_pass $upstream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
    location /health { return 200 "ok\n"; add_header Content-Type text/plain; }
  }

  # API — api.valuscop.com
  server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name api.valuscop.com;
    ssl_certificate     /etc/letsencrypt/live/api.valuscop.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.valuscop.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    client_max_body_size 150M;
    client_body_timeout 300s;
    add_header Strict-Transport-Security "max-age=63072000" always;

    location /api/v1/auth/login {
      limit_req zone=auth_limit burst=5 nodelay;
      set $upstream http://api:3000;
      proxy_pass $upstream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-Proto https;
    }
    location /api/v1/files/upload {
      set $upstream http://api:3000;
      proxy_pass $upstream;
      proxy_http_version 1.1;
      proxy_read_timeout 600s;
      proxy_send_timeout 600s;
      proxy_request_buffering off;
      client_max_body_size 150M;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-Proto https;
    }
    location /api/ {
      limit_req zone=api_limit burst=20 nodelay;
      set $upstream http://api:3000;
      proxy_pass $upstream;
      proxy_http_version 1.1;
      proxy_read_timeout 300s;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-Proto https;
    }
    location / {
      return 200 '{"service":"EstimateOS API","status":"ok"}';
      add_header Content-Type application/json;
    }
  }
}
NGINXEOF

# ── Rebuild nginx with HTTPS config ─────────────────────────
docker compose -f docker-compose.prod.yml build nginx
docker compose -f docker-compose.prod.yml up -d nginx
sleep 5

# ── Test HTTPS ───────────────────────────────────────────────
echo ""
for URL in "https://$FRONTEND_DOMAIN/health" "https://$API_DOMAIN/api/v1/health"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$URL" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    log "HTTPS working: $URL → $CODE"
  else
    warn "HTTPS returned $CODE for $URL (may need a moment)"
  fi
done

# ── Auto-renewal cron ────────────────────────────────────────
CRON="0 3 * * * certbot renew --quiet && docker compose -f $APP_DIR/docker-compose.prod.yml exec nginx nginx -s reload 2>/dev/null || true"
(crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON") | crontab -
log "SSL auto-renewal cron set"

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔════════════════════════════════════════════════╗"
echo "║   ✅ SSL Complete — App is Live!               ║"
echo "╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 https://$FRONTEND_DOMAIN"
echo -e "  🔌 https://$API_DOMAIN"
echo -e "  📧 admin@estimateos.com / Admin@123!"
echo ""

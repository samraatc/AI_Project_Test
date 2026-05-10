#!/bin/bash
# ============================================================
# EstimateOS SSL Setup Script
# Run this ONCE on your Hostinger VPS to get SSL certificates
# ============================================================
set -e

DOMAIN="valuscop.com"
EMAIL="admin@valuscop.com"   # Change to your real email

echo "=== EstimateOS SSL Setup for $DOMAIN ==="

# 1. Install certbot
echo "[1/5] Installing certbot..."
apt-get update -qq
apt-get install -y certbot

# 2. Create webroot dir for ACME challenge
echo "[2/5] Creating webroot..."
mkdir -p /var/www/certbot

# 3. Start nginx on port 80 for ACME challenge
echo "[3/5] Starting nginx temporarily for ACME challenge..."
docker compose -f docker-compose.prod.yml up -d nginx 2>/dev/null || true
sleep 3

# 4. Get certificate
echo "[4/5] Obtaining SSL certificate..."
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --domains "$DOMAIN,www.$DOMAIN" \
  --non-interactive

# 5. Verify certificate files exist
echo "[5/5] Verifying certificate..."
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "✅ SSL certificate obtained successfully!"
  echo "   Certificate: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
  echo "   Expires:     $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem)"
else
  echo "❌ Certificate not found. Check errors above."
  exit 1
fi

# 6. Set up auto-renewal cron
echo "Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * certbot renew --quiet && docker compose -f /root/estimateos/docker-compose.prod.yml exec nginx nginx -s reload") | crontab -

echo ""
echo "✅ SSL setup complete. Now run:"
echo "   docker compose -f docker-compose.prod.yml up -d --build"

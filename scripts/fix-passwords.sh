#!/bin/bash
# ============================================================
# EstimateOS — Fix Password Issues on Running AWS Server
# Run: sudo bash fix-passwords.sh
# ============================================================
set -e

APP_DIR="/home/ubuntu/estimateos"
ENV_FILE="$APP_DIR/backend/.env.production"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

echo ""
echo "EstimateOS — Fixing passwords to be Docker-safe"
echo ""

# Generate safe hex passwords (no special chars)
NEW_DB_PASS=$(openssl rand -hex 16)
NEW_REDIS_PASS=$(openssl rand -hex 16)
NEW_MINIO_KEY=estimateos$(openssl rand -hex 6)
NEW_MINIO_SECRET=$(openssl rand -hex 24)
NEW_JWT=$(openssl rand -hex 48)

echo "Generated safe passwords:"
echo "  DB_PASSWORD:     $NEW_DB_PASS"
echo "  REDIS_PASSWORD:  $NEW_REDIS_PASS"
echo "  MINIO_ACCESS_KEY: $NEW_MINIO_KEY"
echo "  MINIO_SECRET_KEY: $NEW_MINIO_SECRET"
echo ""

# Backup current .env
cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
log "Backed up current .env.production"

# Replace passwords using sed
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_JWT}|"               "$ENV_FILE"
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${NEW_DB_PASS}|"         "$ENV_FILE"
sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${NEW_REDIS_PASS}|" "$ENV_FILE"
sed -i "s|^MINIO_ACCESS_KEY=.*|MINIO_ACCESS_KEY=${NEW_MINIO_KEY}|" "$ENV_FILE"
sed -i "s|^MINIO_SECRET_KEY=.*|MINIO_SECRET_KEY=${NEW_MINIO_SECRET}|" "$ENV_FILE"
log ".env.production updated"

# Stop everything
warn "Stopping all containers..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml down
log "Containers stopped"

# Wipe volumes so postgres/redis start fresh with new passwords
warn "Wiping data volumes (fresh database)..."
docker volume rm \
  ai_project_test_postgres_data \
  ai_project_test_redis_data \
  ai_project_test_minio_data \
  ai_project_test_qdrant_data \
  estimateos_postgres_data \
  estimateos_redis_data \
  estimateos_minio_data \
  estimateos_qdrant_data 2>/dev/null || true
log "Volumes cleared"

# Restart
log "Starting services with new passwords..."
docker compose -f docker-compose.prod.yml up -d
log "Services starting..."

# Wait for postgres
echo "Waiting for postgres to be healthy..."
TIMEOUT=90; ELAPSED=0
until docker inspect estimateos-postgres --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  sleep 5; ELAPSED=$((ELAPSED+5))
  [ $ELAPSED -ge $TIMEOUT ] && { echo "Timeout — checking logs..."; docker logs estimateos-postgres --tail 20; break; }
  echo -n "."
done
echo ""

STATUS=$(docker inspect estimateos-postgres --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
if [ "$STATUS" = "healthy" ]; then
  log "Postgres healthy ✓"
  
  # Seed the database
  sleep 5
  log "Seeding database..."
  cat "$APP_DIR/database/seed.sql" | \
    docker exec -i estimateos-postgres psql -U estimateos -d estimateos
  log "Database seeded ✓"
else
  echo "Postgres status: $STATUS"
  echo "Check logs: docker logs estimateos-postgres"
fi

echo ""
echo -e "${GREEN}Done! Check status:${NC}"
echo "  docker compose -f $APP_DIR/docker-compose.prod.yml ps"
echo ""

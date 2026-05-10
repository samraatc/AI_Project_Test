#!/bin/bash
# Run this to generate strong random secrets for production .env.production
echo "=== Copy these into backend/.env.production ==="
echo ""
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '/')"
echo "REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '/')"
echo "MINIO_ACCESS_KEY=estimateos$(openssl rand -hex 8)"
echo "MINIO_SECRET_KEY=$(openssl rand -base64 32 | tr -d '\n' | tr -d '/')"
echo ""

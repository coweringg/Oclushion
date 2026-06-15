#!/bin/bash
set -euo pipefail

# Oclushion Enterprise — deploy script
# Usage: curl -sSL https://get.oclushion.com | bash
#        bash scripts/deploy.sh [version] [domain] [email]

VERSION="${1:-latest}"
DOMAIN="${2:-}"
EMAIL="${3:-}"

echo "Deploying Oclushion Enterprise v${VERSION}..."

command -v docker >/dev/null 2>&1 || { echo "Error: Docker not installed"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "Error: Docker Compose not installed"; exit 1; }

INSTALL_DIR="${OC_HOME:-$HOME/.oclushion}"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ -d ".git" ]; then
  git pull origin main
else
  git clone --depth 1 https://github.com/oclushion/enterprise.git . || true
fi

if [ ! -f .env ]; then
  echo "Generating secrets..."
  cat > .env <<EOF
POSTGRES_USER=oclushion
POSTGRES_PASSWORD=$(openssl rand -hex 32)
POSTGRES_HOST_PORT=5432
REDIS_PASSWORD=$(openssl rand -hex 32)
REDIS_HOST_PORT=6379
CONTROL_API_ADMIN_TOKEN=ocl_$(openssl rand -hex 32)
CONTROL_API_INTERNAL_TOKEN=ocl_$(openssl rand -hex 32)
TOKEN_MAPPING_ENCRYPTION_KEY=$(openssl rand -base64 32)
DATA_PROTECT_ENCRYPTION_KEY=$(openssl rand -base64 32)
DATA_GATEWAY_TOKEN=ocl_$(openssl rand -hex 32)
GRAFANA_PASSWORD=$(openssl rand -hex 16)
DOMAIN=${DOMAIN:-oclushion.local}
ACME_EMAIL=${EMAIL:-admin@oclushion.com}
VERSION=${VERSION}
EOF
fi

echo "Pulling images..."
docker compose -f compose.prod.yaml pull

echo "Starting services..."
docker compose -f compose.prod.yaml up -d

echo "Waiting for health check..."
sleep 10
if curl -sf "https://${DOMAIN:-localhost}/health" --insecure; then
  echo "Oclushion is running at https://${DOMAIN:-localhost}"
else
  echo "Health check failed. Check logs: docker compose -f compose.prod.yaml logs -f"
fi

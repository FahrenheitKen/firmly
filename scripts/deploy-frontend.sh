#!/usr/bin/env bash
set -euo pipefail

# Rebuild and restart the Firmly Next.js frontend.
# Builds in frontend/, transfers .next ownership to www-data (the service user),
# then restarts firmly-frontend.service.
#
# Usage: scripts/deploy-frontend.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
SERVICE_USER="www-data"
SERVICE_NAME="firmly-frontend.service"
HEALTH_URL="http://127.0.0.1:3001"

cd "$FRONTEND_DIR"

echo "==> Building frontend in $FRONTEND_DIR"
npm run build

echo "==> Chowning .next to $SERVICE_USER"
sudo chown -R "$SERVICE_USER:$SERVICE_USER" .next

echo "==> Restarting $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "==> Waiting for service to come up"
for i in {1..45}; do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then
    echo "==> Up after ${i}s — $HEALTH_URL is responding"
    exit 0
  fi
  sleep 1
done

echo "ERROR: service did not respond on $HEALTH_URL within 45s" >&2
sudo systemctl status "$SERVICE_NAME" --no-pager | head -15 >&2
exit 1

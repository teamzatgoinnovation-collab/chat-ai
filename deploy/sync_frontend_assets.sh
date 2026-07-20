#!/usr/bin/env bash
# Sync Chat AI public assets into frappe_docker frontend nginx tree.
# Run on the Docker host after get-app / pull / migrate.
set -euo pipefail

BACKEND="${BACKEND_CONTAINER:-frappe_docker-backend-1}"
FRONTEND="${FRONTEND_CONTAINER:-frappe_docker-frontend-1}"

echo "→ sync public/ → sites/chat_ai_assets on ${BACKEND}"
docker exec "$BACKEND" bash -lc '
  set -e
  cd /home/frappe/frappe-bench
  rm -rf sites/chat_ai_assets
  mkdir -p sites/chat_ai_assets
  cp -a apps/chat_ai/chat_ai/public/. sites/chat_ai_assets/
  mkdir -p assets/chat_ai
  cp -a apps/chat_ai/chat_ai/public/. assets/chat_ai/
'

echo "→ sync sites/chat_ai_assets → frontend assets/chat_ai on ${FRONTEND}"
docker exec "$FRONTEND" bash -lc '
  set -e
  mkdir -p /home/frappe/frappe-bench/assets/chat_ai
  cp -a /home/frappe/frappe-bench/sites/chat_ai_assets/. /home/frappe/frappe-bench/assets/chat_ai/
  ls /home/frappe/frappe-bench/assets/chat_ai/js/vendor/vue.global.prod.js
'

echo "OK — hard-refresh Desk (Ctrl+Shift+R)"

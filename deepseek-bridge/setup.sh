#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BRIDGE_DIR="$ROOT/vendor/Deepseek-API-Bridge"

if [ ! -d "$BRIDGE_DIR/.git" ]; then
  mkdir -p "$ROOT/vendor"
  git clone https://github.com/dasepmoch/Deepseek-API-Bridge.git "$BRIDGE_DIR"
else
  git -C "$BRIDGE_DIR" pull --ff-only
fi

cd "$BRIDGE_DIR"

# Build and start the upstream bridge.
# DeepSeek authentication is intentionally NOT automated here.
# Complete the one-time login/token step from the upstream project's instructions.
docker compose up -d --build

echo
echo "Bridge started locally."
echo "Health: http://127.0.0.1:8090/healthz"
echo "Models: http://127.0.0.1:8090/v1/models"
echo
echo "Next: expose this service through a stable HTTPS endpoint and set"
echo "Supabase secret OPENCODE_DEEPSEEK_URL to that HTTPS base URL."

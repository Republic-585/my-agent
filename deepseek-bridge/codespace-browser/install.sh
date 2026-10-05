#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/runtime"
BRIDGE_DIR="$ROOT/vendor/Deepseek-API-Bridge"
NOVNC_DIR="$RUNTIME/noVNC"

mkdir -p "$RUNTIME"

if ! command -v Xvfb >/dev/null 2>&1 || ! command -v x11vnc >/dev/null 2>&1; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xvfb x11vnc
fi

if [ ! -d "$BRIDGE_DIR/.git" ]; then
  mkdir -p "$ROOT/vendor"
  git clone https://github.com/dasepmoch/Deepseek-API-Bridge.git "$BRIDGE_DIR"
fi

if [ ! -d "$RUNTIME/venv" ]; then
  python3 -m venv "$RUNTIME/venv"
fi

"$RUNTIME/venv/bin/pip" install --upgrade pip
"$RUNTIME/venv/bin/pip" install -r "$BRIDGE_DIR/requirements.txt"
"$RUNTIME/venv/bin/python" -m playwright install chromium

if [ ! -d "$NOVNC_DIR/.git" ]; then
  git clone --depth 1 https://github.com/novnc/noVNC.git "$NOVNC_DIR"
fi

echo "DeepSeek Codespace browser environment is ready."

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/runtime"
BRIDGE_DIR="$ROOT/vendor/Deepseek-API-Bridge"
NOVNC_DIR="$RUNTIME/noVNC"
LOG_DIR="$RUNTIME/logs"
mkdir -p "$LOG_DIR" "$BRIDGE_DIR/session"

log() {
  echo "[deepseek-codespace] $*"
}

if ! command -v Xvfb >/dev/null 2>&1 || ! command -v x11vnc >/dev/null 2>&1; then
  log "X11/VNC packages are missing; installing them."
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y xvfb x11vnc
fi

if [ ! -x "$RUNTIME/venv/bin/python" ]; then
  log "Python virtual environment is missing; creating it."
  if ! python3 -m venv "$RUNTIME/venv"; then
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
    python3 -m venv "$RUNTIME/venv"
  fi
fi

if [ ! -x "$NOVNC_DIR/utils/novnc_proxy" ]; then
  log "noVNC is missing; cloning it."
  mkdir -p "$RUNTIME"
  rm -rf "$NOVNC_DIR"
  git clone --depth 1 https://github.com/novnc/noVNC.git "$NOVNC_DIR"
fi

if [ ! -d "$BRIDGE_DIR/.git" ]; then
  log "DeepSeek bridge is missing; cloning it."
  mkdir -p "$ROOT/vendor"
  git clone https://github.com/dasepmoch/Deepseek-API-Bridge.git "$BRIDGE_DIR"
fi

if ! "$RUNTIME/venv/bin/python" -c "import playwright, fastapi" >/dev/null 2>&1; then
  log "Bridge Python dependencies are missing; installing them."
  "$RUNTIME/venv/bin/pip" install -r "$BRIDGE_DIR/requirements.txt"
fi

if ! "$RUNTIME/venv/bin/python" -m playwright install --dry-run chromium >/dev/null 2>&1; then
  log "Installing Playwright Chromium."
  "$RUNTIME/venv/bin/python" -m playwright install chromium
fi

if ! pgrep -f "Xvfb :99" >/dev/null 2>&1; then
  Xvfb :99 -screen 0 1440x900x24 -ac >"$LOG_DIR/xvfb.log" 2>&1 &
  sleep 2
fi

if ! pgrep -f "x11vnc.*5900" >/dev/null 2>&1; then
  DISPLAY=:99 x11vnc -display :99 -forever -shared -nopw -rfbport 5900 >"$LOG_DIR/x11vnc.log" 2>&1 &
  sleep 2
fi

start_novnc() {
  pkill -f "novnc_proxy.*6080" >/dev/null 2>&1 || true
  log "Starting noVNC on port 6080."
  "$NOVNC_DIR/utils/novnc_proxy" \
    --vnc localhost:5900 \
    --listen 0.0.0.0:6080 \
    --web "$NOVNC_DIR" \
    --heartbeat 30 \
    >"$LOG_DIR/novnc.log" 2>&1 &
}

novnc_ready() {
  curl -fsS --max-time 5 http://127.0.0.1:6080/vnc.html >/dev/null 2>&1
}

if ! novnc_ready; then
  start_novnc
  for i in {1..20}; do
    if novnc_ready; then
      break
    fi
    sleep 1
  done
fi

if ! novnc_ready; then
  log "ERROR: noVNC HTTP service did not become ready."
  log "---- noVNC log ----"
  tail -n 100 "$LOG_DIR/novnc.log" 2>/dev/null || true
  log "---- Xvfb log ----"
  tail -n 50 "$LOG_DIR/xvfb.log" 2>/dev/null || true
  log "---- x11vnc log ----"
  tail -n 50 "$LOG_DIR/x11vnc.log" 2>/dev/null || true
  exit 1
fi

log "noVNC HTTP service is ready."

if [ ! -f "$BRIDGE_DIR/session/session.json" ] && ! pgrep -f "python.*deepseek.auth" >/dev/null 2>&1; then
  log "Starting interactive DeepSeek login browser."
  cd "$BRIDGE_DIR"
  DISPLAY=:99 "$RUNTIME/venv/bin/python" -m deepseek.auth >"$LOG_DIR/auth.log" 2>&1 &
fi

if ! pgrep -f "python.*app.py" >/dev/null 2>&1; then
  log "Starting DeepSeek API bridge."
  cd "$BRIDGE_DIR"
  "$RUNTIME/venv/bin/python" app.py >"$LOG_DIR/bridge.log" 2>&1 &
fi

log "DeepSeek remote browser: /vnc.html?autoconnect=true"
log "Bridge API: /v1"

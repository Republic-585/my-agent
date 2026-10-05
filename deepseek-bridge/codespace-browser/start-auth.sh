#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/runtime"
BRIDGE_DIR="$ROOT/vendor/Deepseek-API-Bridge"
LOG_DIR="$RUNTIME/logs"
mkdir -p "$LOG_DIR"

if pgrep -f "Xvfb :99" >/dev/null 2>&1; then
  true
else
  Xvfb :99 -screen 0 1440x900x24 -ac >/tmp/deepseek-xvfb.log 2>&1 &
  sleep 2
fi

if pgrep -f "x11vnc.*5900" >/dev/null 2>&1; then
  true
else
  DISPLAY=:99 x11vnc -display :99 -forever -shared -nopw -rfbport 5900 >/tmp/deepseek-x11vnc.log 2>&1 &
  sleep 2
fi

if pgrep -f "noVNC/utils/novnc_proxy.*6080" >/dev/null 2>&1; then
  true
else
  "$RUNTIME/noVNC/utils/novnc_proxy" --vnc localhost:5900 --listen 0.0.0.0:6080 >/tmp/deepseek-novnc.log 2>&1 &
  sleep 3
fi

if [ ! -f "$BRIDGE_DIR/session/session.json" ]; then
  if pgrep -f "python.*deepseek.auth" >/dev/null 2>&1; then
    true
  else
    cd "$BRIDGE_DIR"
    DISPLAY=:99 "$RUNTIME/venv/bin/python" -m deepseek.auth >"$LOG_DIR/auth.log" 2>&1 &
  fi
fi

if pgrep -f "python.*app.py" >/dev/null 2>&1; then
  true
else
  cd "$BRIDGE_DIR"
  "$RUNTIME/venv/bin/python" app.py >"$LOG_DIR/bridge.log" 2>&1 &
fi

echo "DeepSeek remote browser: http://127.0.0.1:6080/vnc.html"
echo "Bridge API: http://127.0.0.1:8090/v1"

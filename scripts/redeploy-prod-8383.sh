#!/bin/zsh
set -euo pipefail

cd /Users/shawn/trading-web

SERVICE_LABEL="com.kiseyno.trading-web"
SERVICE_TARGET="gui/$(id -u)/${SERVICE_LABEL}"
PORT=8383
APP_HEALTH_URL="http://127.0.0.1:${PORT}/trading-web/dashboard"
DATA_HEALTH_URL="http://127.0.0.1:4181/trading/quotes/tracked"

if [ -f package-lock.json ]; then
  /opt/homebrew/bin/npm install
fi

export NEXT_PUBLIC_BASE_PATH=/trading-web
/opt/homebrew/bin/npm run build

/bin/launchctl bootout "$SERVICE_TARGET" >/dev/null 2>&1 || true
sleep 2

PIDS=$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill -TERM || true
  sleep 2
fi
PIDS=$(lsof -tiTCP:$PORT -sTCP:LISTEN || true)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill -KILL || true
  sleep 2
fi

/bin/launchctl bootstrap gui/$(id -u) /Users/shawn/Library/LaunchAgents/com.kiseyno.trading-web.plist >/dev/null 2>&1 || true
/bin/launchctl kickstart -k "$SERVICE_TARGET"

for _ in {1..30}; do
  if curl -fsS "$APP_HEALTH_URL" >/dev/null 2>&1 && curl -fsS "$DATA_HEALTH_URL" >/dev/null 2>&1; then
    echo "trading-web redeployed on 8383 via launchd"
    exit 0
  fi
  sleep 1
done

echo "trading-web redeploy failed health check" >&2
exit 1

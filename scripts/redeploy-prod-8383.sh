#!/bin/zsh
set -euo pipefail

cd /Users/shawn/trading-web

SERVICE_LABEL="com.kiseyno.trading-web"
SERVICE_TARGET="gui/$(id -u)/${SERVICE_LABEL}"
PORT=8383
HEALTH_URL="http://127.0.0.1:4181/trading-web/api/trading/market/status"

if [ -f package-lock.json ]; then
  /opt/homebrew/bin/npm install
fi

export NEXT_PUBLIC_BASE_PATH=/trading-web
/opt/homebrew/bin/npm run build

/bin/launchctl kickstart -k "$SERVICE_TARGET" || true

for _ in {1..20}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "trading-web redeployed on 8383 via launchd"
    exit 0
  fi
  sleep 1
done

echo "launchd restart did not become healthy, forcing port cleanup on :$PORT" >&2
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

/bin/launchctl kickstart -k "$SERVICE_TARGET"

for _ in {1..30}; do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "trading-web redeployed on 8383 via launchd"
    exit 0
  fi
  sleep 1
done

echo "trading-web redeploy failed health check after forced restart" >&2
exit 1

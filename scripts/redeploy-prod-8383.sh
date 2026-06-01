#!/bin/zsh
set -euo pipefail

cd /Users/shawn/trading-web

SERVICE_LABEL="com.kiseyno.trading-web-8383"
SERVICE_TARGET="gui/$(id -u)/${SERVICE_LABEL}"
SERVICE_PLIST="/Users/shawn/Library/LaunchAgents/${SERVICE_LABEL}.plist"
PORT=8383
APP_HEALTH_URL="http://127.0.0.1:${PORT}/trading-web/dashboard"
DATA_HEALTH_URL="http://127.0.0.1:4181/trading/quotes/tracked"
TAILNET_HOST="${TAILNET_HOST:-gangseunghyeon-uiui-macmini-1.tail1d831c.ts.net}"
TAILNET_ENTRYPOINT_URL="${TAILNET_ENTRYPOINT_URL:-https://${TAILNET_HOST}/trading-web}"
TAILNET_BROWSER_ENTRYPOINT_URL="${TAILNET_BROWSER_ENTRYPOINT_URL:-$TAILNET_ENTRYPOINT_URL}"
RUN_TAILNET_BROWSER_SMOKE="${RUN_TAILNET_BROWSER_SMOKE:-1}"

if [[ "$TAILNET_BROWSER_ENTRYPOINT_URL" == http://*.ts.net/* ]]; then
  TAILNET_BROWSER_ENTRYPOINT_URL="https://${TAILNET_BROWSER_ENTRYPOINT_URL#http://}"
fi

resolve_build_version() {
  /opt/homebrew/bin/node <<'NODE'
const fs = require('fs');
const path = require('path');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const baseVersion = String(packageJson.version || '0.1.0');
const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
process.stdout.write(`${baseVersion}+deploy.${stamp}`);
NODE
}

NEW_VERSION=$(resolve_build_version)
echo "resolved trading-web build version ${NEW_VERSION}"

if [ -f package-lock.json ]; then
  /opt/homebrew/bin/npm install
fi

export NEXT_PUBLIC_BASE_PATH=/trading-web
export NEXT_PUBLIC_APP_VERSION="$NEW_VERSION"
/opt/homebrew/bin/npx next build --webpack

SEARCH_BUILD_JS=".next/server/app/search/page.js"
if [ -f "$SEARCH_BUILD_JS" ]; then
  if grep -Fq '"/v-' "$SEARCH_BUILD_JS" || grep -Fq "'/v-" "$SEARCH_BUILD_JS"; then
    echo "search route build sanity check failed: root-relative asset path found in $SEARCH_BUILD_JS" >&2
    exit 1
  fi
fi

CSS_ASSET=$(find .next/static/css -maxdepth 1 -type f -name '*.css' | sort | head -n 1 || true)
if [ -z "$CSS_ASSET" ]; then
  echo "build sanity check failed: no CSS assets found under .next/static/css" >&2
  exit 1
fi

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

if [ ! -f "$SERVICE_PLIST" ]; then
  echo "launchd plist not found: $SERVICE_PLIST" >&2
  exit 1
fi

/bin/launchctl bootstrap gui/$(id -u) "$SERVICE_PLIST" >/dev/null 2>&1 || true
/bin/launchctl kickstart -k "$SERVICE_TARGET"

for _ in {1..30}; do
  CSS_HREF=$(curl -fsS "$APP_HEALTH_URL" 2>/dev/null | grep -oE 'href="[^"]+\.css[^"]*"' | head -n 1 | sed -E 's/^href="([^"]+)"/\1/' || true)
  if [ -n "$CSS_HREF" ] && curl -fsS "http://127.0.0.1:${PORT}${CSS_HREF}" >/dev/null 2>&1 && curl -fsS "$DATA_HEALTH_URL" >/dev/null 2>&1; then
    echo "trading-web redeployed on 8383 via launchd"
    echo "canonical Tailnet browser entrypoint: ${TAILNET_BROWSER_ENTRYPOINT_URL}"
    if [ "$TAILNET_BROWSER_ENTRYPOINT_URL" != "$TAILNET_ENTRYPOINT_URL" ]; then
      echo "normalized Tailnet browser entrypoint from ${TAILNET_ENTRYPOINT_URL}"
    fi
    if [ "$RUN_TAILNET_BROWSER_SMOKE" = "1" ]; then
      PLAYWRIGHT_SKIP_WEB_SERVER=1 TAILNET_ENTRYPOINT_URL="$TAILNET_BROWSER_ENTRYPOINT_URL" \
        /opt/homebrew/bin/npm exec -- playwright test e2e/tailnet-entrypoint.spec.ts --project=chromium
    else
      echo "Tailnet browser smoke skipped because RUN_TAILNET_BROWSER_SMOKE=${RUN_TAILNET_BROWSER_SMOKE}"
    fi
    exit 0
  fi
  sleep 1
done

echo "trading-web redeploy failed health check" >&2
exit 1

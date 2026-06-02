#!/bin/zsh
set -euo pipefail
cd /Users/shawn/trading-web

export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-prod-8383}"
if [[ "$NEXT_DIST_DIR" == ".next" || "$NEXT_DIST_DIR" == "./.next" ]]; then
  echo "refusing to serve the 8383 production runtime from shared dist dir: $NEXT_DIST_DIR" >&2
  exit 1
fi

export NEXT_PUBLIC_BASE_PATH=/trading-web
APP_VERSION_FILE="${NEXT_DIST_DIR}/APP_VERSION"
if [ -f "$APP_VERSION_FILE" ]; then
  APP_VERSION="$(cat "$APP_VERSION_FILE")"
else
  APP_VERSION=$(/opt/homebrew/bin/node -p "require('./package.json').version")
fi
export NEXT_PUBLIC_APP_VERSION="${NEXT_PUBLIC_APP_VERSION:-$APP_VERSION}"
exec /opt/homebrew/bin/npm run start -- --hostname 0.0.0.0 --port 8383

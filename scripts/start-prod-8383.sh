#!/bin/zsh
set -euo pipefail
cd /Users/shawn/trading-web

export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-prod-8383}"

is_shared_next_dist_dir() {
  /opt/homebrew/bin/node -e 'const path = require("path"); const raw = process.argv[1] ?? ""; process.exit(path.resolve(process.cwd(), raw.trim()) === path.resolve(process.cwd(), ".next") ? 0 : 1);' "$1"
}

if is_shared_next_dist_dir "$NEXT_DIST_DIR"; then
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

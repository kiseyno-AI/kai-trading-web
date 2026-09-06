#!/bin/zsh
set -euo pipefail
PRODUCTION_APP_DIR="${PRODUCTION_APP_DIR:-/Users/shawn/trading-web}"
NODE_BIN="${NODE_BIN:-/opt/homebrew/bin/node}"
NPM_BIN="${NPM_BIN:-/opt/homebrew/bin/npm}"
cd "$PRODUCTION_APP_DIR"

export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-prod-8383}"

is_shared_next_dist_dir() {
  "$NODE_BIN" -e 'const path = require("path"); const raw = process.argv[1] ?? ""; process.exit(path.resolve(process.cwd(), raw.trim()) === path.resolve(process.cwd(), ".next") ? 0 : 1);' "$1"
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
  APP_VERSION=$("$NODE_BIN" -p "require('./package.json').version")
fi
export NEXT_PUBLIC_APP_VERSION="${NEXT_PUBLIC_APP_VERSION:-$APP_VERSION}"
APP_REVISION_FILE="${NEXT_DIST_DIR}/APP_REVISION"
if [ ! -f "$APP_REVISION_FILE" ]; then
  echo "refusing to serve the 8383 production runtime without a recorded app revision: $APP_REVISION_FILE" >&2
  exit 1
fi
APP_REVISION="$(cat "$APP_REVISION_FILE")"
SOURCE_REVISION="$(git rev-parse HEAD)"
if [ "$APP_REVISION" != "$SOURCE_REVISION" ]; then
  echo "refusing to serve stale 8383 production build: recorded revision ${APP_REVISION:-empty} does not match checked-out revision $SOURCE_REVISION" >&2
  exit 1
fi
export NEXT_PUBLIC_APP_REVISION="$APP_REVISION"
exec "$NPM_BIN" run start -- --hostname 0.0.0.0 --port 8383

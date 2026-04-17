#!/bin/zsh
set -euo pipefail
cd /Users/shawn/trading-web
export NEXT_PUBLIC_BASE_PATH=/trading-web
APP_VERSION=$(/opt/homebrew/bin/node -p "require('./package.json').version")
export NEXT_PUBLIC_APP_VERSION="$APP_VERSION"
exec /opt/homebrew/bin/npm run start -- --hostname 0.0.0.0 --port 8383

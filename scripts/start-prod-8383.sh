#!/bin/zsh
set -euo pipefail
cd /Users/shawn/trading-web
export NEXT_PUBLIC_BASE_PATH=/trading-web
exec /opt/homebrew/bin/npm run start -- --hostname 0.0.0.0 --port 8383

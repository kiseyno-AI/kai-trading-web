#!/bin/zsh
set -euo pipefail

cd /Users/shawn/trading-web

if [ -f package-lock.json ]; then
  /opt/homebrew/bin/npm install
fi

export NEXT_PUBLIC_BASE_PATH=/trading-web
/opt/homebrew/bin/npm run build
/bin/launchctl kickstart -k gui/$(id -u)/com.kiseyno.trading-web

echo "trading-web redeployed on 8383 via launchd"

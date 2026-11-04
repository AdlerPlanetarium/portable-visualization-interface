#!/usr/bin/env bash
set -euo pipefail
URL="http://localhost:3000/player/"
if command -v chromium >/dev/null 2>&1; then
  chromium --kiosk --ingognito --no-first-run --app="$URL" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser "$URL" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome "$URL" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
else
  echo "Open this URL in a browser: $URL"
fi

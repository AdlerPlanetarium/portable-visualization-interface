#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node server/server.js &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
sleep 2
./scripts/open-player.sh
wait "$SERVER_PID"

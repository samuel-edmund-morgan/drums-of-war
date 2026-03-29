#!/bin/sh
# Start Next.js server
node server.js &
SERVER_PID=$!

# Wait for server + DBs to be ready, then pre-warm icons in background
(
  sleep 20
  echo "[entrypoint] Starting icon pre-warm in background..."
  node --experimental-vm-modules scripts/prewarm-icons.mjs 2>&1 || echo "[entrypoint] Pre-warm finished with errors (non-fatal)"
) &

# Wait for server process
wait $SERVER_PID

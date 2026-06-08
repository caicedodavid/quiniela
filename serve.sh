#!/bin/bash
# serve.sh — Runs prerender.py on startup and whenever master.xlsx changes,
# then keeps the local dev server alive with auto-restart on crash.
PORT=7026
MASTER="data/master.xlsx"
cd "$(dirname "$0")"   # always run from project root

echo "Calculando puntos y actualizando scores.json..."
python3 prerender.py

echo "Mundial 2026 -- http://localhost:$PORT (Ctrl+C para detener)"

# Background watcher: re-runs prerender.py when master.xlsx is saved
(
  last_mtime=$(stat -f %m "$MASTER" 2>/dev/null || echo 0)
  while true; do
    sleep 2
    cur_mtime=$(stat -f %m "$MASTER" 2>/dev/null || echo 0)
    if [ "$cur_mtime" != "$last_mtime" ]; then
      echo ""
      echo "master.xlsx changed -- recalculando puntos..."
      python3 prerender.py
      last_mtime=$cur_mtime
    fi
  done
) &
WATCHER_PID=$!

# Cleanup watcher on exit
trap "kill $WATCHER_PID 2>/dev/null" EXIT

# Keep the HTTP server alive
while true; do
  python3 -m http.server $PORT
  echo "Servidor caido -- reiniciando en 1 segundo..."
  sleep 1
done

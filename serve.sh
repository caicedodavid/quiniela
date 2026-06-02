#!/bin/bash
# serve.sh — Keeps the local dev server alive.
# Auto-restarts if it crashes (e.g. Excel locking a file mid-save).
PORT=7026
echo "⚽ Mundial 2026 — http://localhost:$PORT (Ctrl+C para detener)"
while true; do
  python3 -m http.server $PORT
  echo "⚠️  Servidor caído — reiniciando en 1 segundo…"
  sleep 1
done

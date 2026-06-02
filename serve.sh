#!/bin/bash
# serve.sh — Auto-updates manifest then keeps the local dev server alive.
# Just drop Excel files in data/players/ and restart this script.
PORT=7026
cd "$(dirname "$0")"   # always run from project root

echo "🔄 Calculando puntos y actualizando scores.json…"
python3 prerender.py

echo "⚽ Mundial 2026 — http://localhost:$PORT (Ctrl+C para detener)"
while true; do
  python3 -m http.server $PORT
  echo "⚠️  Servidor caído — reiniciando en 1 segundo…"
  sleep 1
done

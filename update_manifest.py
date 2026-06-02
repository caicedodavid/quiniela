#!/usr/bin/env python3
"""
update_manifest.py
Scans data/players/ for .xlsx files and writes data/manifest.json.
Run this every time you add a new participant file, then commit + push.

Usage:  python3 update_manifest.py
"""
import json, os, pathlib

ROOT    = pathlib.Path(__file__).parent
PLAYERS = ROOT / 'data' / 'players'
MANIFEST = ROOT / 'data' / 'manifest.json'

files = sorted(
    f.name for f in PLAYERS.iterdir()
    if f.suffix.lower() == '.xlsx' and not f.name.startswith('~')
)

manifest = {'players': files}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

print(f'manifest.json actualizado — {len(files)} participante(s):')
for f in files:
    print(f'  {f}')

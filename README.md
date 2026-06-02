# WorldCup Fantasy 2026

Static site — [Render.com](https://render.com)

## 📁 File structure

```
worldcup-fantasy/
├── index.html             # App shell (Tailwind + SheetJS via CDN)
├── render.yaml            # Render static site config
├── update_manifest.py     # Run this after adding player files
├── js/
│   ├── app.js             # Orchestrator — lazy-loads Excel on demand
│   ├── parser.js          # Excel → structured group/match data
│   ├── scorer.js          # Points calculation + standings bonus
│   └── ui.js              # Render player view, sidebar, badges
└── data/
    ├── manifest.json      # Auto-generated list of player files
    ├── master.xlsx        # ← Replace with real results as games are played
    └── players/
        ├── david.xlsx     # One file per participant (name = display name)
        └── ...
```

## 🚀 Adding a participant

1. Participant fills `AC`/`AD` columns in their copy of `worldcup-2026.xlsx` with their predictions.
2. They also fill their name in **`Home!C10`** (the *Nombre* field).
3. You save the file as `<nombre>.xlsx` and drop it in `data/players/`.
4. Run `python3 update_manifest.py` → commits `data/manifest.json`.
5. Push → Render auto-deploys.

## 🏆 Scoring

| Acierto | Puntos |
|---------|--------|
| Resultado exacto | 6 |
| Ganador correcto + un marcador acertado | 4 |
| Ganador/empate correcto (sin marcadores) | 3 |
| Un marcador acertado (resultado incorrecto) | 1 |
| Nada acertado | 0 |

**Bono de posiciones**: 2 pts por cada equipo en la posición final correcta (configurable en `js/scorer.js → BONUS_PER_POSITION`).

## 📊 Actualizando resultados

Edita `data/master.xlsx` con los marcadores reales en las columnas `AC`/`AD` de la hoja `WORLDCUP`, guarda y haz push. El sitio recalcula todo automáticamente.

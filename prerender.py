"""
prerender.py — Build-time score computation.
Reads master.xlsx + every player Excel, scores all groups,
writes data/scores.json sorted by total points descending.

Replaces update_manifest.py (also regenerates the player list).
"""
import json, pathlib, re, sys
from datetime import timezone, timedelta

try:
    import openpyxl
except ImportError:
    sys.exit("Missing dependency: pip install openpyxl")

ROOT      = pathlib.Path(__file__).parent
PLAYERS   = ROOT / "data" / "players"
MASTER    = ROOT / "data" / "master.xlsx"
OUT       = ROOT / "data" / "scores.json"
NICKNAMES = ROOT / "data" / "nicknames.json"

GROUPS           = list("ABCDEFGHIJKL")
BONUS_PER_POS    = 1   # must match js/scorer.js

# openpyxl uses 1-based column numbers
COL_A  = 1
COL_X  = 24  # match datetime (naive, treated as UTC-4 = ET/VET)
COL_AA = 27   # home team name
COL_AC = 29   # home goals
COL_AD = 30   # away goals
COL_AF = 32   # away team name
COL_BD = 56   # standings team name

TZ_VET = timezone(timedelta(hours=-4))  # Venezuela/Eastern — same offset


PLACEHOLDER_NAMES = {"nombre", "name", "player", "jugador"}

# ── Excel parsing ─────────────────────────────────────────────────────────────

def _cell(ws, row, col):
    v = ws.cell(row, col).value
    return None if v == "" or v is None else v

def parse_player_name(wb, fallback):
    """Read Home!C10 for the player's real name; fall back to filename-derived name."""
    home = wb["Home"] if "Home" in wb.sheetnames else None
    if home:
        v = home.cell(10, 3).value  # C10
        if v and str(v).strip() and str(v).strip().lower() not in PLACEHOLDER_NAMES:
            return str(v).strip()
    return fallback

def _dt_to_ts(dt):
    """Convert a naive datetime (treated as VET/ET UTC-4) to a Unix timestamp."""
    if dt is None:
        return None
    return int(dt.replace(tzinfo=TZ_VET).timestamp())


def extract_fixtures_from_master(wb):
    """Extract all 72 match records from the master workbook.

    Returns a flat list of dicts (one per match, in sheet order):
      { ts, home, away, homeGoals, awayGoals }
    """
    ws = wb["WORLDCUP"]
    records = []
    for i in range(len(GROUPS)):
        for j in range(6):
            r  = (4 + 8 * i) + j
            dt = ws.cell(r, COL_X).value
            records.append({
                "ts":        _dt_to_ts(dt),
                "home":      str(_cell(ws, r, COL_AA) or "?"),
                "away":      str(_cell(ws, r, COL_AF) or "?"),
                "homeGoals": int(v) if (v := _cell(ws, r, COL_AC)) is not None else None,
                "awayGoals": int(v) if (v := _cell(ws, r, COL_AD)) is not None else None,
            })
    return records


def extract_predictions_flat(wb):
    """Extract predicted goals for all 72 matches from a player workbook.

    Returns a flat list of [homeGoals, awayGoals] pairs (None if not predicted).
    """
    ws = wb["WORLDCUP"]
    out = []
    for i in range(len(GROUPS)):
        for j in range(6):
            r  = (4 + 8 * i) + j
            hg = _cell(ws, r, COL_AC)
            ag = _cell(ws, r, COL_AD)
            out.append([
                int(hg) if hg is not None else None,
                int(ag) if ag is not None else None,
            ])
    return out


# Grid display name overrides — when the first name of the displayName
# doesn't match the real name (e.g. nickname IS the name, not in quotes).
_GRID_OVERRIDES = {
    'Serginho el m\u00edtico': 'Sergio',
    'Emmanuel Lambaz':      'Emma',
}


def grid_short_name(display_name, all_display_names):
    """Return the shortest unambiguous first name for the fixture grid."""
    if display_name in _GRID_OVERRIDES:
        return _GRID_OVERRIDES[display_name]
    clean = re.sub(r'"[^"]*"', '', display_name).strip()
    parts = clean.split()
    first = parts[0] if parts else display_name

    # Check for collisions with any other display name's first word
    others = [
        re.sub(r'"[^"]*"', '', n).strip().split()[0]
        for n in all_display_names
        if n != display_name
    ]
    if first in others and len(parts) >= 2:
        return f"{first} {parts[-1][0]}."
    return first


def parse_groups(path):
    """Return (player_name, groups, wb) from a player Excel file."""
    wb = openpyxl.load_workbook(path, data_only=True)
    if "WORLDCUP" not in wb.sheetnames:
        raise ValueError(f"No WORLDCUP sheet in {path.name}")
    ws = wb["WORLDCUP"]

    groups = []
    for i, letter in enumerate(GROUPS):
        match_start = 4 + 8 * i
        team_start  = 5 + 8 * i

        teams = []
        for j in range(4):
            v = _cell(ws, team_start + j, COL_A)
            teams.append(str(v) if v else f"Equipo{j+1}")

        matches = []
        for j in range(6):
            r = match_start + j
            home = str(_cell(ws, r, COL_AA) or "?")
            away = str(_cell(ws, r, COL_AF) or "?")
            hg   = _cell(ws, r, COL_AC)
            ag   = _cell(ws, r, COL_AD)
            matches.append({
                "home": home, "away": away,
                "homeGoals": int(hg) if hg is not None else None,
                "awayGoals": int(ag) if ag is not None else None,
            })

        groups.append({"letter": letter, "teams": teams, "matches": matches})

    player_name = parse_player_name(wb, display_name(path.name))
    return player_name, groups, wb


# ── Scoring (mirrors js/scorer.js) ───────────────────────────────────────────

def _outcome(h, a):
    return 1 if h > a else (-1 if h < a else 0)

def score_match(ph, pa, rh, ra):
    if rh is None or ra is None: return None   # not played
    if ph is None or pa is None: return 0      # no prediction
    exact_h = ph == rh
    exact_a = pa == ra
    correct  = _outcome(ph, pa) == _outcome(rh, ra)
    one_goal = exact_h or exact_a
    if exact_h and exact_a:  return 6
    if correct and one_goal: return 4
    if correct:              return 3
    if one_goal:             return 1
    return 0

def compute_standings(teams, matches):
    stats = {t: {"pts": 0, "gf": 0, "ga": 0} for t in teams}
    for m in matches:
        hg, ag = m["homeGoals"], m["awayGoals"]
        if hg is None or ag is None: continue
        h, a = m["home"], m["away"]
        stats[h]["gf"] += hg; stats[h]["ga"] += ag
        stats[a]["gf"] += ag; stats[a]["ga"] += hg
        if hg > ag:   stats[h]["pts"] += 3
        elif hg < ag: stats[a]["pts"] += 3
        else:         stats[h]["pts"] += 1; stats[a]["pts"] += 1
    return sorted(teams, key=lambda t: (
        -stats[t]["pts"],
        -(stats[t]["gf"] - stats[t]["ga"]),
        -stats[t]["gf"],
        t,
    ))

def score_player(player_groups, master_groups):
    total = 0
    counts = {"p6": 0, "p4": 0, "p3": 0, "p1": 0, "p0": 0}
    for pg, mg in zip(player_groups, master_groups):
        for pm, mm in zip(pg["matches"], mg["matches"]):
            pts = score_match(pm["homeGoals"], pm["awayGoals"],
                              mm["homeGoals"], mm["awayGoals"])
            if pts is not None:          # skip unplayed matches
                total += pts
                key = f"p{pts}"
                if key in counts:
                    counts[key] += 1

        group_done = all(m["homeGoals"] is not None for m in mg["matches"])
        if group_done:
            real_s = compute_standings(mg["teams"], mg["matches"])
            pred_s = compute_standings(pg["teams"], pg["matches"])
            for pos in range(4):
                if pred_s[pos] == real_s[pos]:
                    total += BONUS_PER_POS
    return total, counts


# ── Main ──────────────────────────────────────────────────────────────────────

def display_name(filename):
    base = filename.replace(".xlsx", "").replace(".XLSX", "")
    return base[0].upper() + base[1:] if base else filename

def load_nicknames():
    """Return filename->nickname dict, or empty dict if file missing."""
    if not NICKNAMES.exists():
        return {}
    return json.loads(NICKNAMES.read_text(encoding="utf-8"))


def main():
    nicknames = load_nicknames()
    # Load master results (optional — no master = all pending)
    master_groups    = None
    master_fixtures  = []   # flat list of 72 fixture records
    if MASTER.exists():
        try:
            master_wb = openpyxl.load_workbook(MASTER, data_only=True)
            _, master_groups, _ = parse_groups(MASTER)
            master_fixtures = extract_fixtures_from_master(master_wb)
            print(f"master.xlsx cargado")
        except Exception as e:
            print(f"\u26a0\ufe0f  master.xlsx no se pudo leer: {e}")
    else:
        print("\u26a0\ufe0f  master.xlsx no encontrado \u2014 puntos quedar\u00e1n pendientes")

    # Score every player file
    xlsx_files = sorted(
        f for f in PLAYERS.iterdir()
        if f.suffix.lower() == ".xlsx" and not f.name.startswith("~")
    )

    players = []
    player_preds = {}  # file -> flat predictions list (72 entries)
    for path in xlsx_files:
        fallback = display_name(path.name)
        try:
            excel_name, pg, wb = parse_groups(path)
            name = nicknames.get(path.name, excel_name)
            player_preds[path.name] = extract_predictions_flat(wb)
            if master_groups:
                pts, counts = score_player(pg, master_groups)
                print(f"  {name}: {pts} pts")
            else:
                pts, counts = None, None
                print(f"  {name}: pendiente")
        except Exception as e:
            name = nicknames.get(path.name, fallback)
            print(f"    {name}: error \u2014 {e}")
            pts, counts = None, None
            player_preds[path.name] = [[None, None]] * 72
        players.append({"file": path.name, "displayName": name,
                        "totalPoints": pts, "counts": counts})

    # Tiebreaker: pts desc -> p6 desc -> p4 desc -> p3 desc -> p1 desc -> name asc
    def sort_key(p):
        c = p["counts"] or {}
        return (
            p["totalPoints"] is None,
            -(p["totalPoints"] or 0),
            -c.get("p6", 0),
            -c.get("p4", 0),
            -c.get("p3", 0),
            -c.get("p1", 0),
            p["displayName"].lower(),   # final alphabetical tiebreaker
        )
    players.sort(key=sort_key)

    # Count matches played from master (both goals must be set)
    matches_played = 0
    if master_groups:
        for g in master_groups:
            for m in g["matches"]:
                if m.get("homeGoals") is not None and m.get("awayGoals") is not None:
                    matches_played += 1
    print(f"Matches played: {matches_played} / 72")

    # Position history: append only when new matches have been played since last run.
    # This reliably prevents double-runs (manual, CI, serve loop) from bloating history.
    history_map  = {}   # file -> list of past positions
    prev_matches = None # matchesPlayed stored from last run
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8"))
            prev_matches = old.get("matchesPlayed")
            for p in old.get("players", []):
                hist = p.get("positionHistory")
                # back-compat: migrate legacy prevPosition into a 2-entry list
                if not hist and p.get("position") is not None:
                    prev = p.get("prevPosition")
                    hist = ([prev, p["position"]] if prev and prev != p["position"]
                            else [p["position"]])
                history_map[p["file"]] = hist or []
        except Exception:
            pass

    # Assign current rank
    for rank, p in enumerate(players, start=1):
        p["position"] = rank

    # Only append to history if more matches have been played than last time.
    # If prev_matches is None the file predates this field — just bootstrap it,
    # do NOT treat it as a trigger to append.
    new_results = (prev_matches is not None
                   and matches_played > 0
                   and matches_played != prev_matches)

    for p in players:
        hist = list(history_map.get(p["file"]) or [])
        if new_results:
            hist.append(p["position"])
        p["positionHistory"] = hist
        p["prevPosition"]    = hist[-2] if len(hist) >= 2 else None

    # Build fixture grid — sorted alphabetically by first name for consistent columns
    all_names = [p["displayName"] for p in players]
    grid_players = sorted(
        players,
        key=lambda p: grid_short_name(p["displayName"], all_names).lower()
    )
    fixture_grid = [grid_short_name(p["displayName"], all_names) for p in grid_players]

    # Attach predictions to each fixture (one entry per grid player, in grid order)
    fixtures = []
    for idx, fix in enumerate(master_fixtures):
        preds = []
        for p in grid_players:
            pair = player_preds.get(p["file"], [[None, None]] * 72)
            entry = pair[idx] if idx < len(pair) else [None, None]
            preds.append(entry)
        fixtures.append({
            "ts":        fix["ts"],
            "home":      fix["home"],
            "away":      fix["away"],
            "homeGoals": fix["homeGoals"],
            "awayGoals": fix["awayGoals"],
            "preds":     preds,
        })
    # Sort by kickoff time
    fixtures.sort(key=lambda f: f["ts"] or 0)

    OUT.write_text(json.dumps(
        {
            "matchesPlayed": matches_played,
            "fixtureGrid":   fixture_grid,
            "fixtures":      fixtures,
            "players":       players,
        },
        ensure_ascii=False, indent=2,
    ))
    print(f"scores.json written -- {len(players)} participant(s)")
    if not players:
        sys.exit("ERROR: no player files found -- aborting build")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"ERROR: prerender.py crashed: {e}")

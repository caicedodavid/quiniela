"""
prerender.py — Build-time score computation.
Reads master.xlsx + every player Excel, scores all groups,
writes data/scores.json sorted by total points descending.

Replaces update_manifest.py (also regenerates the player list).
"""
import json, pathlib, sys

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
COL_AA = 27   # home team name
COL_AC = 29   # home goals
COL_AD = 30   # away goals
COL_AF = 32   # away team name
COL_BD = 56   # standings team name


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

def parse_groups(path):
    """Return (player_name, groups) from a player Excel file."""
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
    return player_name, groups


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
    for pg, mg in zip(player_groups, master_groups):
        for pm, mm in zip(pg["matches"], mg["matches"]):
            pts = score_match(pm["homeGoals"], pm["awayGoals"],
                              mm["homeGoals"], mm["awayGoals"])
            total += pts or 0

        group_done = all(m["homeGoals"] is not None for m in mg["matches"])
        if group_done:
            real_s = compute_standings(mg["teams"], mg["matches"])
            pred_s = compute_standings(pg["teams"], pg["matches"])
            for pos in range(4):
                if pred_s[pos] == real_s[pos]:
                    total += BONUS_PER_POS
    return total


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
    master_groups = None
    if MASTER.exists():
        try:
            _, master_groups = parse_groups(MASTER)
            print(f"master.xlsx cargado")
        except Exception as e:
            print(f"⚠️  master.xlsx no se pudo leer: {e}")
    else:
        print("⚠️  master.xlsx no encontrado — puntos quedarán pendientes")

    # Score every player file
    xlsx_files = sorted(
        f for f in PLAYERS.iterdir()
        if f.suffix.lower() == ".xlsx" and not f.name.startswith("~")
    )

    players = []
    for path in xlsx_files:
        fallback = display_name(path.name)
        try:
            excel_name, pg = parse_groups(path)
            # Priority: nicknames.json > Home!C10 > filename
            name = nicknames.get(path.name, excel_name)
            if master_groups:
                pts = score_player(pg, master_groups)
                print(f"  {name}: {pts} pts")
            else:
                pts = None
                print(f"  {name}: pendiente")
        except Exception as e:
            name = nicknames.get(path.name, fallback)
            print(f"    {name}: error — {e}")
            pts = None
        players.append({"file": path.name, "displayName": name, "totalPoints": pts})

    # Sort: scored players by pts desc, then unscored alphabetically at bottom
    players.sort(key=lambda p: (
        p["totalPoints"] is None,          # None → goes to bottom
        -(p["totalPoints"] or 0),
        p["displayName"].lower(),
    ))

    OUT.write_text(json.dumps({"players": players}, ensure_ascii=False, indent=2))
    print(f"scores.json written -- {len(players)} participant(s)")
    if not players:
        sys.exit("ERROR: no player files found -- aborting build")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"ERROR: prerender.py crashed: {e}")

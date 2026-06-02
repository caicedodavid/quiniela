/**
 * parser.js — Extracts group + match data from a worldcup Excel workbook.
 *
 * Sheet layout (WORLDCUP):
 *   Group i (A=0 … L=11):
 *     Match rows  : 4 + 8*i  … 9 + 8*i   (6 rows, cols AA/AF=teams, AC/AD=goals)
 *     Standings   : 6 + 4*i  … 9 + 4*i   (4 rows, col BD=team name)
 *   Team names    : col A, rows (5+8*i) … (8+8*i)
 */

const GROUPS = 'ABCDEFGHIJKL'.split('');

// Column letters → 0-based index (for XLSX.utils.encode_cell)
const COL = { A:0, AA:26, AC:28, AD:29, AF:31, BD:55, BM:64 };

function cellVal(ws, r, c) {
  // r = 1-based Excel row, c = 0-based col index
  const addr = XLSX.utils.encode_cell({ r: r - 1, c });
  const cell = ws[addr];
  if (!cell) return null;
  // Prefer cached value (.v) for formula cells
  const v = cell.v !== undefined ? cell.v : cell.w;
  return (v === '' || v === undefined) ? null : v;
}

/**
 * Parse a workbook buffer (ArrayBuffer) and return structured data.
 * @returns { playerName, groups }
 *   playerName: string (from Home!C10, fallback to filename)
 *   groups: Array<{ letter, teams, matches, standings }>
 *     matches: Array<{ home, away, homeGoals, awayGoals }>  (goals null if unplayed)
 *     standings: Array<string>  [1st, 2nd, 3rd, 4th] team names
 */
export function parseWorkbook(buffer, fallbackName = '?') {
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: false });

  // Player name from Home!C10
  let playerName = fallbackName;
  const homeSheet = wb.Sheets['Home'];
  if (homeSheet) {
    const nameCell = homeSheet['C10'];
    if (nameCell && nameCell.v && String(nameCell.v).trim() !== '' &&
        String(nameCell.v).trim().toLowerCase() !== 'nombre') {
      playerName = String(nameCell.v).trim();
    }
  }

  const ws = wb.Sheets['WORLDCUP'];
  if (!ws) throw new Error('No se encontró la hoja WORLDCUP');

  const groups = GROUPS.map((letter, i) => {
    const matchStart = 4 + 8 * i;   // first match row (1-based)
    const teamStart  = 5 + 8 * i;   // first team-name row (col A)
    const standStart = 6 + 4 * i;   // first standings row (col BD)

    // Team names from col A
    const teams = [];
    for (let j = 0; j < 4; j++) {
      teams.push(String(cellVal(ws, teamStart + j, COL.A) ?? `Equipo${j+1}`));
    }

    // 6 match fixtures
    const matches = [];
    for (let j = 0; j < 6; j++) {
      const r = matchStart + j;
      const home      = String(cellVal(ws, r, COL.AA) ?? '?');
      const away      = String(cellVal(ws, r, COL.AF) ?? '?');
      const homeGoals = cellVal(ws, r, COL.AC);
      const awayGoals = cellVal(ws, r, COL.AD);
      matches.push({
        home,
        away,
        homeGoals: homeGoals !== null ? Number(homeGoals) : null,
        awayGoals: awayGoals !== null ? Number(awayGoals) : null,
      });
    }

    // Standings: BD column gives team names in position order
    const standings = [];
    for (let j = 0; j < 4; j++) {
      const name = cellVal(ws, standStart + j, COL.BD);
      standings.push(name ? String(name) : teams[j]);
    }

    return { letter, teams, matches, standings };
  });

  return { playerName, groups };
}

/**
 * Compute group standings from match results (goals arrays).
 * Returns array of 4 team names sorted by: pts desc, GD desc, GF desc, name asc.
 */
export function computeStandings(teams, matches) {
  const stats = Object.fromEntries(teams.map(t => [t, { pts:0, gf:0, ga:0 }]));

  for (const { home, away, homeGoals, awayGoals } of matches) {
    if (homeGoals === null || awayGoals === null) continue;
    const hg = Number(homeGoals), ag = Number(awayGoals);
    stats[home].gf += hg; stats[home].ga += ag;
    stats[away].gf += ag; stats[away].ga += hg;
    if (hg > ag)      { stats[home].pts += 3; }
    else if (hg < ag) { stats[away].pts += 3; }
    else              { stats[home].pts += 1; stats[away].pts += 1; }
  }

  return [...teams].sort((a, b) => {
    const sa = stats[a], sb = stats[b];
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    const gdA = sa.gf - sa.ga, gdB = sb.gf - sb.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (sb.gf !== sa.gf) return sb.gf - sa.gf;
    return a.localeCompare(b);
  });
}

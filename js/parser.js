/**
 * parser.js — Extracts group + match data from a worldcup Excel workbook.
 */

const GROUPS = 'ABCDEFGHIJKL'.split('');

// Column letters → 0-based index (for XLSX.utils.encode_cell)
const COL = { A:0, AA:26, AC:28, AD:29, AF:31, BD:55, BM:64 };

export const ROUNDS_CONFIG = {
  round_32_16: {
    name: '16vos y 8vos de Final',
    sheetName: '16',
    rows: [...Array(16).keys()].map(x => x + 101).concat([...Array(8).keys()].map(x => x + 120))
  },
  quarters: {
    name: 'Cuartos de Final',
    sheetName: '4',
    rows: [131, 132, 133, 134]
  },
  semis_3rd: {
    name: 'Semifinales y 3er Puesto',
    sheetName: '2',
    rows: [138, 139, 143]
  },
  final: {
    name: 'Final',
    sheetName: '1',
    rows: [147]
  }
};

function cellVal(ws, r, c) {
  // r = 1-based Excel row, c = 0-based col index
  const addr = XLSX.utils.encode_cell({ r: r - 1, c });
  const cell = ws[addr];
  if (!cell) return null;
  // Prefer cached value (.v) for formula cells
  const v = cell.v !== undefined ? cell.v : cell.w;
  return (v === '' || v === undefined) ? null : v;
}

function parseKnockoutRound(ws, rows) {
  return rows.map(r => {
    const home      = String(cellVal(ws, r, COL.AA) ?? '?');
    const away      = String(cellVal(ws, r, COL.AF) ?? '?');
    const homeGoals = cellVal(ws, r, COL.AC);
    const awayGoals = cellVal(ws, r, COL.AD);
    return {
      home,
      away,
      homeGoals: homeGoals !== null ? Number(homeGoals) : null,
      awayGoals: awayGoals !== null ? Number(awayGoals) : null,
    };
  });
}

function parseKnockoutRoundCustom(ws, numMatches) {
  const matches = [];
  for (let idx = 0; idx < numMatches; idx++) {
    const r = idx + 1; // 1-based row index
    const home      = String(cellVal(ws, r, 0) ?? '?'); // A is 0
    const away      = String(cellVal(ws, r, 3) ?? '?'); // D is 3
    const homeGoals = cellVal(ws, r, 1); // B is 1
    const awayGoals = cellVal(ws, r, 2); // C is 2
    matches.push({
      home,
      away,
      homeGoals: homeGoals !== null ? Number(homeGoals) : null,
      awayGoals: awayGoals !== null ? Number(awayGoals) : null,
    });
  }
  return matches;
}

/**
 * Parse a workbook buffer (ArrayBuffer) and return structured data.
 * @returns { playerName, groups, rounds }
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

  const rounds = {};
  for (const [key, cfg] of Object.entries(ROUNDS_CONFIG)) {
    const isMaster = fallbackName.toLowerCase().includes('master');
    if (isMaster) {
      // Master is always in WORLDCUP sheet, standard rows
      rounds[key] = parseKnockoutRound(ws, cfg.rows);
    } else {
      // Player custom sheets
      if (key === 'round_32_16') {
        // First 16 matches from sheet '16'
        const matches16 = wb.Sheets['16'] ? parseKnockoutRoundCustom(wb.Sheets['16'], 16) : Array(16).fill(null).map(() => ({ home: '?', away: '?', homeGoals: null, awayGoals: null }));
        // Next 8 matches from sheet '8'
        const matches8 = wb.Sheets['8'] ? parseKnockoutRoundCustom(wb.Sheets['8'], 8) : Array(8).fill(null).map(() => ({ home: '?', away: '?', homeGoals: null, awayGoals: null }));
        rounds[key] = matches16.concat(matches8);
      } else {
        const ws_round = wb.Sheets[cfg.sheetName];
        if (ws_round) {
          rounds[key] = parseKnockoutRoundCustom(ws_round, cfg.rows.length);
        } else {
          rounds[key] = cfg.rows.map(() => ({
            home: '?', away: '?',
            homeGoals: null, awayGoals: null
          }));
        }
      }
    }
  }

  return { playerName, groups, rounds };
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

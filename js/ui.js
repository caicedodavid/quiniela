/**
 * ui.js — Renders the fantasy World Cup dashboard.
 * All text in Spanish.
 */

import { scoreGroup, scoreKnockoutRound, BONUS_PER_POSITION, ROUND_RULES } from './scorer.js';
import { ROUNDS_CONFIG } from './parser.js';

// ── Country code map (FIFA 3-letter codes) ────────────────────────────────────
export const TEAM_CODE = {
  'Alemania': 'GER', 'Arabia Saudita': 'KSA', 'Argelia': 'ALG',
  'Argentina': 'ARG', 'Australia': 'AUS', 'Austria': 'AUT',
  'Bosnia y Herzegovina': 'BIH', 'Brasil': 'BRA', 'B\u00e9lgica': 'BEL',
  'Cabo Verde': 'CPV', 'Canad\u00e1': 'CAN', 'Catar': 'QAT',
  'Colombia': 'COL', 'Corea del Sur': 'KOR', 'Costa de Marfil': 'CIV',
  'Croacia': 'CRO', 'Curazao': 'CUW', 'Ecuador': 'ECU',
  'Egipto': 'EGY', 'Escocia': 'SCO', 'Espa\u00f1a': 'ESP',
  'Estados Unidos': 'USA', 'Francia': 'FRA', 'Ghana': 'GHA',
  'Hait\u00ed': 'HAI', 'Inglaterra': 'ENG', 'Irak': 'IRQ',
  'Ir\u00e1n': 'IRN', 'Jap\u00f3n': 'JPN', 'Jordania': 'JOR',
  'Marruecos': 'MAR', 'M\u00e9xico': 'MEX', 'Noruega': 'NOR',
  'Nueva Zelanda': 'NZL', 'Panam\u00e1': 'PAN', 'Paraguay': 'PAR',
  'Pa\u00edses Bajos': 'NED', 'Portugal': 'POR', 'RD Congo': 'COD',
  'Rep\u00fablica Checa': 'CZE', 'Senegal': 'SEN', 'Sud\u00e1frica': 'RSA',
  'Suecia': 'SWE', 'Suiza': 'SUI', 'Turqu\u00eda': 'TUR',
  'T\u00fanez': 'TUN', 'Uruguay': 'URU', 'Uzbekist\u00e1n': 'UZB',
};

const MATCH_MAP = {
  // Dieciseisavos (D1-D16)
  '73': 'D1',  '76': 'D2',  '74': 'D3',  '75': 'D4',
  '78': 'D5',  '77': 'D6',  '79': 'D7',  '80': 'D8',
  '82': 'D9',  '81': 'D10', '84': 'D11', '83': 'D12',
  '85': 'D13', '88': 'D14', '86': 'D15', '87': 'D16',
  // Octavos (O1-O8)
  '90': 'O1',  '89': 'O2',  '91': 'O3',  '92': 'O4',
  '93': 'O5',  '94': 'O6',  '95': 'O7',  '96': 'O8',
  // Cuartos (C1-C4)
  '97': 'C1',  '98': 'C2',  '99': 'C3',  '100': 'C4',
  // Semis (S1-S2)
  '101': 'S1', '102': 'S2'
};

function formatTeamName(name) {
  if (!name) return '?';
  const prefix = name.substring(0, 1);
  const matchNum = name.substring(1);

  if ((prefix === 'W' || prefix === 'L') && MATCH_MAP[matchNum]) {
    const isWinner = prefix === 'W';
    const label = isWinner ? 'Ganador' : 'Perdedor';
    return `${label} ${MATCH_MAP[matchNum]}`;
  }

  // Fallbacks for special finals values
  if (name === 'WF') return 'Ganador F (Campeón)';
  if (name === 'LF') return 'Perdedor F (Subcampeón)';
  if (name === 'W34') return '3º Puesto';

  return name;
}

/** Full name on desktop, FIFA code on mobile */
function teamName(name) {
  const formatted = formatTeamName(name);
  const code = TEAM_CODE[formatted] ?? formatted;
  return `<span class="hidden md:inline">${formatted}</span><span class="md:hidden font-mono">${code}</span>`;
}

// ── Point badge styling ─────────────────────────────────────────────
export const BADGE = {
  exact:        'bg-green-500  text-white font-bold',
  oneGoal:      'bg-yellow-400 text-yellow-900 font-bold',
  outcome:      'bg-yellow-400 text-yellow-900 font-bold',
  wrongOneGoal: 'bg-red-400    text-white font-semibold',
  nothing:      'bg-red-700    text-white font-semibold',
  null:         'bg-gray-100   text-gray-400 italic',
};

function ptsBadge(points, reason, tier = null) {
  let cls = BADGE.null;
  if (points !== null) {
    if (tier && BADGE[tier]) {
      cls = BADGE[tier];
    } else {
      if (points === 6 || points === 10 || points === 16 || points === 24 || points === 36) cls = BADGE.exact;
      else if (points === 4 || points === 8 || points === 12 || points === 18 || points === 28) cls = BADGE.oneGoal;
      else if (points === 3 || points === 6 || points === 8 || points === 12 || points === 18) cls = BADGE.outcome;
      else if (points === 1 || points === 2 || points === 4 || points === 6 || points === 10) cls = BADGE.wrongOneGoal;
      else cls = BADGE.nothing;
    }
  }
  const label = points === null ? '—' : `${points}pts`;
  const tip = reason ? ` title="${reason}"` : '';
  return `<span class="inline-block px-2 py-0.5 rounded text-sm ${cls} cursor-default"${tip}>${label}</span>`;
}

function scoreFmt(h, a) {
  if (h === null || a === null) return '<span class="text-gray-400">–</span>';
  return `<span class="font-mono font-semibold text-xs md:text-sm whitespace-nowrap">${h} – ${a}</span>`;
}

// ── Group card ────────────────────────────────────────────────────────────────
function renderGroup(letter, groupResult, playerGroup) {
  const { matchResults, bonusPoints, groupComplete,
          playerFinalStandings, masterFinalStandings } = groupResult;

  const matchRows = matchResults.map((m, i) => {
    const pred   = scoreFmt(m.predH, m.predA);
    const real   = scoreFmt(m.realH, m.realA);
    const badge  = ptsBadge(m.points, m.reason, m.points === 6 ? 'exact' : m.points === 4 ? 'oneGoal' : m.points === 3 ? 'outcome' : m.points === 1 ? 'wrongOneGoal' : 'nothing');
    const played = m.realH !== null;
    const rowCls = !played ? 'bg-white' :
                   m.points === 6 ? 'bg-green-50'  :
                   m.points >= 3  ? 'bg-yellow-50' :
                   m.points === 1 ? 'bg-red-50'    : 'bg-red-100';
    return `
      <tr class="${rowCls} border-b border-gray-100 hover:brightness-95 transition-all">
        <td class="py-2 px-3 text-gray-500 text-xs w-6">${i+1}</td>
        <td class="py-2 px-3 text-right font-medium text-sm">${teamName(m.home)}</td>
        <td class="py-2 px-3 text-center text-xs text-gray-400">vs</td>
        <td class="py-2 px-3 font-medium text-sm">${teamName(m.away)}</td>
        <td class="py-2 px-3 text-center">${pred}</td>
        <td class="py-2 px-3 text-center">${real}</td>
        <td class="py-2 px-3 text-center">${badge}</td>
      </tr>`;
  }).join('');

  // Standings comparison (only when group is complete)
  let standingsHtml = '';
  if (groupComplete && playerFinalStandings && masterFinalStandings) {
    const stats = computeTableStats(playerGroup.teams, playerGroup.matches);
    const posRows = masterFinalStandings.map((realTeam, pos) => {
      const predTeam = playerFinalStandings[pos];
      const correct  = predTeam === realTeam;
      const st = stats[predTeam] ?? { pts:0, j:0, g:0, e:0, p:0, gf:0, gc:0 };
      return `
        <tr class="${correct ? 'bg-green-50' : 'bg-white'} border-b border-gray-100 text-xs">
          <td class="py-1.5 px-2 text-gray-400">${pos+1}°</td>
          <td class="py-1.5 px-2 font-medium">${teamName(realTeam)}</td>
          <td class="py-1.5 px-2 text-gray-500">${teamName(predTeam)}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.pts}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.g}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.e}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.p}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.gf}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.gc}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.gf - st.gc}</td>
          <td class="py-1.5 px-2 text-center font-bold">${correct
            ? `<span class="text-green-600">+${BONUS_PER_POSITION}</span>`
            : '<span class="text-gray-300">—</span>'}</td>
        </tr>`;
    }).join('');

    standingsHtml = `
      <div class="mt-4 border-t border-gray-200 pt-3 overflow-x-auto">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Posiciones finales
          <span class="ml-2 text-green-600 normal-case font-bold">+${bonusPoints} pts bono</span>
        </p>
        <table class="w-full text-left rounded overflow-hidden">
          <thead class="bg-gray-50 text-xs text-gray-400 uppercase">
            <tr>
              <th class="py-1 px-2">#</th>
              <th class="py-1 px-2">Real</th>
              <th class="py-1 px-2">Pred.</th>
              <th class="py-1 px-1 text-center">Pts</th>
              <th class="py-1 px-1 text-center">G</th>
              <th class="py-1 px-1 text-center">E</th>
              <th class="py-1 px-1 text-center">P</th>
              <th class="py-1 px-1 text-center">GF</th>
              <th class="py-1 px-1 text-center">GC</th>
              <th class="py-1 px-1 text-center">DG</th>
              <th class="py-1 px-2 text-center">Bono</th>
            </tr>
          </thead>
          <tbody>${posRows}</tbody>
        </table>
      </div>`;

  } else if (playerFinalStandings) {
    const played = matchResults.filter(m => m.realH !== null).length;
    const stats = computeTableStats(playerGroup.teams, playerGroup.matches);
    const predRows = playerFinalStandings.map((team, pos) => {
      const st = stats[team] ?? { pts:0, j:0, g:0, e:0, p:0, gf:0, gc:0 };
      return `
        <tr class="border-b border-gray-100 text-xs">
          <td class="py-1.5 px-2 text-gray-400">${pos+1}°</td>
          <td class="py-1.5 px-2 font-medium text-gray-700">${teamName(team)}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.pts}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.g}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.e}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.p}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.gf}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.gc}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.gf - st.gc}</td>
        </tr>`;
    }).join('');

    standingsHtml = `
      <div class="mt-4 border-t border-gray-200 pt-3 overflow-x-auto">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Posiciones predichas
          <span class="ml-2 text-gray-400 normal-case font-normal italic">(bono al terminar grupo — ${played}/6)</span>
        </p>
        <table class="w-full text-left rounded overflow-hidden">
          <thead class="bg-gray-50 text-xs text-gray-400 uppercase">
            <tr>
              <th class="py-1 px-2">#</th>
              <th class="py-1 px-2">Equipo</th>
              <th class="py-1 px-1 text-center">Pts</th>
              <th class="py-1 px-1 text-center">G</th>
              <th class="py-1 px-1 text-center">E</th>
              <th class="py-1 px-1 text-center">P</th>
              <th class="py-1 px-1 text-center">GF</th>
              <th class="py-1 px-1 text-center">GC</th>
              <th class="py-1 px-1 text-center">DG</th>
            </tr>
          </thead>
          <tbody>${predRows}</tbody>
        </table>
      </div>`;
  }

  const groupPts = matchResults.reduce((s, m) => s + (m.points ?? 0), 0) + bonusPoints;

  return `
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 md:mb-6">
      <header class="bg-gradient-to-r from-green-700 to-green-600 px-4 py-3 flex items-center justify-between">
        <h2 class="text-white font-bold text-base tracking-wide">Grupo ${letter}</h2>
        <span class="bg-white/20 text-white text-sm font-semibold px-3 py-0.5 rounded-full">${groupPts} pts</span>
      </header>
      <div class="p-2 md:p-4">
        <div class="overflow-x-auto">
          <table class="w-full min-w-0">
            <thead class="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th class="py-2 px-2 md:px-3 text-left w-6">#</th>
                <th class="py-2 px-2 md:px-3 text-right">LOC</th>
                <th class="py-2 px-1"></th>
                <th class="py-2 px-2 md:px-3 text-left">VIS</th>
                <th class="py-2 px-2 md:px-3 text-center">Pred.</th>
                <th class="py-2 px-2 md:px-3 text-center">Real</th>
                <th class="py-2 px-2 md:px-3 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>${matchRows}</tbody>
          </table>
        </div>
        ${standingsHtml}
      </div>
    </section>`;
}

function renderKnockoutCard(name, roundResult) {
  const { matchResults, totalPoints } = roundResult;

  const matchRows = matchResults.map((m, i) => {
    const pred   = scoreFmt(m.predH, m.predA);
    const real   = scoreFmt(m.realH, m.realA);
    const badge  = ptsBadge(m.points, m.reason, m.tier);
    const played = m.realH !== null;
    const rowCls = !played ? 'bg-white' :
                   m.points > 0 ? 'bg-green-50' : 'bg-red-100';
    return `
      <tr class="${rowCls} border-b border-gray-100 hover:brightness-95 transition-all">
        <td class="py-2 px-3 text-gray-500 text-xs w-6">${i+1}</td>
        <td class="py-2 px-3 text-right font-medium text-sm">${teamName(m.home)}</td>
        <td class="py-2 px-3 text-center text-xs text-gray-400">vs</td>
        <td class="py-2 px-3 font-medium text-sm">${teamName(m.away)}</td>
        <td class="py-2 px-3 text-center">${pred}</td>
        <td class="py-2 px-3 text-center">${real}</td>
        <td class="py-2 px-3 text-center">${badge}</td>
      </tr>`;
  }).join('');

  return `
    <section class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 md:mb-6">
      <header class="bg-gradient-to-r from-green-700 to-green-600 px-4 py-3 flex items-center justify-between">
        <h2 class="text-white font-bold text-base tracking-wide">${name}</h2>
        <span class="bg-white/20 text-white text-sm font-semibold px-3 py-0.5 rounded-full">${totalPoints} pts</span>
      </header>
      <div class="p-2 md:p-4">
        <div class="overflow-x-auto">
          <table class="w-full min-w-0">
            <thead class="text-xs text-gray-500 uppercase bg-gray-50">
              <tr>
                <th class="py-2 px-2 md:px-3 text-left w-6">#</th>
                <th class="py-2 px-2 md:px-3 text-right">LOC</th>
                <th class="py-2 px-1"></th>
                <th class="py-2 px-2 md:px-3 text-left">VIS</th>
                <th class="py-2 px-2 md:px-3 text-center">Pred.</th>
                <th class="py-2 px-2 md:px-3 text-center">Real</th>
                <th class="py-2 px-2 md:px-3 text-center">Pts</th>
              </tr>
            </thead>
            <tbody>${matchRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

// ── Standings stats (J G E P GF GC DG) from predicted matches ────────────────
function computeTableStats(teams, matches) {
  const s = Object.fromEntries(teams.map(t => [t, { pts:0, j:0, g:0, e:0, p:0, gf:0, gc:0 }]));
  for (const { home, away, homeGoals, awayGoals } of matches) {
    if (homeGoals === null || awayGoals === null) continue;
    const hg = Number(homeGoals), ag = Number(awayGoals);
    s[home].j++; s[away].j++;
    s[home].gf += hg; s[home].gc += ag;
    s[away].gf += ag; s[away].gc += hg;
    if      (hg > ag) { s[home].g++; s[away].p++;  s[home].pts += 3; }
    else if (hg < ag) { s[away].g++; s[home].p++;  s[away].pts += 3; }
    else              { s[home].e++; s[away].e++;   s[home].pts++;  s[away].pts++; }
  }
  return s;
}

window._profileCache = null;
window._activePlayerView = 'knockouts';

window._togglePlayerView = (viewId) => {
  window._activePlayerView = viewId;
  const { playerData, masterData, playerName, photoUrl, description } = window._profileCache;
  renderPlayerView(playerData, masterData, playerName, photoUrl, description);
};

// ── Main content area ─────────────────────────────────────────────────────────
export function renderPlayerView(playerData, masterData, playerName, photoUrl = '', description = '') {
  window._profileCache = { playerData, masterData, playerName, photoUrl, description };

  const groupResults = playerData.groups.map((pg, i) => {
    const mg = masterData.groups[i];
    return { letter: pg.letter, result: scoreGroup(pg, mg), playerGroup: pg };
  });

  const totalPointsGroups = groupResults.reduce(
    (s, { result }) => s + result.totalPoints, 0
  );

  const groupCards = groupResults
    .map(({ letter, result, playerGroup }) => renderGroup(letter, result, playerGroup))
    .join('');

  // Score all knockout stages
  const r32_16Result = scoreKnockoutRound(playerData.rounds.round_32_16, masterData.rounds.round_32_16, ROUND_RULES.round_32_16);
  const quartersResult = scoreKnockoutRound(playerData.rounds.quarters, masterData.rounds.quarters, ROUND_RULES.quarters);
  const semis_3rdResult = scoreKnockoutRound(playerData.rounds.semis_3rd, masterData.rounds.semis_3rd, ROUND_RULES.semis_3rd);
  const finalResult = scoreKnockoutRound(playerData.rounds.final, masterData.rounds.final, ROUND_RULES.final);

  // Divide round_32_16 into Dieciseisavos (first 16) and Octavos (next 8)
  const r32Result = {
    matchResults: r32_16Result.matchResults.slice(0, 16),
    totalPoints: r32_16Result.matchResults.slice(0, 16).reduce((s, m) => s + (m.points ?? 0), 0)
  };
  const r16Result = {
    matchResults: r32_16Result.matchResults.slice(16, 24),
    totalPoints: r32_16Result.matchResults.slice(16, 24).reduce((s, m) => s + (m.points ?? 0), 0)
  };

  // Divide semis_3rd into Semifinales (first 2) and Tercer Puesto (1 match)
  const semisResult = {
    matchResults: semis_3rdResult.matchResults.slice(0, 2),
    totalPoints: semis_3rdResult.matchResults.slice(0, 2).reduce((s, m) => s + (m.points ?? 0), 0)
  };
  const thirdResult = {
    matchResults: semis_3rdResult.matchResults.slice(2, 3),
    totalPoints: semis_3rdResult.matchResults.slice(2, 3).reduce((s, m) => s + (m.points ?? 0), 0)
  };

  // Render cards for knockouts
  const cardR32      = renderKnockoutCard("Dieciseisavos de Final (D1-D16)", r32Result);
  const cardR16      = renderKnockoutCard("Octavos de Final (O1-O8)", r16Result);
  const cardQuarters = renderKnockoutCard("Cuartos de Final (C1-C4)", quartersResult);
  const cardSemis    = renderKnockoutCard("Semifinales (S1-S2)", semisResult);
  const cardThird    = renderKnockoutCard("Tercer Puesto", thirdResult);
  const cardFinal    = renderKnockoutCard("Final", finalResult);

  const koCardsConcat = cardR32 + cardR16 + cardQuarters + cardSemis + cardThird + cardFinal;

  const totalPointsKOs = r32_16Result.totalPoints + quartersResult.totalPoints + semis_3rdResult.totalPoints + finalResult.totalPoints;
  const totalPoints = totalPointsGroups + totalPointsKOs;

  const isKnockouts = window._activePlayerView === 'knockouts';

  document.getElementById('main-content').innerHTML = `
    <!-- Encabezado del jugador -->
    <div class="mb-4 md:mb-6 bg-gradient-to-br from-green-800 to-green-600 rounded-2xl p-5 md:p-7 text-white shadow-lg">

      <!-- Top row: photo · name · points -->
      <div class="flex items-start gap-4">

        <!-- Photo / initials avatar -->
        <div class="w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-green-700 flex items-center justify-center">
          ${photoUrl
            ? `<img src="${photoUrl}" alt="${playerName}"
                   class="w-full h-full object-cover"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'" />
               <div class="w-full h-full hidden items-center justify-center text-2xl font-black text-green-400">
                 ${playerName.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()}
               </div>`
            : `<div class="w-full h-full flex items-center justify-center text-2xl font-black text-green-400">
                 ${playerName.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase()}
               </div>`
          }
        </div>

        <!-- Name -->
        <div class="flex-1 min-w-0">
          <h1 class="text-xl md:text-2xl font-extrabold leading-tight">${playerName}</h1>
        </div>

        <!-- Total points -->
        <div class="text-right flex-shrink-0">
          <span class="text-5xl md:text-6xl font-black leading-none">${totalPoints}</span>
          <p class="text-green-300 text-lg mt-0.5">pts</p>
        </div>

      </div>

      <!-- Description below row -->
      ${description ? `
        <div class="mt-2">
          <p id="desc-text"
             class="text-green-200 text-xs leading-relaxed whitespace-pre-line"
             style="display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;">${description.trim()}</p>
          <button id="desc-toggle"
                  onclick="
                    const t = document.getElementById('desc-text');
                    const expanded = t.style.webkitLineClamp === 'unset';
                    t.style.webkitLineClamp = expanded ? '3' : 'unset';
                    t.style.overflow = expanded ? 'hidden' : 'visible';
                    this.textContent = expanded ? 'Ver m\u00e1s' : 'Ver menos';
                  "
                  class="mt-1.5 text-yellow-300 hover:text-yellow-100 underline text-xs font-semibold transition-colors">
            Ver más
          </button>
        </div>` : ''}

    </div>

    <!-- Navigation Widget Tabs Selector -->
    <div class="flex border border-gray-200 mb-6 bg-white rounded-xl p-1 shadow-sm max-w-sm mx-auto">
      <button onclick="window._togglePlayerView('knockouts')"
              class="flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold transition-all text-center select-none
                     ${isKnockouts
                       ? 'bg-green-600 text-white shadow-sm'
                       : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
      >
        Rondas Eliminatorias
      </button>
      <button onclick="window._togglePlayerView('groups')"
              class="flex-1 py-2 px-3 rounded-lg text-xs md:text-sm font-bold transition-all text-center select-none
                     ${!isKnockouts
                       ? 'bg-green-600 text-white shadow-sm'
                       : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
      >
        Fase de Grupos
      </button>
    </div>

    <!-- Cards Display Area -->
    <div class="space-y-4">
      ${isKnockouts ? koCardsConcat : groupCards}
    </div>
  `;
}

export function renderLoading(name) {
  document.getElementById('main-content').innerHTML = `
    <div class="flex flex-col items-center justify-center h-64 text-gray-400">
      <svg class="animate-spin w-10 h-10 mb-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <p>Cargando predicciones de <strong>${name}</strong>…</p>
    </div>`;
}

export function renderError(msg) {
  document.getElementById('main-content').innerHTML = `
    <div class="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
      <span class="text-2xl"></span>
      <p>${msg}</p>
    </div>`;
}

const ROUND_HEADERS = {
  total:       ['ex', 'o1', 'ge', 'gl', '0p'],
  groups:      ['6p', '4p', '3p', '1p', '0p'],
  round_32_16: ['10p', '8p', '6p', '2p', '0p'],
  quarters:    ['16p', '12p', '8p', '4p', '0p'],
  semis_3rd:   ['24p', '18p', '12p', '6p', '0p'],
  final:       ['36p', '28p', '18p', '10p', '0p']
};

const ROUND_NAMES_SHORT = {
  total:       'Total',
  groups:      'Grupos',
  round_32_16: '16vos/8vos',
  quarters:    'Cuartos',
  semis_3rd:   'Semis/3er',
  final:       'Final'
};

function sumCountsAllRounds(p) {
  const totalCounts = { exact: 0, one_goal: 0, outcome: 0, wrong_one_goal: 0, nothing: 0 };
  if (!p.rounds) {
    const c = p.counts || {};
    return {
      exact: c.p6 || 0,
      one_goal: c.p4 || 0,
      outcome: c.p3 || 0,
      wrong_one_goal: c.p1 || 0,
      nothing: c.p0 || 0
    };
  }
  for (const rData of Object.values(p.rounds)) {
    const rc = rData.counts || {};
    totalCounts.exact += (rc.exact || 0);
    totalCounts.one_goal += (rc.one_goal || 0);
    totalCounts.outcome += (rc.outcome || 0);
    totalCounts.wrong_one_goal += (rc.wrong_one_goal || 0);
    totalCounts.nothing += (rc.nothing || 0);
  }
  return totalCounts;
}

function getPlayerRoundStats(p, roundId) {
  if (roundId === 'total') {
    const pts = p.totalPoints !== null ? p.totalPoints : 0;
    const c = sumCountsAllRounds(p);
    return { points: pts, counts: c };
  }
  const rData = p.rounds?.[roundId] || {
    points: 0,
    counts: { exact: 0, one_goal: 0, outcome: 0, wrong_one_goal: 0, nothing: 0 }
  };
  return {
    points: rData.points || 0,
    counts: rData.counts || { exact: 0, one_goal: 0, outcome: 0, wrong_one_goal: 0, nothing: 0 }
  };
}

export function renderWelcome(players, activeRoundId = 'groups') {
  // Sort players by total cumulative points descending
  const sortedPlayers = [...players].sort((a, b) => {
    const ptsA = a.totalPoints || 0;
    const ptsB = b.totalPoints || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const countsA = sumCountsAllRounds(a);
    const countsB = sumCountsAllRounds(b);
    if (countsB.exact !== countsA.exact) return countsB.exact - countsA.exact;
    if (countsB.one_goal !== countsA.one_goal) return countsB.one_goal - countsA.one_goal;
    if (countsB.outcome !== countsA.outcome) return countsB.outcome - countsA.outcome;
    if (countsB.wrong_one_goal !== countsA.wrong_one_goal) return countsB.wrong_one_goal - countsA.wrong_one_goal;
    return a.displayName.localeCompare(b.displayName);
  });

  const MEDALS = [
    '<span class="inline-flex w-5 h-5 rounded-full bg-yellow-400 text-yellow-900 text-[10px] font-black items-center justify-center">1</span>',
    '<span class="inline-flex w-5 h-5 rounded-full bg-gray-300  text-gray-700  text-[10px] font-black items-center justify-center">2</span>',
    '<span class="inline-flex w-5 h-5 rounded-full bg-orange-400 text-white     text-[10px] font-black items-center justify-center">3</span>',
  ];
  const ROW_CLS = [
    'bg-yellow-50 font-semibold',
    'bg-gray-50',
    'bg-orange-50',
    'bg-teal-50',
    'bg-teal-50',
  ];
  const DANGER_ROW = [
    'bg-[#c19a6b]',
    'bg-red-50/60',
    'bg-red-50/60',
  ];
  const lastIdx = sortedPlayers.length - 1;

  const rows = sortedPlayers.map((p, idx) => {
    const stats   = getPlayerRoundStats(p, activeRoundId);
    const c       = stats.counts;
    const pts     = p.totalPoints ?? '\u2014';
    const fromBot = lastIdx - idx;
    const bot3    = fromBot <= 2;
    const top5    = idx <= 4;
    const top3    = idx <= 2;

    let badge = '';
    if (top3) {
      badge = MEDALS[idx];
    } else if (idx === 3 || idx === 4) {
      badge = `<span class="inline-flex w-5 h-5 rounded-full bg-teal-500 text-white text-[10px] font-black items-center justify-center">${idx + 1}</span>`;
    } else if (bot3) {
      if (fromBot === 0) {
        badge = `<span class="inline-flex flex-col items-center leading-none"><span class="text-gray-600 text-[10px] font-semibold">${idx + 1}</span><span class="text-[10px]">\uD83D\uDCA9</span></span>`;
      } else {
        badge = `<span class="inline-flex w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black items-center justify-center">${idx + 1}</span>`;
      }
    }

    const rowCls = bot3 ? DANGER_ROW[fromBot] : (ROW_CLS[idx] ?? 'bg-white');
    const rank   = badge
      ? `<span class="inline-flex items-center gap-0.5 leading-none">${badge}</span>`
      : `<span class="text-gray-400 text-[11px]">${idx + 1}</span>`;

    let mov = '<span class="text-gray-300 text-xs">&mdash;</span>';
    const hist = p.positionHistory ?? [];
    const prevPos = hist.length >= 2 ? hist[hist.length - 2] : null;
    if (prevPos != null) {
      const diff = prevPos - p.position;
      if (diff > 0) {
        mov = `<span class="inline-flex items-center gap-0.5 text-green-600 text-xs font-bold">
                 <span>&#8593;</span><span>${diff}</span>
               </span>`;
      } else if (diff < 0) {
        mov = `<span class="inline-flex items-center gap-0.5 text-red-500 text-xs font-bold">
                 <span>&#8595;</span><span>${Math.abs(diff)}</span>
               </span>`;
      }
    }

    return `
      <tr class="${rowCls} border-b border-gray-100 hover:brightness-95 transition-all text-xs md:text-sm">
        <td class="py-2 px-0 text-center w-6">${rank}</td>
        <td class="py-2.5 px-1 text-center w-8">${mov}</td>
        <td class="py-2.5 px-3 text-sm">
          <button class="player-link text-left hover:text-green-700 hover:underline transition-colors font-medium text-xs md:text-sm"
                  data-file="${p.file}"
                  onclick="window._selectPlayer(this.dataset.file)">${p.displayName}</button>
        </td>
        <td class="py-2.5 px-2 text-center font-mono font-bold text-xs md:text-sm border-l border-gray-200">${pts}</td>
        <td class="py-2 px-1 text-center font-mono text-[11px] md:text-sm">${c.exact}</td>
        <td class="py-2 px-1 text-center font-mono text-[11px] md:text-sm">${c.one_goal}</td>
        <td class="py-2 px-1 text-center font-mono text-[11px] md:text-sm">${c.outcome}</td>
        <td class="py-2 px-1 text-center font-mono text-[11px] md:text-sm">${c.wrong_one_goal}</td>
        <td class="py-2 px-1 text-center font-mono text-[11px] md:text-sm">${c.nothing}</td>
      </tr>`;
  }).join('');

  // Copy-to-clipboard text
  const stripQuotes = name => name.replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim();
  const lastIdx2 = sortedPlayers.length - 1;
  const copyText = sortedPlayers.map((p, i) => {
    const fromBot = lastIdx2 - i;
    let prefix = '';
    if      (i === 0)       prefix = '\uD83C\uDFC6 ';
    else if (i <= 2)        prefix = '\uD83D\uDFE2';
    else if (i <= 4)        prefix = '\uD83D\uDFE1';
    else if (fromBot === 0) prefix = '\uD83D\uDCA9';
    else if (fromBot <= 2)  prefix = '\uD83D\uDD34';
    return `${prefix}${i + 1}. ${p.totalPoints}pts \u2014 ${stripQuotes(p.displayName)}`;
  }).join('\n');

  const headers = ROUND_HEADERS[activeRoundId] || ROUND_HEADERS.groups;
  const roundName = ROUND_NAMES_SHORT[activeRoundId] || ROUND_NAMES_SHORT.groups;

  document.getElementById('main-content').innerHTML = `
    <!-- Hero banner -->
    <div class="bg-gradient-to-br from-green-800 to-green-600 rounded-2xl p-5 md:p-7 text-white shadow-lg mb-6">
      <p class="text-green-300 text-xs uppercase tracking-widest font-semibold mb-1">Quiniela Mundial 2026</p>
      <h1 class="text-2xl md:text-3xl font-extrabold mb-1">Clasificación General</h1>
      <p class="text-green-300 text-sm">${sortedPlayers.length} participantes</p>
    </div>

    <div class="max-w-2xl mx-auto">
      <div id="fixture-widget" class="mb-4 md:mb-6"></div>

      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Líderes de la quiniela</h2>
        <button id="copy-standings-btn"
          class="flex items-center gap-1.5 text-xs bg-white border border-gray-300
                 hover:border-green-500 hover:text-green-700 text-gray-500
                 px-3 py-1.5 rounded-lg transition-colors font-medium shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copiar tabla
        </button>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-800 text-[10px] md:text-xs uppercase tracking-normal">
              <th class="py-2 px-0 text-center text-gray-400 w-6">#</th>
              <th class="py-2 px-1 w-8"></th>
              <th class="py-2 px-3 text-gray-300">Part.</th>
              <th class="py-2 px-2 text-center text-white font-bold border-l border-gray-600">Pts</th>
              <th class="py-2 px-1 text-center bg-green-500 text-white font-bold text-[9px] md:text-xs min-w-[32px]">${headers[0]}</th>
              <th class="py-2 px-1 text-center bg-yellow-400 text-yellow-900 font-bold text-[9px] md:text-xs min-w-[32px]">${headers[1]}</th>
              <th class="py-2 px-1 text-center bg-yellow-200 text-yellow-800 font-bold text-[9px] md:text-xs min-w-[32px]">${headers[2]}</th>
              <th class="py-2 px-1 text-center bg-red-400 text-white font-bold text-[9px] md:text-xs min-w-[32px]">${headers[3]}</th>
              <th class="py-2 px-1 text-center bg-red-700 text-white font-bold text-[9px] md:text-xs min-w-[32px]">${headers[4]}</th>
            </tr>
            <!-- Compact round controller row inside the table header -->
            <tr class="bg-gray-100 text-xs border-b border-gray-200">
              <th colspan="3" class="py-1"></th>
              <th class="border-l border-gray-200 py-1"></th>
              <th colspan="5" class="py-1 px-1">
                <div class="flex items-center justify-between mx-auto max-w-[170px]">
                  <button onclick="window._changeRound(-1)" 
                          class="px-1.5 py-px bg-white hover:bg-gray-200 border border-gray-300 rounded text-[10px] font-bold text-gray-700 transition-colors leading-none select-none">
                    &lsaquo;
                  </button>
                  <span class="font-extrabold text-[9px] md:text-[10px] uppercase tracking-wider text-green-700 font-mono text-center truncate px-1">
                    ${roundName}
                  </span>
                  <button onclick="window._changeRound(1)" 
                          class="px-1.5 py-px bg-white hover:bg-gray-200 border border-gray-300 rounded text-[10px] font-bold text-gray-700 transition-colors leading-none select-none">
                    &rsaquo;
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <p class="text-xs text-gray-400 mt-3 text-center p-3">
        Desempate: Pts &rarr; Exacto &rarr; Ganador+1G &rarr; Ganador &rarr; Un Gol
      </p>
    </div>`;

  document.getElementById('copy-standings-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(copyText).then(() => {
      const btn = document.getElementById('copy-standings-btn');
      btn.textContent = 'Copiado!';
      btn.classList.add('text-green-700', 'border-green-500');
      setTimeout(() => {
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none"
               viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copiar tabla`;
        btn.classList.remove('text-green-700', 'border-green-500');
      }, 2000);
    });
  });
}

// ── Sidebar + mobile select ─────────────────────────────────────────────
export function renderSidebar(players, activeFile) {
  const items = players.map(p => {
    const active = p.file === activeFile;
    const ptsLabel = p.totalPoints !== null
      ? `<span class="text-xs font-mono shrink-0 ${active ? 'text-green-200' : 'text-gray-400'}">${p.totalPoints}pts</span>`
      : `<span class="text-xs shrink-0 ${active ? 'text-green-300' : 'text-gray-300'} italic">--</span>`;
    return `
      <li>
        <button
          data-file="${p.file}"
          class="player-btn w-full text-left px-3 py-1.5 rounded-md transition-all
                 flex items-center justify-between gap-2
                 ${active
                   ? 'bg-green-600 text-white font-semibold shadow-sm'
                   : 'text-gray-700 hover:bg-green-50 hover:text-green-800'}"
        >
          <span class="text-xs font-medium truncate">${p.displayName}</span>
          ${ptsLabel}
        </button>
      </li>`;
  }).join('');
  document.getElementById('player-list').innerHTML = items;

  const sel = document.getElementById('mobile-player-select');
  if (sel) {
    sel.innerHTML = `<option value="">Participante…</option>` +
      players.map(p =>
        `<option value="${p.file}" ${p.file === activeFile ? 'selected' : ''}>
          ${p.displayName}${p.totalPoints !== null ? ` — ${p.totalPoints}pts` : ''}
        </option>`
      ).join('');
  }
}

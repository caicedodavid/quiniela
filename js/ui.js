
/**
 * ui.js — Renders the fantasy World Cup dashboard.
 * All text in Spanish.
 */

import { scoreGroup, BONUS_PER_POSITION } from './scorer.js';

// ── Country code map (FIFA 3-letter codes) ────────────────────────────────────
const TEAM_CODE = {
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

/** Full name on desktop, FIFA code on mobile */
function teamName(name) {
  const code = TEAM_CODE[name] ?? name;
  return `<span class="hidden md:inline">${name}</span><span class="md:hidden font-mono">${code}</span>`;
}

// ── Point badge styling ───────────────────────────────────────────────────────
const BADGE = {
  6:    'bg-green-500  text-white font-bold',
  4:    'bg-yellow-400 text-yellow-900 font-bold',
  3:    'bg-yellow-400 text-yellow-900 font-bold',
  1:    'bg-red-400    text-white font-semibold',
  0:    'bg-red-700    text-white font-semibold',
  null: 'bg-gray-100   text-gray-400 italic',
};

function ptsBadge(points, reason) {
  const cls = BADGE[points] ?? BADGE[null];
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
    const badge  = ptsBadge(m.points, m.reason);
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
    // Group done: show real vs predicted with bonus + stats
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
          <td class="py-1.5 px-1 text-center text-gray-500">${st.j}</td>
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
              <th class="py-1 px-1 text-center">J</th>
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
    // Group not done yet: show predicted positions + stats
    const played = matchResults.filter(m => m.realH !== null).length;
    const stats = computeTableStats(playerGroup.teams, playerGroup.matches);
    const predRows = playerFinalStandings.map((team, pos) => {
      const st = stats[team] ?? { pts:0, j:0, g:0, e:0, p:0, gf:0, gc:0 };
      return `
        <tr class="border-b border-gray-100 text-xs">
          <td class="py-1.5 px-2 text-gray-400">${pos+1}°</td>
          <td class="py-1.5 px-2 font-medium text-gray-700">${teamName(team)}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.pts}</td>
          <td class="py-1.5 px-1 text-center text-gray-500">${st.j}</td>
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
              <th class="py-1 px-1 text-center">J</th>
              <th class="py-1 px-1 text-center">G</th>
              <th class="py-1 px-1 text-center">E</th>
              <th class="py-1 px-1 text-center">P</th>
              <th class="py-1 px-1 text-center">GF</th>
              <th class="py-1 px-1 text-center">GC</th>
              <th class="py-1 px-1 text-center">DG</th>
            </tr>
          </thead>
          </thead>
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

// ── Main content area ─────────────────────────────────────────────────────────
export function renderPlayerView(playerData, masterData, playerName) {
  const groupResults = playerData.groups.map((pg, i) => {
    const mg = masterData.groups[i];
    return { letter: pg.letter, result: scoreGroup(pg, mg), playerGroup: pg };
  });

  const totalPoints = groupResults.reduce(
    (s, { result }) => s + result.totalPoints, 0
  );

  const groupCards = groupResults
    .map(({ letter, result, playerGroup }) => renderGroup(letter, result, playerGroup))
    .join('');

  document.getElementById('main-content').innerHTML = `
    <!-- Encabezado del jugador -->
    <div class="mb-4 md:mb-8 bg-gradient-to-br from-green-800 to-green-600 rounded-2xl p-4 md:p-6 text-white shadow-lg">
      <p class="text-green-300 text-xs uppercase tracking-widest font-semibold mb-1">Quiniela de</p>
      <h1 class="text-2xl md:text-3xl font-extrabold mb-3">${playerName}</h1>
      <div class="flex items-end gap-2">
        <span class="text-5xl md:text-6xl font-black leading-none">${totalPoints}</span>
        <span class="text-green-300 text-lg md:text-xl mb-1">puntos totales</span>
      </div>
      <p class="text-green-400 text-xs mt-2">
        (bono posiciones: ${BONUS_PER_POSITION} pts por posición correcta al finalizar cada grupo)
      </p>
    </div>

    <!-- Grupos -->
    ${groupCards}
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
      <span class="text-2xl">⚠️</span>
      <p>${msg}</p>
    </div>`;
}

export function renderWelcome() {
  document.getElementById('main-content').innerHTML = `
    <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-4 py-24">
      <span class="text-7xl">⚽</span>
      <p class="text-xl font-semibold text-gray-500">Mundial 2026</p>
      <p class="text-sm">Selecciona un participante del menú para ver sus predicciones</p>
    </div>`;
}

// ── Sidebar + mobile select ─────────────────────────────────────────────
export function renderSidebar(players, activeFile) {
  // Desktop sidebar buttons
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

  // Mobile select
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

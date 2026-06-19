/**
 * fixtures.js — Fixture prediction grid widget.
 *
 * Shows the current/next match and every player's predicted score
 * in a compact 4x4 + 2-player grid sorted alphabetically by first name.
 *
 * "Current match" logic:
 *   Find the fixture whose ts is the smallest value >= (now - 2h).
 *   This covers: match started up to 2 hours ago (in play) or upcoming.
 */

import { TEAM_CODE, BADGE } from './ui.js';

const TWO_HOURS = 2 * 60 * 60; // seconds

function currentFixtureIndex(fixtures) {
  const nowSec = Date.now() / 1000;
  const cutoff = nowSec - TWO_HOURS;
  const candidates = fixtures
    .map((f, i) => ({ i, ts: f.ts }))
    .filter(x => x.ts >= cutoff)
    .sort((a, b) => a.ts - b.ts);
  if (candidates.length > 0) return candidates[0].i;
  // All matches done — show the most recent one
  return fixtures.reduce((best, f, i) =>
    f.ts > (fixtures[best]?.ts ?? -Infinity) ? i : best, 0);
}

function formatKickoff(ts) {
  return new Date(ts * 1000).toLocaleString('es-VE', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Caracas',
  });
}

function scoreMatch(ph, pa, rh, ra) {
  const outcome = (h, a) => h > a ? 1 : h < a ? -1 : 0;
  const exactH  = ph === rh, exactA = pa === ra;
  const correct = outcome(ph, pa) === outcome(rh, ra);
  if (exactH && exactA)              return 6;
  if (correct && (exactH || exactA)) return 4;
  if (correct)                       return 3;
  if (exactH || exactA)              return 1;
  return 0;
}

function predCell(pred, actual) {
  const [ph, pa] = pred ?? [null, null];
  if (ph === null || pa === null) return `<span class="text-gray-300">—</span>`;
  if (actual.homeGoals === null) {
    let bgCls = '';
    if (ph > pa) {
      bgCls = 'bg-blue-100 text-blue-800 border border-blue-200/50';
    } else if (ph < pa) {
      bgCls = 'bg-purple-100 text-purple-800 border border-purple-200/50';
    } else {
      bgCls = 'bg-orange-100 text-orange-800 border border-orange-200/50';
    }
    return `<span class="inline-block px-1 py-px rounded text-[9px] font-bold ${bgCls}">${ph}-${pa}</span>`;
  }

  const pts = scoreMatch(ph, pa, actual.homeGoals, actual.awayGoals);
  const cls = (BADGE[pts] ?? BADGE[0]).replace('font-bold', '').replace('font-semibold', '');
  return `<span class="inline-block px-1 py-px rounded text-[9px] font-bold ${cls}">${ph}-${pa}</span>`;
}

function renderGrid(gridNames, preds, actual) {
  const COLS = 5;
  const rows = [];
  for (let r = 0; r < Math.ceil(gridNames.length / COLS); r++) {
    const slice    = gridNames.slice(r * COLS, r * COLS + COLS);
    const leftover = COLS - slice.length;
    const padL     = Math.floor(leftover / 2);
    const padR     = Math.ceil(leftover / 2);

    const spacer = `<div class="invisible" aria-hidden="true"></div>`;
    const cells  = slice.map((name, ci) => {
      const gi = r * COLS + ci;
      return `<div class="flex flex-col items-center bg-gray-50 rounded-lg px-1 py-1.5 min-w-0">
        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide truncate w-full text-center leading-none">${name}</span>
        <span class="text-xs mt-0.5 leading-none">${predCell(preds[gi], actual)}</span>
      </div>`;
    }).join('');

    rows.push(`<div class="grid grid-cols-5 gap-1.5">${spacer.repeat(padL)}${cells}${spacer.repeat(padR)}</div>`);
  }
  return rows.join('');
}

function voteCircles(fix) {
  let home = 0, draw = 0, away = 0;
  fix.preds.forEach(([ph, pa]) => {
    if (ph === null || pa === null) return;
    if (ph > pa) home++;
    else if (ph < pa) away++;
    else draw++;
  });
  const total = home + draw + away;
  if (total === 0) return '';

  const pct  = n => total ? Math.round(n / total * 100) : 0;
  const shortName = t => TEAM_CODE[t] ?? t.split(' ')[0];

  const fill = (n, color, label) => {
    const p = pct(n);
    return `<div class="relative w-10 h-10 rounded-full border-2 ${color.border} overflow-hidden bg-white">
      <div class="absolute bottom-0 left-0 w-full ${color.bg} transition-all" style="height:${p}%"></div>
      <span class="absolute inset-0 flex flex-col items-center justify-center z-10 text-gray-800" style="text-shadow:0 0 3px #fff,0 0 3px #fff">
        <span class="text-[7px] font-bold leading-none">${label}</span>
        <span class="text-[8px] font-black leading-none mt-0.5">${p}%</span>
      </span>
    </div>`;
  };

  return `<div class="flex justify-around items-center pt-3 border-t border-gray-100 mt-2">
    ${fill(home, { bg: 'bg-blue-400', border: 'border-blue-200' }, shortName(fix.home))}
    ${fill(draw, { bg: 'bg-orange-400', border: 'border-orange-200' }, 'Emp.')}
    ${fill(away, { bg: 'bg-purple-400',  border: 'border-purple-200'  }, shortName(fix.away))}
  </div>`;
}

function buildHtml(scores, idx) {
  const { fixtures, fixtureGrid: gridNames } = scores;
  const fix    = fixtures[idx];
  const nowSec = Date.now() / 1000;
  const hasResult = fix.homeGoals !== null;
  const isOver     = fix.ts < nowSec - TWO_HOURS;
  const isPlayed   = hasResult || isOver;
  const isLive     = !isPlayed && fix.ts <= nowSec;
  const isUpcoming = fix.ts > nowSec;

  const badge =
    isPlayed   ? `<span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Jugado</span>` :
    isLive     ? `<span class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold animate-pulse">En juego</span>` :
    isUpcoming ? `<span class="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">Pr\u00f3ximo</span>` : '';

  const scoreStr = hasResult
    ? `<span class="font-black text-gray-800">${fix.homeGoals} \u2013 ${fix.awayGoals}</span>`
    : `<span class="text-gray-400 text-xs">${isUpcoming || isLive ? formatKickoff(fix.ts) : '\u2014'}</span>`;

  const nav = (dir, label) => {
    const target = idx + dir;
    const ok     = target >= 0 && target < fixtures.length;
    return ok
      ? `<button id="fix-${dir > 0 ? 'next' : 'prev'}" class="text-gray-400 hover:text-gray-600 px-1 text-xl leading-none transition-colors">${label}</button>`
      : `<span class="px-1 text-xl text-transparent">${label}</span>`;
  };

  return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
      <div class="flex items-center justify-between mb-2">
        ${nav(-1, '&lsaquo;')}
        <div class="flex-1 text-center min-w-0 px-1">
          <div class="flex items-center justify-center gap-1.5 flex-wrap">
            <span class="text-sm font-bold text-gray-800">${fix.home} vs ${fix.away}</span>
            ${badge}
          </div>
          <div class="mt-0.5">${scoreStr}</div>
        </div>
        ${nav(+1, '&rsaquo;')}
      </div>
      <div class="space-y-1.5">${renderGrid(gridNames, fix.preds, fix)}</div>
      ${voteCircles(fix)}
    </div>`;
}

export function renderFixtureWidget(container, scores) {
  if (!scores?.fixtures?.length || !scores?.fixtureGrid?.length) return;
  let idx = currentFixtureIndex(scores.fixtures);

  function draw() {
    container.innerHTML = buildHtml(scores, idx);
    container.querySelector('#fix-prev')?.addEventListener('click', () => { idx--; draw(); });
    container.querySelector('#fix-next')?.addEventListener('click', () => { idx++; draw(); });
  }
  draw();
}

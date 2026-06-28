/**
 * app.js — Orchestrator: loads manifest, lazy-loads player Excel files,
 * wires up UI events. Only the selected player's Excel is fetched at a time.
 */

import { parseWorkbook, computeStandings, ROUNDS_CONFIG } from './parser.js';
import { scoreGroup, scoreKnockoutRound, BONUS_PER_POSITION, ROUND_RULES } from './scorer.js';
import { renderPlayerView, renderSidebar, renderLoading, renderError, renderWelcome } from './ui.js';
import { renderFixtureWidget } from './fixtures.js';

// Expose computeStandings for scorer.js (avoids circular import via window bridge)
window._parserModule = { computeStandings };

// Keep sidebar footer in sync with the actual constant
const bonusLabel = document.getElementById('bonus-label');
if (bonusLabel) bonusLabel.textContent = `${BONUS_PER_POSITION} pt${BONUS_PER_POSITION === 1 ? '' : 's'}`;

const MASTER_PATH       = 'data/master.xlsx';
const SCORES_PATH       = 'data/scores.json';
const DESCRIPTIONS_PATH = 'data/descriptions.json';
const PHOTOS_PATH       = 'data/photos.json';

let players      = [];
let descriptions = {};
let photos       = {};
let scores       = null;
let activeFile   = null;

export const ROUNDS = [
  { id: 'total', name: 'Total Acumulado' },
  { id: 'groups', name: 'Fase de Grupos' },
  { id: 'round_32_16', name: '16vos y 8vos' },
  { id: 'quarters', name: 'Cuartos' },
  { id: 'semis_3rd', name: 'Semis y 3er puesto' },
  { id: 'final', name: 'Final' }
];

window._activeRoundId = 'groups';

window._changeRound = (dir) => {
  const currentIndex = ROUNDS.findIndex(r => r.id === window._activeRoundId);
  let nextIndex = currentIndex + dir;
  if (nextIndex < 0) nextIndex = ROUNDS.length - 1;
  if (nextIndex >= ROUNDS.length) nextIndex = 0;
  window._activeRoundId = ROUNDS[nextIndex].id;
  showWelcome();
};

function getLatestActiveRound(scores) {
  const fixtures = scores.fixtures || [];
  if (fixtures.length === 0) return 'groups';
  
  if (fixtures[103] && fixtures[103].homeGoals !== null) return 'final';
  if (fixtures.slice(100, 103).some(f => f.homeGoals !== null)) return 'semis_3rd';
  if (fixtures.slice(96, 100).some(f => f.homeGoals !== null)) return 'quarters';
  if (fixtures.slice(72, 96).some(f => f.homeGoals !== null)) return 'round_32_16';
  
  const groupsDone = fixtures.slice(0, 72).every(f => f.homeGoals !== null);
  if (groupsDone) return 'round_32_16';
  
  return 'groups';
}

// Expose selectPlayer for inline onclick in leaderboard name links
window._selectPlayer = (file) => selectPlayer(file);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  try {
    const [scoresRes, descRes, photosRes] = await Promise.all([
      fetch(`${SCORES_PATH}?t=${Date.now()}`),
      fetch(`${DESCRIPTIONS_PATH}?t=${Date.now()}`),
      fetch(`${PHOTOS_PATH}?t=${Date.now()}`),
    ]);
    if (!scoresRes.ok) throw new Error(`scores.json: ${scoresRes.status}`);
    scores       = await scoresRes.json();
    descriptions = descRes.ok   ? await descRes.json()   : {};
    photos       = photosRes.ok ? await photosRes.json() : {};
  } catch (e) {
    document.getElementById('player-list').innerHTML =
      `<li class="px-4 py-3 text-red-400 text-sm">Error cargando participantes: ${e.message}</li>`;
    return;
  }

  // Players arrive pre-sorted by points from prerender.py
  players = scores.players.map(p => ({
    file:            p.file,
    displayName:     p.displayName,
    totalPoints:     p.totalPoints,
    counts:          p.counts          ?? null,
    position:        p.position        ?? null,
    positionHistory: p.positionHistory ?? [],
    rounds:          p.rounds          ?? null,
  }));
  
  window._matchesPlayed = scores.matchesPlayed ?? 0;
  window._activeRoundId = getLatestActiveRound(scores);

  renderSidebar(players, null);
  showWelcome();

  // Desktop sidebar clicks
  document.getElementById('player-list').addEventListener('click', e => {
    const btn = e.target.closest('.player-btn');
    if (btn) selectPlayer(btn.dataset.file);
  });

  // Mobile select
  document.getElementById('mobile-player-select').addEventListener('change', e => {
    if (e.target.value) selectPlayer(e.target.value);
  });
}

// Excel does an atomic rename on save; the file can vanish for ~500 ms.
async function fetchWithRetry(url, retries = 3, delayMs = 800) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } catch (e) {
      if (attempt === retries) throw e;
      console.warn(`Intento ${attempt} fallido para ${url} — reintentando…`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ── Master file — always fresh, never cached ──────────────────────────────────
async function loadMaster() {
  try {
    const buf = await fetchWithRetry(MASTER_PATH);
    return parseWorkbook(buf, 'master');
  } catch (e) {
    console.warn('No se pudo cargar resultados reales:', e.message);
    return null;
  }
}

// ── Player selection ──────────────────────────────────────────────────────────
async function selectPlayer(file) {
  activeFile = file;
  const player = players.find(p => p.file === file);
  const nickname = player?.displayName ?? displayName(file);

  renderLoading(nickname);
  renderSidebar(players, activeFile);

  try {
    const [playerBuf, master] = await Promise.all([
      fetchWithRetry(`data/players/${encodeURIComponent(file)}`),
      loadMaster(),
    ]);
    const playerData = parseWorkbook(playerBuf, nickname);
    const effectiveMaster = master ?? buildEmptyMaster(playerData);
    const photoFile  = photos[file] ?? '';
    const photoUrl    = photoFile ? `data/photos/${photoFile}` : '';
    const description = descriptions[file] ?? '';

    renderPlayerView(playerData, effectiveMaster, nickname, photoUrl, description);

    // Update total pts in sidebar
    const idx = players.findIndex(p => p.file === file);
    if (idx !== -1) {
      let pts = playerData.groups.reduce((sum, pg, i) => {
        const { totalPoints } = scoreGroup(pg, effectiveMaster.groups[i]);
        return sum + totalPoints;
      }, 0);

      // Add knockout rounds points
      for (const [key, cfg] of Object.entries(ROUNDS_CONFIG)) {
        const pm = playerData.rounds[key];
        const mm = effectiveMaster.rounds[key];
        if (pm && mm) {
          pts += scoreKnockoutRound(pm, mm, cfg.rules).totalPoints;
        }
      }

      players[idx].totalPoints = pts;
      renderSidebar(players, activeFile);
    }
  } catch (e) {
    renderError(`Error cargando el archivo de ${nickname}: ${e.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "la lacra.xlsx" → "La lacra",  "david.xlsx" → "David" */
function displayName(filename) {
  const base = filename.replace(/\.xlsx$/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * If master.xlsx isn't available yet, build a "no results" placeholder
 * so the UI still renders (all matches show as pending).
 */
function buildEmptyMaster(playerData) {
  const emptyMaster = {
    playerName: 'master',
    groups: playerData.groups.map(g => ({
      ...g,
      matches: g.matches.map(m => ({ ...m, homeGoals: null, awayGoals: null })),
    })),
    rounds: {}
  };
  for (const [key, matches] of Object.entries(playerData.rounds || {})) {
    emptyMaster.rounds[key] = matches.map(m => ({ ...m, homeGoals: null, awayGoals: null }));
  }
  return emptyMaster;
}

init();

// ── Permanent top-level listeners (survive every renderWelcome / renderPlayerView) ──

function showWelcome() {
  renderWelcome(players, window._activeRoundId);
  renderFixtureWidget(document.getElementById('fixture-widget'), scores);
}

function goHome() {
  activeFile = null;
  renderSidebar(players, null);
  showWelcome();
  const sel = document.getElementById('mobile-player-select');
  if (sel) sel.value = '';
}
document.getElementById('mobile-home-btn').addEventListener('click', goHome);
document.getElementById('desktop-home-btn').addEventListener('click', goHome);

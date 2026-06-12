/**
 * app.js — Orchestrator: loads manifest, lazy-loads player Excel files,
 * wires up UI events. Only the selected player's Excel is fetched at a time.
 */

import { parseWorkbook, computeStandings } from './parser.js';
import { scoreGroup, BONUS_PER_POSITION } from './scorer.js';
import { renderPlayerView, renderSidebar, renderLoading, renderError, renderWelcome } from './ui.js';

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
let activeFile   = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  let scores;
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
    file:         p.file,
    displayName:  p.displayName,
    totalPoints:  p.totalPoints,
    counts:       p.counts       ?? null,
    position:     p.position     ?? null,
    prevPosition: p.prevPosition ?? null,
  }));

  renderSidebar(players, null);
  renderWelcome(players);

  // Wire up desktop sidebar buttons
  document.getElementById('player-list').addEventListener('click', e => {
    const btn = e.target.closest('.player-btn');
    if (btn) selectPlayer(btn.dataset.file);
  });

  // Wire up mobile player select
  document.getElementById('mobile-player-select').addEventListener('change', e => {
    if (e.target.value) selectPlayer(e.target.value);
  });

  // Logo buttons → go home
  const goHome = () => {
    activeFile = null;
    renderSidebar(players, null);
    renderWelcome(players);
    document.getElementById('mobile-player-select').value = '';
  };
  document.getElementById('mobile-home-btn').addEventListener('click', goHome);
  document.getElementById('desktop-home-btn').addEventListener('click', goHome);
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
      players[idx].totalPoints = playerData.groups.reduce((sum, pg, i) => {
        const { totalPoints } = scoreGroup(pg, effectiveMaster.groups[i]);
        return sum + totalPoints;
      }, 0);
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
  return {
    playerName: 'master',
    groups: playerData.groups.map(g => ({
      ...g,
      matches: g.matches.map(m => ({ ...m, homeGoals: null, awayGoals: null })),
    })),
  };
}

init();

// ── Home button — wired outside init() so it always attaches ─────────────────
// (init is async; if it throws before the listeners, clicks would be dead)
function goHome() {
  activeFile = null;
  renderSidebar(players, null);
  renderWelcome(players);
  const sel = document.getElementById('mobile-player-select');
  if (sel) sel.value = '';
}
document.getElementById('mobile-home-btn').addEventListener('click', goHome);
document.getElementById('desktop-home-btn').addEventListener('click', goHome);

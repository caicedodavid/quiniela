/**
 * app.js — Orchestrator: loads manifest, lazy-loads player Excel files,
 * wires up UI events. Only the selected player's Excel is fetched at a time.
 */

import { parseWorkbook, computeStandings } from './parser.js';
import { scoreGroup } from './scorer.js';
import { renderPlayerView, renderSidebar, renderLoading, renderError, renderWelcome } from './ui.js';

// Expose computeStandings for scorer.js (avoids circular import via window bridge)
window._parserModule = { computeStandings };

const MASTER_PATH = 'data/master.xlsx';
const MANIFEST_PATH = 'data/manifest.json';

let players = [];             // [{ file, displayName, totalPoints }]
let activeFile = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  let manifest;
  try {
    const res = await fetch(MANIFEST_PATH);
    if (!res.ok) throw new Error(`manifest.json: ${res.status}`);
    manifest = await res.json();
  } catch (e) {
    document.getElementById('player-list').innerHTML =
      `<li class="px-4 py-3 text-red-400 text-sm">Error cargando participantes: ${e.message}</li>`;
    return;
  }

  players = manifest.players.map(f => ({
    file: f,
    displayName: displayName(f),
    totalPoints: null,
  }));

  renderSidebar(players, null);
  renderWelcome();

  // Wire up player buttons
  document.getElementById('player-list').addEventListener('click', e => {
    const btn = e.target.closest('.player-btn');
    if (btn) selectPlayer(btn.dataset.file);
  });
}

// ── Resilient fetch — retries up to 3x with 800 ms back-off ─────────────────
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
  // Allow re-clicking the same player to force a refresh
  activeFile = file;
  const name = displayName(file);

  renderLoading(name);
  renderSidebar(players, activeFile);

  try {
    // Both files fetched fresh every time — Excel edits reflected immediately
    const [playerBuf, master] = await Promise.all([
      fetchWithRetry(`data/players/${encodeURIComponent(file)}`),
      loadMaster(),
    ]);
    const playerData = parseWorkbook(playerBuf, name);
    const effectiveMaster = master ?? buildEmptyMaster(playerData);

    renderPlayerView(playerData, effectiveMaster, playerData.playerName);

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
    renderError(`Error cargando el archivo de ${name}: ${e.message}`);
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

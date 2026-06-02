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

let playerCache = {};         // file → parsed data (player files don't change)
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

// ── Master file — always fetched fresh, never cached ────────────────────────
async function loadMaster() {
  try {
    // Cache-bust so the browser never serves a stale Excel mid-edit
    const res = await fetch(`${MASTER_PATH}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`master.xlsx: ${res.status}`);
    const buf = await res.arrayBuffer();
    return parseWorkbook(buf, 'master');
  } catch (e) {
    console.warn('No se pudo cargar el archivo de resultados:', e.message);
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
    // Fetch player file (cached) and master (always fresh) in parallel
    const [playerData, master] = await Promise.all([
      (async () => {
        if (!playerCache[file]) {
          const res = await fetch(`data/players/${file}?t=${Date.now()}`);
          if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          playerCache[file] = parseWorkbook(buf, name);
        }
        return playerCache[file];
      })(),
      loadMaster(),
    ]);

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

/** "david.xlsx" → "David" */
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

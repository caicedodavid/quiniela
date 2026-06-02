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

let masterData = null;        // cached after first load
let playerCache = {};         // file → parsed data
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

  // Load master once in background
  masterData = await loadMaster();

  // Wire up player buttons
  document.getElementById('player-list').addEventListener('click', e => {
    const btn = e.target.closest('.player-btn');
    if (btn) selectPlayer(btn.dataset.file);
  });
}

// ── Master file ───────────────────────────────────────────────────────────────
async function loadMaster() {
  try {
    const res = await fetch(MASTER_PATH);
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
  if (activeFile === file) return;
  activeFile = file;
  const name = displayName(file);

  renderLoading(name);
  renderSidebar(players, activeFile);

  try {
    if (!playerCache[file]) {
      const res = await fetch(`data/players/${file}`);
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      playerCache[file] = parseWorkbook(buf, name);
    }

    const playerData = playerCache[file];
    const master = masterData ?? buildEmptyMaster(playerData);

    renderPlayerView(playerData, master, playerData.playerName);

    // Update total pts in sidebar
    const idx = players.findIndex(p => p.file === file);
    if (idx !== -1) {
      players[idx].totalPoints = playerData.groups.reduce((sum, pg, i) => {
        const { totalPoints } = scoreGroup(pg, master.groups[i]);
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

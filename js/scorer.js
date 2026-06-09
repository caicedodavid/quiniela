/**
 * scorer.js — Points calculation for the fantasy World Cup.
 *
 * Scoring rules:
 *   6 pts  — Exact score (home & away goals both correct)
 *   4 pts  — Correct winner + one team's goal count correct
 *   3 pts  — Correct outcome (win or draw) but neither goal count exact
 *   3 pts  — Correct tie prediction but wrong score (alias of above)
 *   1 pt   — One team's goal count correct, wrong outcome
 *   0 pts  — Nothing correct
 *   null   — Match not yet played OR no prediction made
 *
 * Bonus per group (applied when all 6 matches are played):
 *   BONUS_PER_POSITION pts per correctly predicted final position.
 */

export const BONUS_PER_POSITION = 1; // configurable

/**
 * Score one match.
 * @param {number|null} ph predicted home goals
 * @param {number|null} pa predicted away goals
 * @param {number|null} rh real home goals
 * @param {number|null} ra real away goals
 * @returns {{ points: number|null, reason: string|null }}
 */
export function scoreMatch(ph, pa, rh, ra) {
  // Match not yet played
  if (rh === null || ra === null) return { points: null, reason: null };
  // No prediction
  if (ph === null || pa === null) return { points: 0, reason: 'Sin predicción' };

  const exactHome = ph === rh;
  const exactAway = pa === ra;
  const predOutcome = Math.sign(ph - pa); // -1 / 0 / 1
  const realOutcome = Math.sign(rh - ra);
  const correctOutcome = predOutcome === realOutcome;
  const oneGoalRight = exactHome || exactAway;

  if (exactHome && exactAway) {
    return { points: 6, reason: 'Resultado exacto' };
  }
  if (correctOutcome && oneGoalRight) {
    return { points: 4, reason: 'Ganador correcto + un marcador acertado' };
  }
  if (correctOutcome) {
    return { points: 3, reason: predOutcome === 0
      ? 'Empate correcto (marcador inexacto)'
      : 'Ganador correcto (sin marcador acertado)' };
  }
  if (oneGoalRight) {
    return { points: 1, reason: 'Un marcador acertado (resultado incorrecto)' };
  }
  return { points: 0, reason: 'Ninguna predicción acertada' };
}

/**
 * Score an entire group: match points + standings bonus.
 * @param {object} playerGroup  { matches, standings, teams } from parser
 * @param {object} masterGroup  { matches, standings, teams } from parser (real results)
 * @returns {object} { matchResults, bonusPoints, totalPoints, groupComplete }
 *   matchResults: Array<{ home, away, predH, predA, realH, realA, points, reason }>
 *   bonusPoints:  number (0 if group not complete)
 *   totalPoints:  number
 *   groupComplete: boolean
 */
export function scoreGroup(playerGroup, masterGroup) {
  const { computeStandings } = window._parserModule;

  const matchResults = playerGroup.matches.map((pm, idx) => {
    const rm = masterGroup.matches[idx];
    const { points, reason } = scoreMatch(pm.homeGoals, pm.awayGoals, rm.homeGoals, rm.awayGoals);
    return {
      home: rm.home, away: rm.away,
      predH: pm.homeGoals, predA: pm.awayGoals,
      realH: rm.homeGoals, realA: rm.awayGoals,
      points, reason,
    };
  });

  const groupComplete = masterGroup.matches.every(
    m => m.homeGoals !== null && m.awayGoals !== null
  );

  let bonusPoints = 0;
  let playerFinalStandings = null;
  let masterFinalStandings = null;

  // Always compute player's predicted standings so UI can show them
  playerFinalStandings = computeStandings(playerGroup.teams, playerGroup.matches);

  if (groupComplete) {
    masterFinalStandings = computeStandings(masterGroup.teams, masterGroup.matches);
    for (let pos = 0; pos < 4; pos++) {
      if (playerFinalStandings[pos] === masterFinalStandings[pos]) {
        bonusPoints += BONUS_PER_POSITION;
      }
    }
  }

  const matchPoints = matchResults.reduce((s, r) => s + (r.points ?? 0), 0);
  const totalPoints = matchPoints + bonusPoints;

  return { matchResults, bonusPoints, totalPoints, groupComplete,
           playerFinalStandings, masterFinalStandings };
}

/**
 * scorer.js — Points calculation for the fantasy World Cup.
 */

export const BONUS_PER_POSITION = 1;

export const ROUND_RULES = {
  groups:      { exact: 6,  oneGoal: 4,  outcome: 3,  wrongOneGoal: 1, nothing: 0 },
  round_32_16: { exact: 10, oneGoal: 8,  outcome: 6,  wrongOneGoal: 2, nothing: 0 },
  quarters:    { exact: 16, oneGoal: 12, outcome: 8,  wrongOneGoal: 4, nothing: 0 },
  semis_3rd:   { exact: 24, oneGoal: 18, outcome: 12, wrongOneGoal: 6, nothing: 0 },
  final:       { exact: 36, oneGoal: 28, outcome: 18, wrongOneGoal: 10, nothing: 0 },
};

/**
 * Score one match.
 */
export function scoreMatch(ph, pa, rh, ra) {
  return scoreMatchWithRules(ph, pa, rh, ra, ROUND_RULES.groups);
}

export function scoreMatchWithRules(ph, pa, rh, ra, rules = ROUND_RULES.groups) {
  if (rh === null || ra === null) return { points: null, reason: null };
  if (ph === null || pa === null) return { points: 0, reason: 'Sin predicción', tier: 'nothing' };

  const exactHome = ph === rh;
  const exactAway = pa === ra;
  const predOutcome = Math.sign(ph - pa);
  const realOutcome = Math.sign(rh - ra);
  const correctOutcome = predOutcome === realOutcome;
  const oneGoalRight = exactHome || exactAway;

  if (exactHome && exactAway) {
    return { points: rules.exact, reason: 'Resultado exacto', tier: 'exact' };
  }
  if (correctOutcome && oneGoalRight) {
    return { points: rules.oneGoal, reason: 'Ganador correcto + un marcador acertado', tier: 'oneGoal' };
  }
  if (correctOutcome) {
    return { points: rules.outcome, reason: predOutcome === 0
      ? 'Empate correcto (marcador inexacto)'
      : 'Ganador correcto (sin marcador acertado)',
      tier: 'outcome' };
  }
  if (oneGoalRight) {
    return { points: rules.wrongOneGoal, reason: 'Un marcador acertado (resultado incorrecto)', tier: 'wrongOneGoal' };
  }
  return { points: rules.nothing, reason: 'Ninguna predicción acertada', tier: 'nothing' };
}

/**
 * Score an entire group: match points + standings bonus.
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

/**
 * Score a knockout round.
 */
export function scoreKnockoutRound(playerMatches, masterMatches, rules) {
  const matchResults = playerMatches.map((pm, idx) => {
    const rm = masterMatches[idx];
    const { points, reason, tier } = scoreMatchWithRules(pm.homeGoals, pm.awayGoals, rm.homeGoals, rm.awayGoals, rules);
    return {
      home: rm.home, away: rm.away,
      predH: pm.homeGoals, predA: pm.awayGoals,
      realH: rm.homeGoals, realA: rm.awayGoals,
      points, reason, tier
    };
  });
  const totalPoints = matchResults.reduce((s, r) => s + (r.points ?? 0), 0);
  return { matchResults, totalPoints };
}

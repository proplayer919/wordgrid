export interface EloHolder {
  // Current Elo rating of the player
  elo: number;

  // Uncertainty factor (RD). Standard baseline bounds are roughly 30 to 350.
  eloDeviation: number;

  wins: number;
  losses: number;
  draws: number;

  // Last played timestamp
  lastPlayed?: Date;
}

export interface MatchResult {
  playerA: EloHolder;
  playerB: EloHolder;
  expectedA: number;
  expectedB: number;
}

const Q = Math.log(10) / 400; // ~0.005756
const DECAY_CONSTANT_C = 25; // Controls how fast uncertainty grows over time blocks

function getG(rd: number): number {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
}

function getGlickoExpectedScore(ratingA: number, ratingB: number, gOpponent: number): number {
  return 1 / (1 + Math.pow(10, (-gOpponent * (ratingA - ratingB)) / 400));
}

/**
 * Calculates time periods elapsed since the last match.
 * 1 period = 1 day
 */
function calculateDecayPeriods(lastPlayed?: Date, currentMatchTime: Date = new Date()): number {
  if (!lastPlayed) return 0;

  const msDiff = currentMatchTime.getTime() - new Date(lastPlayed).getTime();
  if (msDiff <= 0) return 0;

  const oneDayInMs = 1000 * 60 * 60 * 24;
  return msDiff / oneDayInMs;
}

/**
 * Internal core decay formula math
 */
function computeDecayedRd(deviation: number, periods: number, c: number): number {
  const decayedRd = Math.sqrt(deviation * deviation + c * c * periods);
  return Math.min(350, Math.round(decayedRd)); // Hard cap at system max limit (350)
}

/**
 * On-Demand function to see how much a player's uncertainty (RD) has decayed
 * without modifying their actual historical ELO rating profile.
 * @param player The current player profile snapshot
 * @param checkAt Optional date parameter (defaults to right now)
 * @returns The projected eloDeviation integer
 */
export function previewDecayOnly(player: EloHolder, checkAt: Date = new Date()): number {
  const periods = calculateDecayPeriods(player.lastPlayed, checkAt);
  return computeDecayedRd(player.eloDeviation, periods, DECAY_CONSTANT_C);
}

/**
 * Executes a multiplayer match update, decaying both players' RD inline
 * if they haven't played in a while before processing Glicko variations.
 */
export function processMultiplayerMatch(
  playerA: EloHolder,
  playerB: EloHolder,
  scoreA: number,
  scoreB: number,
  puzzleElo: number
): MatchResult {
  const puzzleRD = 50;
  const currentMatchTime = new Date();

  const periodsA = calculateDecayPeriods(playerA.lastPlayed, currentMatchTime);
  const periodsB = calculateDecayPeriods(playerB.lastPlayed, currentMatchTime);

  const activeRdA = computeDecayedRd(playerA.eloDeviation, periodsA, DECAY_CONSTANT_C);
  const activeRdB = computeDecayedRd(playerB.eloDeviation, periodsB, DECAY_CONSTANT_C);

  let actualA = 0.5;
  let actualB = 0.5;
  if (scoreA > scoreB) {
    actualA = 1.0;
    actualB = 0.0;
  } else if (scoreB > scoreA) {
    actualA = 0.0;
    actualB = 1.0;
  }

  const gB = getG(activeRdB);
  const gA = getG(activeRdA);
  const gPuzzle = getG(puzzleRD);

  const h2hExpA = getGlickoExpectedScore(playerA.elo, playerB.elo, gB);
  const puzzleExpA = getGlickoExpectedScore(playerA.elo, puzzleElo, gPuzzle);
  const blendedExpA = 0.7 * h2hExpA + 0.3 * puzzleExpA;

  const h2hExpB = getGlickoExpectedScore(playerB.elo, playerA.elo, gA);
  const puzzleExpB = getGlickoExpectedScore(playerB.elo, puzzleElo, gPuzzle);
  const blendedExpB = 0.7 * h2hExpB + 0.3 * puzzleExpB;

  const dSquareInvA =
    Q *
    Q *
    (0.7 * gB * gB * h2hExpA * (1 - h2hExpA) +
      0.3 * gPuzzle * gPuzzle * puzzleExpA * (1 - puzzleExpA));

  const dSquareInvB =
    Q *
    Q *
    (0.7 * gA * gA * h2hExpB * (1 - h2hExpB) +
      0.3 * gPuzzle * gPuzzle * puzzleExpB * (1 - puzzleExpB));

  const nextRdA = Math.max(30, 1 / Math.sqrt(1 / (activeRdA * activeRdA) + dSquareInvA));
  const nextRdB = Math.max(30, 1 / Math.sqrt(1 / (activeRdB * activeRdB) + dSquareInvB));

  const ratingDeltaA =
    (Q / (1 / (activeRdA * activeRdA) + dSquareInvA)) *
    (0.7 * gB * (actualA - h2hExpA) + 0.3 * gPuzzle * (actualA - puzzleExpA));

  const ratingDeltaB =
    (Q / (1 / (activeRdB * activeRdB) + dSquareInvB)) *
    (0.7 * gA * (actualB - h2hExpB) + 0.3 * gPuzzle * (actualB - puzzleExpB));

  return {
    playerA: {
      elo: Math.round(playerA.elo + ratingDeltaA),
      eloDeviation: Math.round(nextRdA),
      wins: playerA.wins + (actualA === 1.0 ? 1 : 0),
      losses: playerA.losses + (actualA === 0.0 ? 1 : 0),
      draws: playerA.draws + (actualA === 0.5 ? 1 : 0),
      lastPlayed: currentMatchTime,
    },
    playerB: {
      elo: Math.round(playerB.elo + ratingDeltaB),
      eloDeviation: Math.round(nextRdB),
      wins: playerB.wins + (actualB === 1.0 ? 1 : 0),
      losses: playerB.losses + (actualB === 0.0 ? 1 : 0),
      draws: playerB.draws + (actualB === 0.5 ? 1 : 0),
      lastPlayed: currentMatchTime,
    },
    expectedA: Number(blendedExpA.toFixed(4)),
    expectedB: Number(blendedExpB.toFixed(4)),
  };
}

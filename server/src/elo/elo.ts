export interface EloHolder {
  elo: number;
  eloDeviation: number;
  volatility: number;
  wins: number;
  losses: number;
  draws: number;
  lastPlayed?: Date;
}

export interface MatchResult {
  playerA: EloHolder;
  playerB: EloHolder;
  expectedA: number;
  expectedB: number;
}

const GLICKO2_SCALE = 173.7178;
const STARTING_ELO = 1200;
const TAU = 0.5;

/**
 * Converts a rating and deviation to the Glicko-2 scale
 * @param elo The Elo rating
 * @param rd The rating deviation
 * @returns An object containing mu and phi on the Glicko-2 scale
 */
function toGlicko2(elo: number, rd: number): { mu: number; phi: number } {
  return {
    mu: (elo - STARTING_ELO) / GLICKO2_SCALE,
    phi: rd / GLICKO2_SCALE,
  };
}

/**
 * Converts a Glicko-2 scale rating and deviation back to Elo and rating deviation
 * @param mu The Glicko-2 scale rating
 * @param phi The Glicko-2 scale deviation
 * @returns An object containing the Elo rating and rating deviation
 */
function fromGlicko2(mu: number, phi: number): { elo: number; rd: number } {
  return {
    elo: Math.round(mu * GLICKO2_SCALE + STARTING_ELO),
    rd: Math.round(phi * GLICKO2_SCALE),
  };
}

/**
 * Calculates the G function for Glicko-2
 * @param phi The Glicko-2 scale deviation
 * @returns The G value
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * Calculates the E function for Glicko-2
 * @param mu The player's mu
 * @param muJ The opponent's mu
 * @param phiJ The opponent's phi
 * @returns The expected outcome
 */
function getE(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Updates a player's volatility
 * @param delta The difference between expected and actual performance
 * @param phi The current phi
 * @param sigma The current volatility
 * @param v The variance of performance
 * @returns The new volatility value
 */
function updateVolatility(delta: number, phi: number, sigma: number, v: number): number {
  const a = Math.log(Math.pow(sigma, 2));
  const f = (x: number) => {
    const expX = Math.exp(x);
    return (
      (expX * (Math.pow(delta, 2) - Math.pow(phi, 2) - v - expX)) /
        (2 * Math.pow(Math.pow(phi, 2) + v + expX, 2)) -
      (x - a) / Math.pow(TAU, 2)
    );
  };

  let A = a;
  let B = delta * delta - phi * phi - v > 0 ? Math.log(delta * delta - phi * phi - v) : a - TAU;

  let fA = f(A);
  let fB = f(B);

  let iterations = 0;
  while (Math.abs(B - A) > 0.000001 && iterations < 20) {
    let C = A + ((A - B) * fA) / (fB - fA);
    let fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    }
    B = C;
    fB = fC;
    iterations++;
  }
  return Math.exp(A / 2);
}

/**
 * Processes a match between two players
 * @param playerA The EloHolder object for player A
 * @param playerB The EloHolder object for player B
 * @param scoreA The score of player A (1, 0.5, or 0)
 * @param scoreB The score of player B (1, 0.5, or 0)
 * @param puzzleElo The Elo rating of the puzzle
 * @returns A MatchResult object containing the updated EloHolder objects
 */
export function processMultiplayerMatch(
  playerA: EloHolder,
  playerB: EloHolder,
  scoreA: number,
  scoreB: number,
  puzzleElo: number
): MatchResult {
  const pA = toGlicko2(playerA.elo, playerA.eloDeviation);
  const pB = toGlicko2(playerB.elo, playerB.eloDeviation);
  const pP = toGlicko2(puzzleElo, 50);

  const calculatePlayerUpdate = (
    player: EloHolder,
    self: { mu: number; phi: number },
    opponent: { mu: number; phi: number },
    score: number
  ) => {
    const eOpp = getE(self.mu, opponent.mu, opponent.phi);
    const eP = getE(self.mu, pP.mu, pP.phi);

    const vInv =
      Math.pow(g(opponent.phi), 2) * eOpp * (1 - eOpp) + Math.pow(g(pP.phi), 2) * eP * (1 - eP);

    const v = 1 / Math.max(vInv, 0.0001);
    const delta = v * (g(opponent.phi) * (score - eOpp) + g(pP.phi) * (score - eP));

    const nextSigma = updateVolatility(delta, self.phi, player.volatility, v);
    const phiStar = Math.sqrt(Math.pow(self.phi, 2) + Math.pow(nextSigma, 2));

    const nextPhi = 1 / Math.sqrt(1 / Math.pow(Math.min(phiStar, 2.5), 2) + 1 / v);
    const nextMu =
      self.mu +
      Math.pow(nextPhi, 2) * (g(opponent.phi) * (score - eOpp) + g(pP.phi) * (score - eP));

    const { elo, rd } = fromGlicko2(nextMu, nextPhi);

    return {
      ...player,
      elo: Math.max(100, Math.min(3000, elo)),
      eloDeviation: Math.max(30, rd),
      volatility: nextSigma,
      wins: player.wins + (score === 1 ? 1 : 0),
      losses: player.losses + (score === 0 ? 1 : 0),
      draws: player.draws + (score === 0.5 ? 1 : 0),
      lastPlayed: new Date(),
    };
  };

  const updatedA = calculatePlayerUpdate(playerA, pA, pB, scoreA);
  const updatedB = calculatePlayerUpdate(playerB, pB, pA, scoreB);

  return {
    playerA: updatedA,
    playerB: updatedB,
    expectedA: getE(pA.mu, pB.mu, pB.phi),
    expectedB: getE(pB.mu, pA.mu, pA.phi),
  };
}

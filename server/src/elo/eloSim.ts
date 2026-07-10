import { processMultiplayerMatch, type EloHolder } from './elo';
import { createLogger } from '../logging';

const logger = createLogger('EloSimulation');

interface MatchScenario {
  name: string;
  playerA: EloHolder;
  playerB: EloHolder;
  scoreA: number;
  scoreB: number;
  puzzleElo: number;
}

interface SimulationConfig {
  rounds?: number;
  logEachRound?: boolean;
}

function createPlayer(elo = 1200, deviation = 350): EloHolder {
  return { elo, eloDeviation: deviation, wins: 0, losses: 0, draws: 0 };
}

function runScenario(scenario: MatchScenario): { playerA: EloHolder; playerB: EloHolder } {
  logger.info(`\n--- Starting Scenario: ${scenario.name} ---`);

  const result = processMultiplayerMatch(
    scenario.playerA,
    scenario.playerB,
    scenario.scoreA,
    scenario.scoreB,
    scenario.puzzleElo
  );

  logger.info(
    `[Result] Player A: Elo ${Math.round(result.playerA.elo)} (Δ ${Math.round(result.playerA.elo - scenario.playerA.elo)}), RD: ${Math.round(result.playerA.eloDeviation)}`
  );
  logger.info(
    `[Result] Player B: Elo ${Math.round(result.playerB.elo)} (Δ ${Math.round(result.playerB.elo - scenario.playerB.elo)}), RD: ${Math.round(result.playerB.eloDeviation)}`
  );

  return result;
}

function runIterativeSimulation(
  initialPlayerA: EloHolder,
  initialPlayerB: EloHolder,
  config: SimulationConfig = {}
) {
  const { rounds = 10, logEachRound = false } = config;

  let pA = { ...initialPlayerA };
  let pB = { ...initialPlayerB };

  logger.info('\n==================================================');
  logger.info(`Starting Iterative Simulation for ${rounds} Rounds`);
  logger.info('==================================================');

  for (let i = 1; i <= rounds; i++) {
    const scoreA = Math.random();
    const scoreB = Math.random();
    const dynamicPuzzleElo = 1000 + Math.floor(Math.random() * 800);

    const result = processMultiplayerMatch(pA, pB, scoreA, scoreB, dynamicPuzzleElo);

    pA = result.playerA;
    pB = result.playerB;

    if (logEachRound) {
      logger.info(
        `Round ${i} | Puzzle: ${dynamicPuzzleElo} | A Score: ${scoreA.toFixed(2)} -> Elo: ${Math.round(pA.elo)} | B Score: ${scoreB.toFixed(2)} -> Elo: ${Math.round(pB.elo)}`
      );
    }
  }

  logger.info(`\n--- Final Results After ${rounds} Rounds ---`);
  logger.info(`Final Player A: Elo: ${Math.round(pA.elo)}, RD: ${Math.round(pA.eloDeviation)}`);
  logger.info(`Final Player B: Elo: ${Math.round(pB.elo)}, RD: ${Math.round(pB.eloDeviation)}`);
}

const scenarios: MatchScenario[] = [
  {
    name: 'Equal Players, Player B slightly higher score',
    playerA: createPlayer(1200, 350),
    playerB: createPlayer(1200, 350),
    scoreA: 0.34,
    scoreB: 0.44,
    puzzleElo: 1300,
  },
  {
    name: 'High Rating Veteran vs Low Rating Newbie',
    playerA: createPlayer(1800, 50),
    playerB: createPlayer(1000, 350),
    scoreA: 0.8,
    scoreB: 0.2,
    puzzleElo: 1500,
  },
  {
    name: 'Underdog stomps the veteran on a hard puzzle',
    playerA: createPlayer(1900, 60),
    playerB: createPlayer(1100, 300),
    scoreA: 0.1,
    scoreB: 0.9,
    puzzleElo: 2000,
  },
];

scenarios.forEach(runScenario);

const multiRoundPlayerA = createPlayer(1500, 200);
const multiRoundPlayerB = createPlayer(1200, 350);

runIterativeSimulation(multiRoundPlayerA, multiRoundPlayerB, {
  rounds: 100,
  logEachRound: false,
});

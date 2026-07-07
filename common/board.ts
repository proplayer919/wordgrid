import type { GameMode } from './constants';
import { createDateString, createSeedString } from './utils';
import { Puzzle } from './puzzle';

export type TimeConfig = {
  unlimited: boolean;
  initialSeconds: number;
  incrementSeconds: number;
};

export const TIME_CONFIGS: Record<string, TimeConfig> = {
  unlimited: { unlimited: true, initialSeconds: 0, incrementSeconds: 0 },
  marathon: { unlimited: false, initialSeconds: 600, incrementSeconds: 0 },
  standard: { unlimited: false, initialSeconds: 300, incrementSeconds: 0 },
  quick: { unlimited: false, initialSeconds: 120, incrementSeconds: 10 },
  rapid: { unlimited: false, initialSeconds: 60, incrementSeconds: 5 },
  blitz: { unlimited: false, initialSeconds: 30, incrementSeconds: 3 },
  bullet: { unlimited: false, initialSeconds: 15, incrementSeconds: 2 },
};

export class Board {
  readonly puzzle: Puzzle;
  readonly seed: number;
  readonly seedString: string;
  readonly boardGameMode: GameMode;
  readonly timeConfig: TimeConfig;

  startedAt: Date | null = null;
  endedAt: Date | null = null;

  guessedWords: string[] = [];
  usedWords: Set<string> = new Set();
  totalScore: number = 0;

  constructor(seed: number, boardGameMode: GameMode, timeConfig: TimeConfig, puzzle?: Puzzle) {
    this.seed = seed;
    this.boardGameMode = boardGameMode;
    this.timeConfig = timeConfig;
    this.seedString =
      boardGameMode === 'daily' ? createDateString(new Date()) : createSeedString(seed);

    this.puzzle = puzzle ?? new Puzzle(seed);
  }

  getSecondsRemaining(): number {
    if (this.timeConfig.unlimited) return Infinity;
    if (!this.startedAt) return this.timeConfig.initialSeconds;

    const endTime = this.endedAt ? this.endedAt.getTime() : Date.now();
    const elapsedSeconds = Math.floor((endTime - this.startedAt.getTime()) / 1000);
    const bonusSeconds = this.usedWords.size * this.timeConfig.incrementSeconds;

    return Math.max(0, this.timeConfig.initialSeconds - elapsedSeconds + bonusSeconds);
  }

  getSaveString(): string {
    const cellStates = this.puzzle.grid.flat().map(cell => ({
      row: cell.row,
      col: cell.col,
      rowConditionId: cell.rowCondition.id,
      colConditionId: cell.colCondition.id,
      word: cell.word || '',
      score: cell.score || 0,
      bestWord: cell.bestWord,
      bestScore: cell.bestScore,
    }));

    return JSON.stringify({
      seed: this.seed,
      boardGameMode: this.boardGameMode,
      cells: cellStates,
      guessedWords: this.guessedWords,
      totalScore: this.totalScore,
      maxScore: this.puzzle.maxScore,
      usedWords: Array.from(this.usedWords),
      timeConfig: this.timeConfig,
    });
  }

  static loadFromSaveString(saveString: string): Board {
    const parsed = JSON.parse(saveString);
    const board = new Board(parsed.seed, parsed.boardGameMode, parsed.timeConfig);

    for (const cellState of parsed.cells) {
      const cell = board.puzzle.grid[cellState.row]![cellState.col]!;
      cell.word = cellState.word || undefined;
      cell.score = cellState.score || undefined;
    }

    board.guessedWords = parsed.guessedWords;
    board.totalScore = parsed.totalScore;
    board.usedWords = new Set(parsed.guessedWords);

    return board;
  }
}

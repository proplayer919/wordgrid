import { WORDS } from '../data';
import { BOARD_SEED_ALPHABET, BOARD_SEED_LENGTH, type GameMode } from './constants';
import type { Move, MoveResult } from './move';
import { Puzzle } from './puzzle';
import { scoreWord } from './score';

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
  createdAt: Date = new Date();

  guessedWords: string[] = [];
  usedWords: Set<string> = new Set();
  totalScore: number = 0;

  private readonly history: Move[] = [];

  constructor(seed: number, boardGameMode: GameMode, timeConfig: TimeConfig, puzzle?: Puzzle) {
    this.seed = seed;
    this.boardGameMode = boardGameMode;
    this.timeConfig = timeConfig;
    this.seedString = boardGameMode === 'daily' ? this.getDateString() : this.getSeedString();

    this.puzzle = puzzle ?? new Puzzle(seed);
  }

  addMove(move: Move): MoveResult {
    this.guessedWords.push(move.word);
    const cell = this.puzzle.grid[move.row]![move.col];

    if (this.usedWords.has(move.word)) {
      return 'UsedElsewhere';
    }

    if (!WORDS.includes(move.word)) {
      return 'InvalidWord';
    }

    if (!cell?.rowCondition.test(move.word) || !cell?.colCondition.test(move.word)) {
      return 'ConditionNotMet';
    }

    const score = scoreWord(
      move.word,
      Puzzle.getValidWordsForConditions(cell.rowCondition, cell.colCondition)
    );
    move.score = score;

    cell.word = move.word;
    cell.score = score;

    this.puzzle.grid[move.row]![move.col] = cell;

    this.totalScore += score;
    this.usedWords.add(move.word);
    this.history.push(move);

    if (this.puzzle.grid.flat().every(c => c.word)) {
      this.endedAt = new Date();
      return 'SuccessEndGame';
    }
    return 'Success';
  }

  getHistory(): Move[] {
    return [...this.history];
  }

  getSeedString() {
    let seedStr = '';
    let seed = this.seed;
    const alphabetLength = BOARD_SEED_ALPHABET.length;
    for (let i = 0; i < BOARD_SEED_LENGTH; i++) {
      const index = seed % alphabetLength;
      seedStr += BOARD_SEED_ALPHABET[index];
      seed = Math.floor(seed / alphabetLength);
    }
    return seedStr;
  }

  static getDateStringFromDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  getDateString(): string {
    return Board.getDateStringFromDate(new Date());
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

  static getSeedFromSeedString(seedString: string): number {
    let seed = 0;
    const alphabetLength = BOARD_SEED_ALPHABET.length;

    for (let i = seedString.length - 1; i >= 0; i--) {
      const index = BOARD_SEED_ALPHABET.indexOf(seedString[i]!);

      seed = seed * alphabetLength + index;
    }

    return seed;
  }

  static getSeedFromAnyString(seedString: string): number {
    if (seedString.length === BOARD_SEED_LENGTH) {
      return Board.getSeedFromSeedString(seedString);
    }

    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      const char = seedString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = Math.trunc(hash);
    }
    return Math.abs(hash);
  }
}

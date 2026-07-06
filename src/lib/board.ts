import { CONDITIONS, type GameMode } from './constants';
import { WORDS } from './data';
import { getBestWordByScore, scoreWord } from './score';
import { createDateString, createSeedString, mulberry32, pickRandom } from './utils';
import type { Condition } from './condition';

export type DebugStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  last: number;
};

export type Cell = {
  row: number;
  col: number;
  rowCondition: Condition;
  colCondition: Condition;
  word?: string;
  score?: number;
  bestWord: string;
  bestScore: number;
};

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
  static readonly #CONDITION_WORDS_CACHE = new Map<string, string[]>();
  static readonly #VALID_WORDS_CACHE = new Map<string, string[]>();
  static readonly #MAX_SAMPLES = 500;
  static readonly #boardGenSamples: number[] = [];

  readonly grid: Cell[][];
  readonly columns: Condition[];
  readonly rows: Condition[];
  readonly seed: number;
  readonly seedString: string;
  readonly boardGameMode: GameMode;
  readonly timeConfig: TimeConfig;

  startedAt: Date | null = null;
  endedAt: Date | null = null;
  guessedWords: string[] = [];
  usedWords: Set<string> = new Set();
  bestWords: Set<string> = new Set();
  totalScore: number = 0;
  maxScore: number = 0;

  constructor(seed: number, boardGameMode: GameMode, timeConfig: TimeConfig) {
    const genStart = performance.now();
    this.seed = seed;
    this.boardGameMode = boardGameMode;
    this.timeConfig = timeConfig;
    this.seedString =
      boardGameMode === 'daily' ? createDateString(new Date()) : createSeedString(seed);

    const random = mulberry32(seed);
    const conditionPool: Condition[] = pickRandom(CONDITIONS, random, 6);

    this.rows = conditionPool.slice(0, 3);
    this.columns = conditionPool.slice(3, 6);

    this.grid = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, col) => {
        let rowCondition = this.rows[row];
        let colCondition = this.columns[col];

        const cell: Cell = { row, col, rowCondition, colCondition, bestWord: '', bestScore: 0 };
        let validWords = Board.getValidWordsForConditions(rowCondition, colCondition);

        while (validWords.length === 0) {
          const excludedConditions = [
            ...this.rows.filter((_, idx) => idx !== row),
            ...this.columns.filter((_, idx) => idx !== col),
          ];

          if (random() < 0.5) {
            this.rows[row] = Board.#pickUniqueCondition(random, excludedConditions);
          } else {
            this.columns[col] = Board.#pickUniqueCondition(random, excludedConditions);
          }

          rowCondition = this.rows[row];
          colCondition = this.columns[col];
          cell.rowCondition = rowCondition;
          cell.colCondition = colCondition;
          validWords = Board.getValidWordsForConditions(rowCondition, colCondition);
        }

        const fallbackWords = validWords.filter(word => !this.bestWords.has(word));

        cell.bestWord = Board.getBestWordForCell(cell, fallbackWords) || '';
        cell.bestScore = cell.bestWord ? scoreWord(cell.bestWord, fallbackWords) : 0;

        this.bestWords.add(cell.bestWord);
        return cell;
      })
    );

    this.maxScore = this.grid.flat().reduce((sum, cell) => sum + cell.bestScore, 0);
    Board.#recordBoardGenTime(performance.now() - genStart);
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
    const cellStates = this.grid.flat().map(cell => ({
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
      maxScore: this.maxScore,
      usedWords: Array.from(this.usedWords),
      timeConfig: this.timeConfig,
    });
  }

  static loadFromSaveString(saveString: string): Board {
    const parsed = JSON.parse(saveString);
    const board = new Board(parsed.seed, parsed.boardGameMode, parsed.timeConfig);

    for (const cellState of parsed.cells) {
      const cell = board.grid[cellState.row][cellState.col];
      cell.word = cellState.word || undefined;
      cell.score = cellState.score || undefined;
    }

    board.guessedWords = parsed.guessedWords;
    board.totalScore = parsed.totalScore;
    board.maxScore = parsed.maxScore;
    board.usedWords = new Set(parsed.guessedWords);

    return board;
  }

  static getValidWordsForCell(cell: Cell): string[] {
    return Board.getValidWordsForConditions(cell.rowCondition, cell.colCondition);
  }

  static getConditionWords(condition: Condition): string[] {
    const cachedWords = Board.#CONDITION_WORDS_CACHE.get(condition.id);
    if (cachedWords) return cachedWords;

    const matchedWords = WORDS.filter(word => condition.test(word));
    Board.#CONDITION_WORDS_CACHE.set(condition.id, matchedWords);
    return matchedWords;
  }

  static getValidWordsForConditions(rowCondition: Condition, colCondition: Condition): string[] {
    const cacheKey =
      rowCondition.id < colCondition.id
        ? `${rowCondition.id}|${colCondition.id}`
        : `${colCondition.id}|${rowCondition.id}`;

    const cachedWords = Board.#VALID_WORDS_CACHE.get(cacheKey);
    if (cachedWords) return cachedWords;

    const rowWords = Board.getConditionWords(rowCondition);
    const colWords = Board.getConditionWords(colCondition);

    const [smallerWords, largerWordSet] =
      rowWords.length <= colWords.length
        ? [rowWords, new Set(colWords)]
        : [colWords, new Set(rowWords)];

    const validWords = smallerWords.filter(word => largerWordSet.has(word));
    Board.#VALID_WORDS_CACHE.set(cacheKey, validWords);
    return validWords;
  }

  static getBestWordForCell(
    cell: Cell,
    validWords: string[] = Board.getValidWordsForCell(cell)
  ): string {
    if (validWords.length === 0) {
      throw new Error(
        `No valid words found for cell at row ${cell.row}, col ${cell.col} with conditions: ${cell.rowCondition.label}, ${cell.colCondition.label}`
      );
    }
    return getBestWordByScore(validWords);
  }

  static getBoardGenDebugStats(): DebugStats | null {
    if (Board.#boardGenSamples.length === 0) return null;

    const sorted = [...Board.#boardGenSamples].sort((a, b) => a - b);
    const n = sorted.length;

    const percentile = (p: number) => {
      const idx = Math.ceil((p / 100) * n) - 1;
      return sorted[Math.max(0, Math.min(n - 1, idx))];
    };
    const mean = Board.#boardGenSamples.reduce((s, v) => s + v, 0) / n;

    return {
      count: n,
      min: sorted[0],
      max: sorted[n - 1],
      mean,
      median: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      last: Board.#boardGenSamples[Board.#boardGenSamples.length - 1],
    };
  }

  static clearBoardGenDebugStats(): void {
    Board.#boardGenSamples.length = 0;
  }

  static #recordBoardGenTime(ms: number): void {
    Board.#boardGenSamples.push(ms);
    if (Board.#boardGenSamples.length > Board.#MAX_SAMPLES) {
      Board.#boardGenSamples.shift();
    }
  }

  static #pickUniqueCondition(random: () => number, excludedConditions: Condition[]): Condition {
    const excludedIds = new Set(excludedConditions.map(c => c.id));
    const availableConditions = CONDITIONS.filter(c => !excludedIds.has(c.id));
    const conditionPool = availableConditions.length > 0 ? availableConditions : CONDITIONS;

    return pickRandom(conditionPool, random)[0];
  }
}

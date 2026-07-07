import { CONDITIONS } from './constants';
import { WORDS } from './data';
import { getBestWordByScore, scoreWord } from './score';
import { mulberry32, pickRandom } from './utils';
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

export class Puzzle {
  static readonly #CONDITION_WORDS_CACHE = new Map<string, string[]>();
  static readonly #VALID_WORDS_CACHE = new Map<string, string[]>();
  static readonly #MAX_SAMPLES = 500;
  static readonly #boardGenSamples: number[] = [];

  readonly grid: Cell[][];
  readonly columns: Condition[];
  readonly rows: Condition[];

  readonly totalValidWords: Set<string> = new Set();
  readonly maxScore: number;
  readonly difficultyRating: number;

  readonly seed: number;

  constructor(seed: number) {
    const genStart = performance.now();

    this.seed = seed;

    const random = mulberry32(seed);
    const conditionPool: Condition[] = pickRandom(CONDITIONS, random, 6);

    this.rows = conditionPool.slice(0, 3);
    this.columns = conditionPool.slice(3, 6);

    const bestWords = new Set<string>();

    this.grid = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, col) => {
        let rowCondition = this.rows[row]!;
        let colCondition = this.columns[col]!;

        const cell: Cell = { row, col, rowCondition, colCondition, bestWord: '', bestScore: 0 };

        let validWords = Puzzle.getValidWordsForConditions(rowCondition, colCondition);

        while (validWords.length === 0) {
          const excludedConditions = [
            ...this.rows.filter((_, idx) => idx !== row),
            ...this.columns.filter((_, idx) => idx !== col),
          ];

          if (random() < 0.5) {
            this.rows[row] = Puzzle.#pickUniqueCondition(random, excludedConditions);
          } else {
            this.columns[col] = Puzzle.#pickUniqueCondition(random, excludedConditions);
          }

          rowCondition = this.rows[row]!;
          colCondition = this.columns[col]!;

          cell.rowCondition = rowCondition;
          cell.colCondition = colCondition;

          validWords = Puzzle.getValidWordsForConditions(rowCondition, colCondition);
        }

        const fallbackWords = validWords.filter(word => !bestWords.has(word));

        cell.bestWord = Puzzle.getBestWordForCell(cell, fallbackWords) || '';
        cell.bestScore = cell.bestWord ? scoreWord(cell.bestWord, fallbackWords) : 0;
        bestWords.add(cell.bestWord);

        validWords.forEach(word => this.totalValidWords.add(word));

        return cell;
      })
    );

    this.maxScore = this.grid.flat().reduce((sum, cell) => sum + cell.bestScore, 0);
    this.difficultyRating = this.calculateDifficultyRating();

    Puzzle.#recordBoardGenTime(performance.now() - genStart);
  }

  calculateDifficultyRating(): number {
    const baseRating = 1200;

    const scoreFactor = Math.log10(this.maxScore + 1) * 100;
    const vocabDensityFactor = Math.log10(this.totalValidWords.size + 1) * 50;

    const difficultyRating = Math.round(baseRating + scoreFactor - vocabDensityFactor);

    return Math.min(Math.max(difficultyRating, 600), 2600);
  }

  static getValidWordsForCell(cell: Cell): string[] {
    return Puzzle.getValidWordsForConditions(cell.rowCondition, cell.colCondition);
  }

  static getConditionWords(condition: Condition): string[] {
    const cachedWords = Puzzle.#CONDITION_WORDS_CACHE.get(condition.id);
    if (cachedWords) return cachedWords;

    const matchedWords = WORDS.filter(word => condition.test(word));
    Puzzle.#CONDITION_WORDS_CACHE.set(condition.id, matchedWords);

    return matchedWords;
  }

  static getValidWordsForConditions(rowCondition: Condition, colCondition: Condition): string[] {
    const cacheKey =
      rowCondition.id < colCondition.id
        ? `${rowCondition.id}|${colCondition.id}`
        : `${colCondition.id}|${rowCondition.id}`;

    const cachedWords = Puzzle.#VALID_WORDS_CACHE.get(cacheKey);
    if (cachedWords) return cachedWords;

    const rowWords = Puzzle.getConditionWords(rowCondition);
    const colWords = Puzzle.getConditionWords(colCondition);

    const [smallerWords, largerWordSet] =
      rowWords.length <= colWords.length
        ? [rowWords, new Set(colWords)]
        : [colWords, new Set(rowWords)];

    const validWords = smallerWords.filter(word => largerWordSet.has(word));
    Puzzle.#VALID_WORDS_CACHE.set(cacheKey, validWords);

    return validWords;
  }

  static getBestWordForCell(
    cell: Cell,
    validWords: string[] = Puzzle.getValidWordsForCell(cell)
  ): string {
    if (validWords.length === 0) {
      throw new Error(
        `No valid words found for cell at row ${cell.row}, col ${cell.col} with conditions: ${cell.rowCondition.label}, ${cell.colCondition.label}`
      );
    }
    return getBestWordByScore(validWords);
  }

  static getBoardGenDebugStats(): DebugStats | null {
    if (Puzzle.#boardGenSamples.length === 0) return null;

    const sorted = [...Puzzle.#boardGenSamples].sort((a, b) => a - b);
    const n = sorted.length;

    const percentile = (p: number) => {
      const idx = Math.ceil((p / 100) * n) - 1;
      return sorted[Math.max(0, Math.min(n - 1, idx))];
    };

    const mean = Puzzle.#boardGenSamples.reduce((s, v) => s + v, 0) / n;

    return {
      count: n,
      min: sorted[0]!,
      max: sorted[n - 1]!,
      mean,
      median: percentile(50)!,
      p95: percentile(95)!,
      p99: percentile(99)!,
      last: Puzzle.#boardGenSamples[Puzzle.#boardGenSamples.length - 1]!,
    };
  }

  static clearBoardGenDebugStats(): void {
    Puzzle.#boardGenSamples.length = 0;
  }

  static #recordBoardGenTime(ms: number): void {
    Puzzle.#boardGenSamples.push(ms);
    if (Puzzle.#boardGenSamples.length > Puzzle.#MAX_SAMPLES) {
      Puzzle.#boardGenSamples.shift();
    }
  }

  static #pickUniqueCondition(random: () => number, excludedConditions: Condition[]): Condition {
    const excludedIds = new Set(excludedConditions.map(c => c.id));
    const availableConditions = CONDITIONS.filter(c => !excludedIds.has(c.id));
    const conditionPool = availableConditions.length > 0 ? availableConditions : CONDITIONS;

    return pickRandom(conditionPool, random)[0]!;
  }
}

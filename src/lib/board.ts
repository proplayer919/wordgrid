import { CONDITIONS, type GameMode } from "./constants";
import { WORDS } from "./data";
import { getBestWordByScore, scoreWord } from "./score";
import { createDateString, createSeedString, mulberry32, pickRandom, type Condition } from "./utils";

const CONDITION_WORDS_CACHE: Map<string, string[]> = new Map();
const VALID_WORDS_CACHE: Map<string, string[]> = new Map();

function pickUniqueCondition(random: () => number, excludedConditions: Condition[]): Condition {
  const excludedIds = new Set(excludedConditions.map((condition) => condition.id));
  const availableConditions = CONDITIONS.filter((condition) => !excludedIds.has(condition.id));
  const conditionPool = availableConditions.length > 0 ? availableConditions : CONDITIONS;

  return pickRandom(conditionPool, random)[0];
}

export class Board {
  readonly grid: Cell[][] = [];
  readonly columns: Condition[];
  readonly rows: Condition[];
  readonly seed: number;
  readonly seedString: string;
  readonly boardGameMode: GameMode;
  guessedWords: string[] = [];
  usedWords: Set<string> = new Set();
  bestWords: Set<string> = new Set();
  totalScore: number = 0;
  maxScore: number = 0;

  constructor(seed: number, boardGameMode: GameMode) {
    this.seed = seed;
    this.boardGameMode = boardGameMode;
    this.seedString = boardGameMode === 'daily' ? createDateString(new Date()) : createSeedString(seed);

    const random = mulberry32(seed);
    const conditionPool: Condition[] = pickRandom(CONDITIONS, random, 6);

    this.rows = conditionPool.slice(0, 3);
    this.columns = conditionPool.slice(3, 6);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        let rowCondition = this.rows[row];
        let colCondition = this.columns[col];
        let cell: Cell = { row, col, rowCondition, colCondition, bestWord: '', bestScore: 0 };

        let validWords = getValidWordsForConditions(rowCondition, colCondition);
        while (validWords.length === 0) {
          const excludedConditions = [
            ...this.rows.filter((_, index) => index !== row),
            ...this.columns.filter((_, index) => index !== col),
          ];

          if (random() < 0.5) {
            this.rows[row] = pickUniqueCondition(random, excludedConditions);
          } else {
            this.columns[col] = pickUniqueCondition(random, excludedConditions);
          }

          rowCondition = this.rows[row];
          colCondition = this.columns[col];
          cell.rowCondition = rowCondition;
          cell.colCondition = colCondition;
          validWords = getValidWordsForConditions(rowCondition, colCondition);
        }

        const validWordsWithoutUsedBestWords = validWords.filter(word => !this.bestWords.has(word));

        cell.bestWord = getBestWordForCell(cell, validWordsWithoutUsedBestWords) || '';
        cell.bestScore = cell.bestWord ? scoreWord(cell.bestWord, validWordsWithoutUsedBestWords) : 0;

        this.bestWords.add(cell.bestWord);

        if (!this.grid[row]) {
          this.grid[row] = [];
        }
        this.grid[row][col] = cell;
      }
    }

    this.maxScore = this.grid.flat().reduce((sum, cell) => sum + cell.bestScore, 0);
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
      bestScore: cell.bestScore
    }));
    return JSON.stringify({
      seed: this.seed,
      boardGameMode: this.boardGameMode,
      cells: cellStates,
      guessedWords: this.guessedWords,
      totalScore: this.totalScore,
      maxScore: this.maxScore,
      usedWords: Array.from(this.usedWords),
    });
  }

  static loadFromSaveString(saveString: string): Board {
    const parsed = JSON.parse(saveString);
    const board = new Board(parsed.seed, parsed.boardGameMode);
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
}

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

export function getValidWordsForCell(cell: Cell): string[] {
  return getValidWordsForConditions(cell.rowCondition, cell.colCondition);
}

export function getConditionWords(condition: Condition): string[] {
  const cachedWords = CONDITION_WORDS_CACHE.get(condition.id);
  if (cachedWords) {
    return cachedWords;
  }

  const matchedWords = WORDS.filter(word => condition.test(word));
  CONDITION_WORDS_CACHE.set(condition.id, matchedWords);
  return matchedWords;
}

export function getValidWordsForConditions(rowCondition: Condition, colCondition: Condition): string[] {
  const cacheKey = rowCondition.id < colCondition.id
    ? `${rowCondition.id}|${colCondition.id}`
    : `${colCondition.id}|${rowCondition.id}`;

  const cachedWords = VALID_WORDS_CACHE.get(cacheKey);
  if (cachedWords) {
    return cachedWords;
  }

  const rowWords = getConditionWords(rowCondition);
  const colWords = getConditionWords(colCondition);
  const [smallerWords, largerWordSet] = rowWords.length <= colWords.length
    ? [rowWords, new Set(colWords)]
    : [colWords, new Set(rowWords)];

  const validWords = smallerWords.filter(word => largerWordSet.has(word));
  VALID_WORDS_CACHE.set(cacheKey, validWords);
  return validWords;
}

export function getBestWordForCell(cell: Cell, validWords: string[] = getValidWordsForCell(cell)): string {
  if (validWords.length === 0) {
    throw new Error(`No valid words found for cell at row ${cell.row}, col ${cell.col} with conditions: ${cell.rowCondition.label}, ${cell.colCondition.label}`);
  }

  return getBestWordByScore(validWords);
}

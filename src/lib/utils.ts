import { BOARD_SEED_LENGTH, BOARD_SEED_ALPHABET } from "./constants";

export class Condition {
  id: string;
  label: string;
  test: (word: string) => boolean;

  constructor(id: string, label: string, test: (word: string) => boolean) {
    this.id = id;
    this.label = label;
    this.test = test;
  }
}

export function pickRandom<T>(arr: T[], random: () => number, amount: number = 1,): T[] {
  const shuffled = shuffleArray(arr, random);
  return shuffled.slice(0, amount);
}

export function mulberry32(seed: number): () => number {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleArray<T>(arr: T[], random: () => number): T[] {
  const arrayCopy = [...arr];
  let currentIndex = arrayCopy.length, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;

    [arrayCopy[currentIndex], arrayCopy[randomIndex]] = [
      arrayCopy[randomIndex], arrayCopy[currentIndex]];
  }

  return arrayCopy;
}

export function createSeedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = Math.trunc(hash); // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function createSeedString(seed: number) {
  let seedStr = '';
  const alphabetLength = BOARD_SEED_ALPHABET.length;
  for (let i = 0; i < BOARD_SEED_LENGTH; i++) {
    const index = seed % alphabetLength;
    seedStr += BOARD_SEED_ALPHABET[index];
    seed = Math.floor(seed / alphabetLength);
  }
  return seedStr;
}

export function parseSeedString(seedString: string): number | null {
  let seed = 0;
  const alphabetLength = BOARD_SEED_ALPHABET.length;

  for (let i = seedString.length - 1; i >= 0; i--) {
    const index = BOARD_SEED_ALPHABET.indexOf(seedString[i]);
    if (index === -1) {
      return null;
    }

    seed = (seed * alphabetLength) + index;
  }

  return seed;
}

export function createDateString(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function textSizeForWord(word: string): string {
  if (word.length <= 4) {
    return '20px';
  } else if (word.length <= 6) {
    return '18px';
  } else if (word.length <= 8) {
    return '16px';
  } else {
    return '14px';
  }
}

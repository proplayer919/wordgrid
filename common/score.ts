const WORD_SCORE_CACHE: Map<string, number> = new Map();
const BASE_SCORE_CACHE: Map<string, number> = new Map();

const LETTER_WEIGHT = (() => {
  const freq: Record<string, number> = {
    a: 8.17,
    b: 1.49,
    c: 2.78,
    d: 4.25,
    e: 12.7,
    f: 2.23,
    g: 2.02,
    h: 6.09,
    i: 6.97,
    j: 0.15,
    k: 0.77,
    l: 4.03,
    m: 2.41,
    n: 6.75,
    o: 7.51,
    p: 1.93,
    q: 0.1,
    r: 5.99,
    s: 6.33,
    t: 9.06,
    u: 2.76,
    v: 0.98,
    w: 2.36,
    x: 0.15,
    y: 1.97,
    z: 0.07,
  };
  const weights: Record<string, number> = {};
  Object.keys(freq).forEach(letter => {
    weights[letter] = 1 + (1 / (freq[letter] + 0.01)) * 8;
  });
  return weights;
})();

function getCacheKey(word: string, possibleWords: string[]): string {
  return `${word}:${possibleWords.join(',')}`;
}

function cacheScore(word: string, possibleWords: string[], score: number): void {
  const cacheKey = getCacheKey(word, possibleWords);
  WORD_SCORE_CACHE.set(cacheKey, score);
}

function getBaseScore(word: string): number {
  const cachedScore = BASE_SCORE_CACHE.get(word);
  if (cachedScore !== undefined) {
    return cachedScore;
  }

  const lowerWord = word.toLowerCase();
  const letters = lowerWord.replace(/[^a-z]/g, '').split('');
  const lengthScore = letters.length * 6;
  const uniqueLettersScore = new Set(letters).size * 5;
  let rareLettersScore = 0;

  for (const char of letters) {
    rareLettersScore += LETTER_WEIGHT[char] || 0;
  }

  const repeatedLettersPenalty = Math.max(0, letters.length - uniqueLettersScore / 5) * 2;
  const baseScore = Math.max(
    1,
    Math.round(lengthScore + uniqueLettersScore + rareLettersScore / 5 - repeatedLettersPenalty)
  );
  BASE_SCORE_CACHE.set(word, baseScore);
  return baseScore;
}

function compareWordsByScore(a: string, b: string): number {
  const scoreDifference = getBaseScore(b) - getBaseScore(a);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return a.localeCompare(b);
}

function getRankGroupIndex(word: string, possibleWords: string[]): number {
  const targetScore = getBaseScore(word);
  const uniqueScores = Array.from(
    new Set(possibleWords.map(candidate => getBaseScore(candidate)))
  ).sort((a, b) => b - a);

  return uniqueScores.indexOf(targetScore);
}

function getDifficultyBonus(possibleWordCount: number): number {
  if (possibleWordCount <= 1) {
    return 18;
  }

  return Math.max(4, Math.round(28 / Math.log2(possibleWordCount + 2)));
}

export function sortWordsByScore(words: string[]): string[] {
  return [...words].sort(compareWordsByScore);
}

export function getBestWordByScore(words: string[]): string {
  if (words.length === 0) {
    return '';
  }

  return words.reduce((bestWord, candidateWord) => {
    return compareWordsByScore(candidateWord, bestWord) < 0 ? candidateWord : bestWord;
  }, words[0]);
}

export function scoreWord(word: string, possibleWords: string[]): number {
  const cacheKey = getCacheKey(word, possibleWords);
  if (WORD_SCORE_CACHE.has(cacheKey)) {
    return WORD_SCORE_CACHE.get(cacheKey)!;
  }

  const baseScore = getBaseScore(word);
  const rankIndex = Math.max(0, getRankGroupIndex(word, possibleWords));
  const uniqueRankCount = new Set(possibleWords.map(candidate => getBaseScore(candidate))).size;

  const rankBonus =
    uniqueRankCount <= 1
      ? 10
      : Math.round(((uniqueRankCount - 1 - rankIndex) / (uniqueRankCount - 1)) * 18);
  const difficultyBonus = getDifficultyBonus(possibleWords.length);
  const finalScore = Math.max(1, Math.round(baseScore * 0.7 + difficultyBonus + rankBonus));
  cacheScore(word, possibleWords, finalScore);
  return finalScore;
}

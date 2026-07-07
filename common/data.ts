import wordsData from './data/words.txt?raw';

export const WORDS = Array.from(
  new Set<string>(
    wordsData
      .split('\n')
      .map(word => word.trim())
      .filter(word => word.length > 0 && !word.startsWith('#'))
  )
);

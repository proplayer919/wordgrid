import { discriptorForNumber } from './utils';

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export class Condition {
  id: string;
  label: string;
  regex: RegExp;
  testFunc: (word: string) => boolean;

  constructor(id: string, label: string, regex?: RegExp, testFunc?: (word: string) => boolean) {
    this.id = id;
    this.label = label;
    this.regex = regex || /.*/;
    this.testFunc = testFunc || ((word: string) => this.regex.test(word));
  }

  test(word: string): boolean {
    if (this.testFunc) {
      return this.testFunc(word);
    }
    return this.regex.test(word);
  }

  createStartsWithCondition(prefix: string): Condition {
    const regex = new RegExp(`^${escapeRegExp(prefix)}`, 'i');
    return new Condition(`startsWith_${prefix}`, `Starts '${prefix}'`, regex);
  }

  createStartsWithVowelCondition(): Condition {
    const regex = /^[aeiou]/i;
    return new Condition(`startsWithVowel`, `Starts with vowel`, regex);
  }

  createStartsWithConsonantCondition(): Condition {
    const regex = /^[b-df-hj-np-tv-z]/i;
    return new Condition(`startsWithConsonant`, `Starts with consonant`, regex);
  }

  createEndsWithCondition(suffix: string): Condition {
    const regex = new RegExp(`${escapeRegExp(suffix)}$`, 'i');
    return new Condition(`endsWith_${suffix}`, `Ends '${suffix}'`, regex);
  }

  createContainsCondition(substring: string): Condition {
    const regex = new RegExp(`${escapeRegExp(substring)}`, 'i');
    return new Condition(`contains_${substring}`, `Contains '${substring}'`, regex);
  }

  createLengthCondition(length: number): Condition {
    const regex = new RegExp(`^.{${length}}$`);
    return new Condition(`length_${length}`, `${length} letters`, regex);
  }

  createMinLengthCondition(minLength: number): Condition {
    const regex = new RegExp(`^.{${minLength},}$`);
    return new Condition(`minLength_${minLength}`, `${minLength}+ letters`, regex);
  }

  createVowelCountCondition(minVowels: number): Condition {
    const regex = new RegExp(`^(?:[^aeiou]*[aeiou]){${minVowels},}[^aeiou]*$`, 'i');
    return new Condition(`minVowels_${minVowels}`, `${minVowels}+ vowels`, regex);
  }

  createMaxVowelCountCondition(maxVowels: number): Condition {
    const regex = new RegExp(`^(?:[^aeiou]*[aeiou]){0,${maxVowels}}[^aeiou]*$`, 'i');
    return new Condition(`maxVowels_${maxVowels}`, `<${maxVowels + 1} vowels`, regex);
  }

  createUniqueLetterCountCondition(minUnique: number): Condition {
    const regex = new RegExp(String.raw`^(?=(?:.*([a-z])(?!.*\1)){${minUnique},}).*$`, 'i');
    return new Condition(`minUnique_${minUnique}`, `${minUnique}+ unique letters`, regex);
  }

  createPalindromeCondition(): Condition {
    return new Condition(`palindrome`, `Palindrome`, undefined, (word: string) => {
      const normalized = word.toLowerCase();
      return normalized === normalized.split('').reverse().join('');
    });
  }

  createConsecutiveVowelsCondition(minConsecutive: number): Condition {
    const regex = new RegExp(`[aeiou]{${minConsecutive},}`, 'i');
    return new Condition(
      `consecutiveVowels_${minConsecutive}`,
      `${discriptorForNumber(minConsecutive)} vowel`,
      regex
    );
  }

  createConsecutiveLettersCondition(minConsecutive: number): Condition {
    const regex = new RegExp(String.raw`([a-z])\1{${minConsecutive - 1},}`, 'i');
    return new Condition(
      `consecutiveLetters_${minConsecutive}`,
      `${discriptorForNumber(minConsecutive)} letter`,
      regex
    );
  }
}

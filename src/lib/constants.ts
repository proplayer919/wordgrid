import { Condition } from "./utils";

export const BOARD_SEED_LENGTH = 8;
export const BOARD_SEED_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const CONDITIONS = [
  new Condition("length_3", "3 letters", (w: string) => w.length === 3),
  new Condition("length_4", "4 letters", (w: string) => w.length === 4),
  new Condition("length_5", "5 letters", (w: string) => w.length === 5),
  new Condition("length_6", "6 letters", (w: string) => w.length === 6),
  new Condition("length_7", "7 letters", (w: string) => w.length === 7),

  new Condition("starts_vowel", "Starts with vowel", (w: string) => /^[aeiou]/i.test(w)),
  new Condition("starts_consonant", "Starts with consonant", (w: string) => /^[a-z]/i.test(w) && !/^[aeiou]/i.test(w)),
  new Condition("starts_th", "Starts 'th'", (w: string) => /^th/i.test(w)),
  new Condition("starts_sh", "Starts 'sh'", (w: string) => /^sh/i.test(w)),
  new Condition("starts_ch", "Starts 'ch'", (w: string) => /^ch/i.test(w)),
  new Condition("starts_wh", "Starts 'wh'", (w: string) => /^wh/i.test(w)),
  new Condition("starts_un", "Starts 'un'", (w: string) => /^un/i.test(w)),
  new Condition("starts_pre", "Starts 'pre'", (w: string) => /^pre/i.test(w)),
  new Condition("starts_re", "Starts 're'", (w: string) => /^re/i.test(w)),

  new Condition("ends_ion", "Ends with 'ion'", (w: string) => /ion$/i.test(w)),
  new Condition("ends_able", "Ends with 'able'", (w: string) => /able$/i.test(w)),
  new Condition("ends_er", "Ends with 'er'", (w: string) => /er$/i.test(w)),
  new Condition("ends_or", "Ends with 'or'", (w: string) => /or$/i.test(w)),
  new Condition("ends_ly", "Ends with 'ly'", (w: string) => /ly$/i.test(w)),
  new Condition("ends_y", "Ends with 'y'", (w: string) => /y$/i.test(w)),
  new Condition("ends_ed", "Ends 'ed'", (w: string) => /ed$/i.test(w)),

  new Condition("has_q", "Contains 'q'", (w: string) => /q/i.test(w)),
  new Condition("has_z", "Contains 'z'", (w: string) => /z/i.test(w)),
  new Condition("has_x", "Contains 'x'", (w: string) => /x/i.test(w)),
  new Condition("has_j", "Contains 'j'", (w: string) => /j/i.test(w)),
  new Condition("has_k", "Contains 'k'", (w: string) => /k/i.test(w)),
  new Condition("has_a", "Contains 'a'", (w: string) => /a/i.test(w)),
  new Condition("has_th", "Contains 'th'", (w: string) => /th/i.test(w)),
  new Condition("has_ch", "Contains 'ch'", (w: string) => /ch/i.test(w)),
  new Condition("has_er", "Contains 'er'", (w: string) => /er/i.test(w)),
  new Condition("has_ou", "Contains 'ou'", (w: string) => /ou/i.test(w)),
  new Condition("has_st", "Contains 'st'", (w: string) => /st/i.test(w)),
  new Condition("has_ing", "Contains 'ing'", (w: string) => /ing/i.test(w)),

  new Condition("double_vowel", "Double vowel", (w: string) => /[aeiou]{2}/i.test(w)),
  new Condition("consonant_heavy", "Fewer than 2 vowels", (w: string) => (w.match(/[aeiou]/gi) || []).length < 2),
  new Condition("palindrome", "Palindrome", (w: string) => {
    const cleaned = w.toLowerCase().replace(/[^a-z]/g, '');
    return cleaned === cleaned.split('').reverse().join('');
  }),
  new Condition("double_letter", "Double letter", (w: string) => /([a-z])\1/i.test(w)),
  new Condition("many_vowels", "3+ vowels", (w: string) => (w.match(/[aeiou]/gi) || []).length >= 3),
  new Condition("many_unique", "4+ unique letters", (w: string) => (new Set(w.replace(/[^a-z]/gi, '').split(''))).size >= 4),
  new Condition("long_word", "8+ letters", (w: string) => w.length >= 8),
];

export type GameMode = 'daily' | 'infinite';

export const LETTER_WEIGHT = (() => {
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
  Object.keys(freq).forEach((letter) => {
    weights[letter] = 1 + (1 / (freq[letter] + 0.01)) * 8;
  });
  return weights;
})();

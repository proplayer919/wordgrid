import { Condition } from './condition';

export const BOARD_SEED_LENGTH = 8;
export const BOARD_SEED_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const CONDITIONS = [
  // Length conditions
  Condition.prototype.createLengthCondition(3),
  Condition.prototype.createLengthCondition(4),
  Condition.prototype.createLengthCondition(5),
  Condition.prototype.createLengthCondition(6),
  Condition.prototype.createLengthCondition(7),

  // Start conditions
  Condition.prototype.createStartsWithVowelCondition(),
  Condition.prototype.createStartsWithConsonantCondition(),
  Condition.prototype.createStartsWithCondition('th'),
  Condition.prototype.createStartsWithCondition('sh'),
  Condition.prototype.createStartsWithCondition('ch'),
  Condition.prototype.createStartsWithCondition('wh'),
  Condition.prototype.createStartsWithCondition('un'),
  Condition.prototype.createStartsWithCondition('pre'),
  Condition.prototype.createStartsWithCondition('re'),

  // Contains conditions
  Condition.prototype.createContainsCondition('q'),
  Condition.prototype.createContainsCondition('z'),
  Condition.prototype.createContainsCondition('x'),
  Condition.prototype.createContainsCondition('j'),
  Condition.prototype.createContainsCondition('k'),
  Condition.prototype.createContainsCondition('a'),
  Condition.prototype.createContainsCondition('th'),
  Condition.prototype.createContainsCondition('ch'),
  Condition.prototype.createContainsCondition('er'),
  Condition.prototype.createContainsCondition('ou'),
  Condition.prototype.createContainsCondition('st'),
  Condition.prototype.createContainsCondition('ing'),

  // End conditions
  Condition.prototype.createEndsWithCondition('ion'),
  Condition.prototype.createEndsWithCondition('able'),
  Condition.prototype.createEndsWithCondition('er'),
  Condition.prototype.createEndsWithCondition('or'),
  Condition.prototype.createEndsWithCondition('ly'),
  Condition.prototype.createEndsWithCondition('y'),
  Condition.prototype.createEndsWithCondition('ed'),

  // Special conditions
  Condition.prototype.createConsecutiveVowelsCondition(2),
  Condition.prototype.createMaxVowelCountCondition(1),
  Condition.prototype.createPalindromeCondition(),
  Condition.prototype.createConsecutiveLettersCondition(2),
  Condition.prototype.createVowelCountCondition(3),
  Condition.prototype.createUniqueLetterCountCondition(4),
  Condition.prototype.createLengthCondition(8),
];

export type GameMode = 'daily' | 'infinite' | 'online';

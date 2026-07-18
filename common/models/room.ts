import { Puzzle } from '../game/puzzle';
import { Board, type TimeConfig } from '../game/board';
import type { User } from './user';

export class Room {
  uuid: string;
  puzzle: Puzzle;
  timeConfig: TimeConfig;

  playerA: User;
  playerB: User;

  boardA: Board;
  boardB: Board;

  constructor(uuid: string, playerA: User, playerB: User, seed: number, timeConfig: TimeConfig) {
    this.uuid = uuid;
    this.puzzle = new Puzzle(seed);
    this.timeConfig = timeConfig;

    this.playerA = playerA;
    this.playerB = playerB;

    this.boardA = new Board(seed, 'online', timeConfig, this.puzzle);
    this.boardB = new Board(seed, 'online', timeConfig, this.puzzle);
  }
}

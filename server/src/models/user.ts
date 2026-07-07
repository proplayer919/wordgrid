import { processMultiplayerMatch, type EloHolder } from '../elo';

export type UserRole = 'user' | 'admin' | 'owner';

export class User implements EloHolder {
  uuid: string;
  username: string;
  passwordHash: string;
  role: UserRole;

  elo: number = 1000;
  eloDeviation: number = 350;

  wins: number = 0;
  losses: number = 0;
  draws: number = 0;

  constructor(uuid: string, username: string, passwordHash: string, role: UserRole) {
    this.uuid = uuid;
    this.username = username;
    this.passwordHash = passwordHash;
    this.role = role;
  }

  processResult(playerA: User, playerB: User, scoreA: number, scoreB: number, puzzleElo: number) {
    processMultiplayerMatch(playerA, playerB, scoreA, scoreB, puzzleElo);
  }
}

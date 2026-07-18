import { type EloHolder } from '../elo/elo';

export type UserRole = 'user' | 'admin' | 'owner';

export class User implements EloHolder {
  uuid: string;
  username: string;
  passwordHash: string;
  role: UserRole;

  elo: number = 1200;
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
}

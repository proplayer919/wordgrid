import redis from '../db/redis';
import matchFinder from './matchFinder.lua?raw';

const QUEUE_KEY = 'matchmaking:queue';
export const MATCH_CHANNEL = 'matchmaking:matches';

export type Match = {
  playerA: string;
  playerB: string;
  room: string;
};

declare module 'ioredis' {
  interface Redis {
    findMatchCustom(
      queueKey: string,
      minElo: number,
      maxElo: number,
      playerUuid: string
    ): Promise<string[] | null>;
  }
}

export class Matchmaker {
  constructor() {
    redis.defineCommand('findMatchCustom', {
      numberOfKeys: 1,
      lua: matchFinder,
    });
  }

  async joinQueue(playerUuid: string, elo: number): Promise<void> {
    await redis.zadd(QUEUE_KEY, elo, playerUuid);
  }

  async leaveQueue(playerUuid: string): Promise<void> {
    await redis.zrem(QUEUE_KEY, playerUuid);
  }

  async findMatch(playerUuid: string, elo: number, tolerance = 50): Promise<Match | null> {
    const minElo = Math.floor(elo - tolerance);
    const maxElo = Math.ceil(elo + tolerance);

    try {
      const result = await redis.findMatchCustom(QUEUE_KEY, minElo, maxElo, playerUuid);

      if (result?.length === 2) {
        const match: Match = {
          playerA: result[0]!,
          playerB: result[1]!,
          room: `room_${result[0]}_${result[1]}`,
        };

        await redis.publish(MATCH_CHANNEL, JSON.stringify({ type: 'MATCH_PROPOSED', match }));
        return match;
      }
    } catch (err) {
      console.error('Error executing matchmaking Lua command:', err);
    }

    return null;
  }
}

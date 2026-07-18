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

  /**
   * Adds a player to the matchmaking queue with their Elo rating
   * @param playerUuid The UUID of the player to add to the queue
   * @param elo The Elo rating of the player to add to the queue
   */
  async joinQueue(playerUuid: string, elo: number): Promise<void> {
    await redis.zadd(QUEUE_KEY, elo, playerUuid);
  }

  /**
   * Removes a player from the matchmaking queue
   * @param playerUuid The UUID of the player to remove from the queue
   */
  async leaveQueue(playerUuid: string): Promise<void> {
    await redis.zrem(QUEUE_KEY, playerUuid);
  }

  /**
   * Finds a match for a player based on their Elo rating and a specified tolerance
   * @param playerUuid The UUID of the player to find a match for
   * @param elo The Elo rating of the player to find a match for
   * @param tolerance The Elo rating tolerance for finding a match (default is 50)
   * @returns A promise that resolves to a Match object if a match is found, or null if no match is found
   */
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

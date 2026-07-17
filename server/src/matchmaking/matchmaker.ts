import redis from '../db/redis';
import matchFinder from './matchFinder.lua?raw';

const QUEUE_KEY = 'matchmaking:queue';
export const MATCH_CHANNEL = 'matchmaking:matches';

export type Match = {
  playerA: string;
  playerB: string;
  room: string;
};

export class Matchmaker {
  private luaScriptSha: string | null = null;

  constructor() {
    this.initLua();
  }

  private async initLua() {
    try {
      this.luaScriptSha = (await redis.script('LOAD', matchFinder)) as string;
    } catch (err) {
      console.error('Failed to load Matchmaker Lua script:', err);
    }
  }

  async joinQueue(playerUuid: string, elo: number): Promise<void> {
    await redis.zadd(QUEUE_KEY, elo, playerUuid);
  }

  async leaveQueue(playerUuid: string): Promise<void> {
    await redis.zrem(QUEUE_KEY, playerUuid);
  }

  async findMatch(playerUuid: string, elo: number, tolerance = 50): Promise<Match | null> {
    const minElo = elo - tolerance;
    const maxElo = elo + tolerance;

    let result: string[] | null = null;

    if (this.luaScriptSha) {
      try {
        result = (await redis.evalsha(
          this.luaScriptSha,
          1,
          QUEUE_KEY,
          minElo,
          maxElo,
          playerUuid
        )) as string[] | null;
      } catch (err: any) {
        if (err.message?.includes('NOSCRIPT')) {
          await this.initLua();
          result = (await redis.eval(matchFinder, 1, playerUuid, minElo, maxElo)) as
            string[] | null;
        } else {
          throw err;
        }
      }
    } else {
      result = (await redis.eval(matchFinder, 1, playerUuid, minElo, maxElo)) as
        string[] | null;
    }

    if (result?.length === 2) {
      const match: Match = {
        playerA: result[0]!,
        playerB: result[1]!,
        room: `room_${result[0]}_${result[1]}`,
      };

      await redis.publish(MATCH_CHANNEL, JSON.stringify({ type: 'MATCH_PROPOSED', match }));
      return match;
    }

    return null;
  }
}

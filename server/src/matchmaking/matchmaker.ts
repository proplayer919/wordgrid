import redis from '../db/redis';

const QUEUE_KEY = 'matchmaking:queue';

export type Match = {
  playerA: string;
  playerB: string;
};

export class Matchmaker {
  /**
   * Adds a player to the matchmaking queue.
   * @param playerUuid Unique identifier for the player
   * @param elo The player's Elo rating
   */
  async joinQueue(playerUuid: string, elo: number): Promise<void> {
    await redis.zadd(QUEUE_KEY, elo, playerUuid);
    console.log(`Player ${playerUuid} joined queue with Elo ${elo}`);
  }

  /**
   * Removes a player from the matchmaking queue.
   * @param playerUuid Unique identifier for the player
   */
  async leaveQueue(playerUuid: string): Promise<void> {
    await redis.zrem(QUEUE_KEY, playerUuid);
  }

  /**
   * Attempts to find a match for a player based on their Elo rating and a specified tolerance.
   * @param playerUuid Unique identifier for the player
   * @param elo The player's Elo rating
   * @param tolerance The acceptable Elo range for potential opponents (default is 50)
   * @returns A `Match` object if a match is found, or `null` if no suitable opponent is available.
   */
  async findMatch(playerUuid: string, elo: number, tolerance = 50): Promise<Match | null> {
    const minElo = elo - tolerance;
    const maxElo = elo + tolerance;

    const potentialOpponents = await redis.zrangebyscore(QUEUE_KEY, minElo, maxElo);

    const opponents = potentialOpponents.filter(id => id !== playerUuid);

    if (opponents.length > 0) {
      const opponentUuid = opponents[0]!;

      const multi = redis.multi();
      multi.zrem(QUEUE_KEY, playerUuid);
      multi.zrem(QUEUE_KEY, opponentUuid);

      const results = await multi.exec();

      const playerRemoved = results?.[0]?.[1] === 1;
      const opponentRemoved = results?.[1]?.[1] === 1;

      if (playerRemoved && opponentRemoved) {
        return { playerA: playerUuid, playerB: opponentUuid };
      } else if (playerRemoved) {
        await this.joinQueue(playerUuid, elo);
      }
    }

    return null;
  }
}

import { Matchmaker, MATCH_CHANNEL } from './matchmaker';
import { createLogger } from '../logging';
import type { ServerWebSocket } from 'bun';
import { MATCHMAKING_PORT } from '../env';
import redis from '../db/redis';
import { z } from 'zod';
import {
  register,
  activeQueuedPlayers,
  matchesProposed,
  matchesCompleted,
  matchesTimedOut,
  matchesRejected,
} from '../db/telemetry';

const logger = createLogger('MatchmakingService');
const matchmaker = new Matchmaker();

let tickMatchesProposed = 0;
let tickMatchesCompleted = 0;
let tickMatchesTimedOut = 0;
let tickMatchesRejected = 0;

const IncomingMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CANCEL'),
  }),
  z.object({
    type: z.literal('ACCEPT_MATCH'),
    matchId: z.string(),
  }),
]);

const OutgoingMessageSchema = z.object({
  type: z.enum([
    'QUEUED',
    'CANCELLED',
    'MATCH_PROPOSED',
    'MATCH_ACCEPTED',
    'MATCH_SUCCESS',
    'MATCH_FAILED',
  ]),
  message: z.string().optional(),
  opponent: z.string().optional(),
  room: z.string().optional(),
  matchId: z.string().optional(),
});

type OutgoingMessage = z.infer<typeof OutgoingMessageSchema>;

interface PlayerSocketData {
  id: string;
  elo: number;
  joinedAt: number;
  currentMatchId?: string;
}

const PubSubMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MATCH_PROPOSED'),
    match: z.object({
      playerA: z.string(),
      playerB: z.string(),
      room: z.string(),
    }),
  }),
  z.object({
    type: z.literal('MATCH_READY'),
    playerA: z.string(),
    playerB: z.string(),
    room: z.string(),
  }),
  z.object({
    type: z.literal('MATCH_ABORTED'),
    playerA: z.string(),
    playerB: z.string(),
    acceptA: z.boolean(),
    acceptB: z.boolean(),
    rejectedBy: z.string().optional(),
  }),
]);

const activeConnections = new Map<string, ServerWebSocket<PlayerSocketData>>();

/**
 * Stringifies an outgoing message after validating it against the schema
 * @param message The outgoing message object to be stringified
 * @returns A JSON string representation of the validated message
 */
function stringifyMessage(message: OutgoingMessage): string {
  const result = OutgoingMessageSchema.safeParse(message);
  if (!result.success) {
    logger.error(`Failed to validate outgoing message: ${result.error.message}`);
    throw new Error('Outbound message validation failed');
  }
  return JSON.stringify(result.data);
}

/**
 * Sets up a Redis Pub/Sub subscriber to listen for matchmaking events
 * @returns A promise that resolves when the subscriber is successfully set up
 */
async function setupRedisPubSubSubscriber() {
  const subRedis = redis.duplicate();
  await subRedis.connect();

  await subRedis.subscribe(MATCH_CHANNEL);

  subRedis.on('message', async (_, message) => {
    try {
      const rawPayload = JSON.parse(message);
      const result = PubSubMessageSchema.safeParse(rawPayload);

      if (!result.success) {
        logger.warn(`Invalid Pub/Sub message schema: ${result.error.message}`);
        return;
      }

      const payload = result.data;

      if (payload.type === 'MATCH_PROPOSED') {
        const match = payload.match;
        const matchId = `match:${match.playerA}:${match.playerB}`;

        const hasPlayerA = activeConnections.has(match.playerA);
        const hasPlayerB = activeConnections.has(match.playerB);

        if (hasPlayerA) {
          const wsA = activeConnections.get(match.playerA);
          if (wsA) wsA.data.currentMatchId = matchId;

          await redis.hset(matchId, {
            playerA: match.playerA,
            playerB: match.playerB,
            room: match.room,
            acceptA: 'false',
            acceptB: 'false',
          });
          await redis.expire(matchId, 15);

          setTimeout(() => handleMatchTimeout(matchId), 10000);
        }

        if (hasPlayerB) {
          const wsB = activeConnections.get(match.playerB);
          if (wsB) wsB.data.currentMatchId = matchId;
        }

        tickMatchesProposed++;

        handleMatchProposal(match.playerA, match.playerB, matchId);
        handleMatchProposal(match.playerB, match.playerA, matchId);
      } else if (payload.type === 'MATCH_READY') {
        const { playerA, playerB, room } = payload;

        const wsA = activeConnections.get(playerA);
        if (wsA) delete wsA.data.currentMatchId;

        const wsB = activeConnections.get(playerB);
        if (wsB) delete wsB.data.currentMatchId;

        tickMatchesCompleted++;

        finalizeMatch(playerA, playerB, room);
      } else if (payload.type === 'MATCH_ABORTED') {
        const { playerA, playerB, acceptA, acceptB, rejectedBy } = payload;

        if (!rejectedBy) {
          tickMatchesTimedOut++;
        }

        const wsA = activeConnections.get(playerA);
        if (wsA) delete wsA.data.currentMatchId;

        const wsB = activeConnections.get(playerB);
        if (wsB) delete wsB.data.currentMatchId;

        if (!acceptA && !acceptB) {
          handleMatchBothPlayersAborted(playerA, playerB);
        } else if (acceptA && !acceptB) {
          handleMatchOnePlayerAborted(playerB, playerA);
        } else if (!acceptA && acceptB) {
          handleMatchOnePlayerAborted(playerA, playerB);
        }
      }
    } catch (err: any) {
      logger.error(`Error processing Pub/Sub match event: ${err.message}`);
    }
  });
}

/**
 * Handles the match proposal by notifying the target player about the proposed match
 * @param targetPlayerId The UUID of the player to notify about the match proposal
 * @param opponentId The UUID of the opponent player in the proposed match
 * @param matchId The unique identifier for the proposed match
 */
function handleMatchProposal(targetPlayerId: string, opponentId: string, matchId: string) {
  const ws = activeConnections.get(targetPlayerId);
  if (!ws) return;

  ws.send(
    stringifyMessage({
      type: 'MATCH_PROPOSED',
      opponent: opponentId,
      matchId,
    })
  );
}

/**
 * Processes a player's acceptance of a proposed match and checks if both players have accepted
 * @param playerId The UUID of the player who accepted the match
 * @param matchId The unique identifier for the proposed match
 * @returns A promise that resolves when the acceptance is processed and the match is finalized if both players have accepted
 */
async function processMatchAcceptance(playerId: string, matchId: string) {
  const matchData = await redis.hgetall(matchId);
  if (!matchData || Object.keys(matchData).length === 0) return;

  const isPlayerA = matchData.playerA === playerId;
  const isPlayerB = matchData.playerB === playerId;

  if (!isPlayerA && !isPlayerB) return;

  const fieldToSet = isPlayerA ? 'acceptA' : 'acceptB';
  await redis.hset(matchId, fieldToSet, 'true');

  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(stringifyMessage({ type: 'MATCH_ACCEPTED', message: 'Acceptance received.' }));
  }

  const updatedData = await redis.hgetall(matchId);
  if (updatedData.acceptA === 'true' && updatedData.acceptB === 'true') {
    const deleted = await redis.del(matchId);
    if (deleted === 0) return;

    await redis.publish(
      MATCH_CHANNEL,
      JSON.stringify({
        type: 'MATCH_READY',
        playerA: updatedData.playerA,
        playerB: updatedData.playerB,
        room: updatedData.room,
      })
    );
  }
}

/**
 * Handles the timeout of a proposed match by checking if both players have accepted and aborting the match if not
 * @param matchId The unique identifier for the proposed match that has timed out
 * @returns A promise that resolves when the timeout is processed and the match is aborted if necessary
 */
async function handleMatchTimeout(matchId: string) {
  const matchData = await redis.hgetall(matchId);

  if (!matchData?.playerA || !matchData.playerB) return;

  const acceptA = matchData.acceptA === 'true';
  const acceptB = matchData.acceptB === 'true';

  if (acceptA && acceptB) return;

  const deleted = await redis.del(matchId);
  if (deleted === 0) return;

  await redis.publish(
    MATCH_CHANNEL,
    JSON.stringify({
      type: 'MATCH_ABORTED',
      playerA: matchData.playerA,
      playerB: matchData.playerB,
      acceptA,
      acceptB,
    })
  );
}

/**
 * Handles the rejection of an active match by a player, removing the match from Redis and notifying both players
 * @param playerId The UUID of the player who rejected the match
 * @param matchId The unique identifier for the active match that was rejected
 * @returns A promise that resolves when the rejection is processed and both players are notified
 */
async function handleActiveMatchRejection(playerId: string, matchId: string) {
  const matchData = await redis.hgetall(matchId);
  if (!matchData || Object.keys(matchData).length === 0) return;

  const deleted = await redis.del(matchId);
  if (deleted === 0) return;

  const isPlayerA = matchData.playerA === playerId;

  tickMatchesRejected++;

  await redis.publish(
    MATCH_CHANNEL,
    JSON.stringify({
      type: 'MATCH_ABORTED',
      playerA: matchData.playerA,
      playerB: matchData.playerB,
      acceptA: isPlayerA ? false : matchData.acceptA === 'true',
      acceptB: !isPlayerA ? false : matchData.acceptB === 'true',
      rejectedBy: playerId,
    })
  );
}

/**
 * Aborts a player from the matchmaking process, notifying them of the failure and closing their WebSocket connection if they are connected
 * @param playerId The UUID of the player to abort from matchmaking
 */
async function abortPlayer(playerId: string) {
  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(stringifyMessage({ type: 'MATCH_FAILED', message: 'Match failed or timed out.' }));
    ws.close();
  } else {
    await matchmaker.leaveQueue(playerId);
  }
}

/**
 * Requeues a player back into the matchmaking queue after their opponent failed to accept the match, notifying them of the situation
 * @param playerId The UUID of the player to requeue into matchmaking
 */
async function requeuePlayer(playerId: string) {
  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(
      stringifyMessage({
        type: 'QUEUED',
        message: 'Opponent failed to accept. Returning to queue.',
      })
    );
    await matchmaker.joinQueue(playerId, ws.data.elo);
  }
}

/**
 * Handles the scenario where both players in a match have aborted, ensuring both are removed from matchmaking and notified
 * @param playerA The UUID of the first player in the match
 * @param playerB The UUID of the second player in the match
 */
async function handleMatchBothPlayersAborted(playerA: string, playerB: string) {
  await abortPlayer(playerA);
  await abortPlayer(playerB);
}

/**
 * Handles the scenario where one player in a match has aborted, ensuring the aborting player is removed from matchmaking and the other player is requeued
 * @param playerId The UUID of the player who aborted the match
 * @param opponentId The UUID of the opponent player who should be requeued into matchmaking
 */
async function handleMatchOnePlayerAborted(playerId: string, opponentId: string) {
  await abortPlayer(playerId);
  await requeuePlayer(opponentId);
}

/**
 * Finalizes a match by notifying both players of the successful match and closing their WebSocket connections after a short delay
 * @param playerA The UUID of the first player in the match
 * @param playerB The UUID of the second player in the match
 * @param room The UUID of the room where the match will take place
 */
function finalizeMatch(playerA: string, playerB: string, room: string) {
  const notify = (targetId: string, opponentId: string) => {
    const ws = activeConnections.get(targetId);
    if (!ws) return;

    ws.send(
      stringifyMessage({
        type: 'MATCH_SUCCESS',
        opponent: opponentId,
        room,
      })
    );

    setTimeout(() => {
      if (activeConnections.has(targetId)) {
        ws.close();
      }
    }, 5000);
  };

  notify(playerA, playerB);
  notify(playerB, playerA);
}

/**
 * The matchmaking tick function runs periodically to evaluate the matchmaking queue and propose matches for players based on their Elo ratings and waiting time
 * It calculates a dynamic tolerance for each player based on how long they have been waiting in the queue and attempts to find a suitable match
 * If a match is found, it is proposed to both players, and the matchmaking process continues
 * This function is called recursively with a delay to continuously evaluate the matchmaking queue
 */
async function matchmakingTick() {
  activeQueuedPlayers.set(activeConnections.size);

  matchesProposed.set(tickMatchesProposed);
  matchesCompleted.set(tickMatchesCompleted);
  matchesTimedOut.set(tickMatchesTimedOut);
  matchesRejected.set(tickMatchesRejected);

  tickMatchesProposed = 0;
  tickMatchesCompleted = 0;
  tickMatchesTimedOut = 0;
  tickMatchesRejected = 0;

  if (activeConnections.size >= 2) {
    const BASE_TOLERANCE = 50;
    const MAX_TOLERANCE = 500;
    const TOLERANCE_GROWTH_PER_SECOND = 15;

    for (const [playerId, ws] of activeConnections.entries()) {
      if (!activeConnections.has(playerId)) continue;

      const { elo, joinedAt } = ws.data;
      const secondsWaiting = (Date.now() - joinedAt) / 1000;
      const dynamicTolerance = Math.min(
        BASE_TOLERANCE + secondsWaiting * TOLERANCE_GROWTH_PER_SECOND,
        MAX_TOLERANCE
      );

      try {
        const inQueue = await redis.zscore('matchmaking:queue', playerId);
        if (!inQueue) continue;

        const match = await matchmaker.findMatch(playerId, elo, dynamicTolerance);
        if (match) {
          logger.debug(`Proposed match: ${match.playerA} vs ${match.playerB}`);
          break;
        }
      } catch (err: any) {
        logger.error(`Error in match evaluation loop: ${err.message}`);
      }
    }
  }

  setTimeout(matchmakingTick, 1000);
}

/**
 * Starts the matchmaking service by setting up the Redis Pub/Sub subscriber, initializing the WebSocket server, and handling incoming connections and messages
 * It listens for matchmaking requests, manages the matchmaking queue, and processes match proposals and acceptances
 * The service also exposes a metrics endpoint for monitoring purposes
 * @returns A promise that resolves when the matchmaking service is successfully started
 */
export async function startMatchmakingService() {
  await setupRedisPubSubSubscriber();

  const serviceServer = Bun.serve<PlayerSocketData>({
    port: MATCHMAKING_PORT,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === '/metrics') {
        return new Response(await register.metrics(), {
          headers: { 'Content-Type': register.contentType },
        });
      }

      if (url.pathname === '/matchmake') {
        const id = url.searchParams.get('id');
        const elo = Number(url.searchParams.get('elo'));

        if (!id || Number.isNaN(elo)) {
          return new Response('Missing id or elo parameters', { status: 400 });
        }

        const upgraded = server.upgrade(req, {
          data: { id, elo, joinedAt: Date.now() },
        });

        return upgraded ? undefined : new Response('WebSocket upgrade failed', { status: 500 });
      }

      return new Response('Matchmaking service operational', { status: 200 });
    },

    websocket: {
      idleTimeout: 10,
      sendPings: true,

      async open(ws) {
        const { id, elo } = ws.data;
        logger.debug(`Player [${id}] entered queue with Elo [${elo}].`);

        try {
          activeConnections.set(id, ws);

          const integerElo = Math.round(elo);
          await matchmaker.joinQueue(id, integerElo);

          activeQueuedPlayers.set(activeConnections.size);
          ws.send(stringifyMessage({ type: 'QUEUED', message: 'Successfully queued.' }));
        } catch (err: any) {
          logger.error(`Failed to add player [${id}] to Redis queue: ${err.message}`);
          ws.send(
            stringifyMessage({ type: 'MATCH_FAILED', message: 'Queue initialization failed.' })
          );
          ws.close();
        }
      },

      async close(ws) {
        const { id, currentMatchId } = ws.data;
        logger.debug(`Player [${id}] left queue/disconnected.`);

        try {
          if (currentMatchId) {
            await handleActiveMatchRejection(id, currentMatchId);
          }

          activeConnections.delete(id);
          await matchmaker.leaveQueue(id);
          activeQueuedPlayers.set(activeConnections.size);
        } catch (err: any) {
          logger.error(`Error removing player [${id}] from queue on disconnect: ${err.message}`);
        }
      },

      async message(ws, message) {
        try {
          const rawData = JSON.parse(String(message));
          const result = IncomingMessageSchema.safeParse(rawData);

          if (!result.success) {
            logger.warn(
              `Invalid WS payload received from player [${ws.data.id}]: ${result.error.message}`
            );
            return;
          }

          const data = result.data;

          if (data.type === 'CANCEL') {
            const { id, currentMatchId } = ws.data;
            logger.debug(`Player [${id}] cancelled matchmaking.`);

            if (currentMatchId) {
              await handleActiveMatchRejection(id, currentMatchId);
            }

            ws.send(
              stringifyMessage({ type: 'CANCELLED', message: 'Queue cancelled successfully.' })
            );
            ws.close();
          } else if (data.type === 'ACCEPT_MATCH') {
            await processMatchAcceptance(ws.data.id, data.matchId);
          }
        } catch (err: any) {
          logger.error(
            `Failed to parse WebSocket frame from player [${ws.data.id}]: ${err.message}`
          );
        }
      },
    },
  });

  setupGracefulShutdown(serviceServer);

  logger.info(`Matchmaking service is running on port ${serviceServer.port}.`);

  setTimeout(matchmakingTick, 1000);
}

/**
 * Sets up graceful shutdown handlers for the matchmaking service, ensuring that all active players are removed from the queue and notified before the server exits
 * @param server The Bun server instance to attach shutdown handlers to
 */
function setupGracefulShutdown(server: any) {
  const cleanup = async () => {
    logger.info('Shutdown signal received. Cleaning up matchmaking queue...');

    server.stop();

    const playerIds = Array.from(activeConnections.keys());
    if (playerIds.length > 0) {
      logger.info(`Removing ${playerIds.length} active players from Redis...`);
      const pipeline = redis.pipeline();
      for (const id of playerIds) {
        pipeline.zrem('matchmaking:queue', id);

        const ws = activeConnections.get(id);
        if (ws) {
          ws.send(JSON.stringify({ type: 'CANCELLED', message: 'Server restarting.' }));
          ws.close();
        }
      }
      await pipeline.exec();
    }

    logger.info('Cleanup complete. Exiting.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

import { Matchmaker, MATCH_CHANNEL, type Match } from './matchmaker';
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
} from '../db/telemetry';

const logger = createLogger('MatchmakerService');
const matchmaker = new Matchmaker();

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
}

const activeConnections = new Map<string, ServerWebSocket<PlayerSocketData>>();

function stringifyMessage(message: OutgoingMessage): string {
  const result = OutgoingMessageSchema.safeParse(message);
  if (!result.success) {
    logger.error(`Failed to validate outgoing message: ${result.error.message}`);
    throw new Error('Outbound message validation failed');
  }
  return JSON.stringify(result.data);
}

async function setupRedisPubSubSubscriber() {
  const subRedis = redis.duplicate();
  await subRedis.connect();

  await subRedis.subscribe(MATCH_CHANNEL, async message => {
    try {
      const payload = JSON.parse(message as unknown as string);

      if (payload.type === 'MATCH_PROPOSED') {
        const match: Match = payload.match;
        const matchId = `match:${match.playerA}:${match.playerB}`;

        const hasPlayerA = activeConnections.has(match.playerA);
        const hasPlayerB = activeConnections.has(match.playerB);

        if (hasPlayerA) {
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

        if (hasPlayerA) matchesProposed.inc();
        if (hasPlayerB) matchesProposed.inc();

        handleMatchProposal(match.playerA, match.playerB, matchId);
        handleMatchProposal(match.playerB, match.playerA, matchId);
      } else if (payload.type === 'MATCH_READY') {
        const { playerA, playerB, room } = payload;

        if (activeConnections.has(playerA)) matchesCompleted.inc();
        if (activeConnections.has(playerB)) matchesCompleted.inc();

        finalizeMatch(playerA, playerB, room);
      } else if (payload.type === 'MATCH_ABORTED') {
        const { keptPlayerId, failedPlayerId } = payload;

        if (activeConnections.has(keptPlayerId)) matchesTimedOut.inc();
        if (activeConnections.has(failedPlayerId)) matchesTimedOut.inc();

        handleMatchAborted(keptPlayerId, failedPlayerId);
      }
    } catch (err: any) {
      logger.error(`Error processing Pub/Sub match event: ${err.message}`);
    }
  });
}

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
    await redis.del(matchId);
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

async function handleMatchTimeout(matchId: string) {
  const matchData = await redis.hgetall(matchId);
  if (!matchData || Object.keys(matchData).length === 0) return;

  await redis.del(matchId);

  const acceptA = matchData.acceptA === 'true';
  const acceptB = matchData.acceptB === 'true';

  if (!acceptA && !acceptB) {
    await abortPlayer(matchData.playerA!);
    await abortPlayer(matchData.playerB!);
  } else if (acceptA && !acceptB) {
    await redis.publish(
      MATCH_CHANNEL,
      JSON.stringify({
        type: 'MATCH_ABORTED',
        keptPlayerId: matchData.playerA,
        failedPlayerId: matchData.playerB,
      })
    );
  } else if (!acceptA && acceptB) {
    await redis.publish(
      MATCH_CHANNEL,
      JSON.stringify({
        type: 'MATCH_ABORTED',
        keptPlayerId: matchData.playerB,
        failedPlayerId: matchData.playerA,
      })
    );
  }
}

async function abortPlayer(playerId: string) {
  const ws = activeConnections.get(playerId);
  if (ws) {
    ws.send(stringifyMessage({ type: 'MATCH_FAILED', message: 'Match failed or timed out.' }));
    ws.close();
  } else {
    await matchmaker.leaveQueue(playerId);
  }
}

async function handleMatchAborted(keptPlayerId: string, failedPlayerId: string) {
  await abortPlayer(failedPlayerId);

  const wsKept = activeConnections.get(keptPlayerId);
  if (wsKept) {
    wsKept.send(
      stringifyMessage({
        type: 'QUEUED',
        message: 'Opponent failed to accept. Returning to queue.',
      })
    );
    await matchmaker.joinQueue(keptPlayerId, wsKept.data.elo);
  }
}

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

async function matchmakingTick() {
  activeQueuedPlayers.set(activeConnections.size);

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

        activeConnections.set(id, ws);
        await matchmaker.joinQueue(id, elo);
        activeQueuedPlayers.set(activeConnections.size);

        ws.send(stringifyMessage({ type: 'QUEUED', message: 'Successfully queued.' }));
      },

      async close(ws) {
        const { id } = ws.data;
        logger.debug(`Player [${id}] left queue/disconnected.`);

        activeConnections.delete(id);
        await matchmaker.leaveQueue(id);
        activeQueuedPlayers.set(activeConnections.size);
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
            const { id } = ws.data;
            logger.debug(`Player [${id}] cancelled matchmaking.`);

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

  logger.info(`Matchmaking Service running on port ${serviceServer.port}.`);

  setTimeout(matchmakingTick, 1000);
}

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

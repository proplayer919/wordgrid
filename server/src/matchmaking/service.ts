import { Matchmaker } from './matchmaker';
import { createLogger } from '../logging';
import type { ServerWebSocket } from 'bun';
import { MATCHMAKING_PORT } from '../env';

const logger = createLogger('MatchmakerService');
const matchmaker = new Matchmaker();

interface PlayerSocketData {
  id: string;
  elo: number;
  joinedAt: number;
}

type SocketMessageType = 'CANCEL' | 'MATCH_FOUND' | 'QUEUED' | 'CANCELLED';

type SocketMessage = {
  type: SocketMessageType;
  message?: string;
  opponent?: string;
  room?: string;
};

function stringifyMessage(message: SocketMessage): string {
  return JSON.stringify(message);
}

const activeConnections = new Map<string, ServerWebSocket<PlayerSocketData>>();

export async function startMatchmakingService() {
  const serviceServer = Bun.serve<PlayerSocketData>({
    port: MATCHMAKING_PORT,
    fetch(req, server) {
      const url = new URL(req.url);

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
      async open(ws) {
        const { id, elo } = ws.data;
        logger.debug(`Player [${id}] entered queue with Elo [${elo}].`);

        activeConnections.set(id, ws);
        await matchmaker.joinQueue(id, elo);

        ws.send(stringifyMessage({ type: 'QUEUED', message: 'Successfully queued.' }));
      },

      async close(ws) {
        const { id } = ws.data;
        logger.debug(`Player [${id}] left queue/disconnected.`);

        activeConnections.delete(id);
        await matchmaker.leaveQueue(id);
      },

      async message(ws, message) {
        try {
          const data = JSON.parse(String(message));

          if (data.type === 'CANCEL') {
            const { id } = ws.data;
            logger.debug(`Player [${id}] cancelled matchmaking.`);

            ws.send(
              stringifyMessage({ type: 'CANCELLED', message: 'Queue cancelled successfully.' })
            );

            ws.close();
          }
        } catch (err: any) {
          logger.error(`Error processing message from player [${ws.data.id}]: ${err.message}`);
        }
      },
    },
  });

  logger.info(`Matchmaking Service running on port ${serviceServer.port}.`);

  setInterval(async () => {
    if (activeConnections.size < 2) return;

    const BASE_TOLERANCE = 50;
    const MAX_TOLERANCE = 500;
    const TOLERANCE_GROWTH_PER_SECOND = 15;

    for (const [playerId, ws] of activeConnections.entries()) {
      const { elo, joinedAt } = ws.data;

      const secondsWaiting = (Date.now() - joinedAt) / 1000;
      const dynamicTolerance = Math.min(
        BASE_TOLERANCE + secondsWaiting * TOLERANCE_GROWTH_PER_SECOND,
        MAX_TOLERANCE
      );

      logger.debug(
        `Evaluating ${playerId} (Elo: ${elo}) | Search Range: ±${Math.round(dynamicTolerance)}`
      );

      const match = await matchmaker.findMatch(playerId, elo, dynamicTolerance);

      if (match) {
        logger.debug(`Match made: ${match.playerA} vs ${match.playerB}`);

        const ws1 = activeConnections.get(match.playerA);
        const ws2 = activeConnections.get(match.playerB);

        const roomName = `room_${match.playerA}_${match.playerB}`;

        if (ws1) {
          ws1.send(
            stringifyMessage({
              type: 'MATCH_FOUND',
              opponent: match.playerB,
              room: roomName,
            })
          );
          ws1.close();
        }

        if (ws2) {
          ws2.send(
            stringifyMessage({
              type: 'MATCH_FOUND',
              opponent: match.playerA,
              room: roomName,
            })
          );
          ws2.close();
        }
      }
    }
  }, 1000);
}

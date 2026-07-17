import client from 'prom-client';
import { heapStats } from 'bun:jsc';

export const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'server_',
});

export const activeQueuedPlayers = new client.Gauge({
  name: 'matchmaking_active_queued_players',
  help: 'Current number of players actively waiting in the queue',
  registers: [register],
});

export const matchesProposed = new client.Counter({
  name: 'matchmaking_matches_proposed_total',
  help: 'Total matches proposed to players',
  registers: [register],
});

export const matchesCompleted = new client.Counter({
  name: 'matchmaking_matches_completed_total',
  help: 'Total successfully accepted matches',
  registers: [register],
});

export const matchesTimedOut = new client.Counter({
  name: 'matchmaking_matches_timed_out_total',
  help: 'Total matches aborted due to timeout',
  registers: [register],
});

export const matchesRejected = new client.Counter({
  name: 'matchmaking_matches_rejected_total',
  help: 'Total matches rejected by players',
  registers: [register],
});

const bunJscHeapUsedBytes = new client.Gauge({
  name: 'bun_jsc_heap_size_used_bytes',
  help: 'Total memory used by JavaScriptCore heap objects in bytes.',
});

setInterval(() => {
  try {
    const stats = heapStats();
    bunJscHeapUsedBytes.set(stats.heapSize);
  } catch (err) {
    console.error('Failed to collect Bun JSC heap stats:', err);
  }
}, 5000).unref();

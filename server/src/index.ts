import { startServer } from './api/service';
import redis from './db/redis';
import { createLogger } from './logging';
import { startMatchmakingService } from './matchmaking/service';

const logger = createLogger('Server');

logger.info('Server is starting...');

if (redis.status === 'wait') {
  await redis.connect();
}

await startServer()  .then(() => {
    logger.info('API service started successfully.');
  })
  .catch((error) => {
    logger.error(`Failed to start API: ${error.message}`);
    process.exit(1);
  });

await startMatchmakingService()
  .then(() => {
    logger.info('Matchmaking service started successfully.');
  })
  .catch((error) => {
    logger.error(`Failed to start matchmaking service: ${error.message}`);
    process.exit(1);
  });

import Redis from 'ioredis';
import { createLogger } from '../logging';
import { REDIS_HOST, REDIS_PORT } from '../env';

const logger = createLogger('RedisClient');

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
});

redis.on('connect', () => logger.info('Connected to Redis'));
redis.on('error', err => logger.error(`Redis error: ${err.message}`));

export default redis;

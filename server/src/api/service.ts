import { Elysia } from 'elysia';
import { autoload } from 'elysia-autoload';
import { API_PORT } from '../env';
import { createLogger } from '../logging';

const logger = createLogger('APIService');

export async function startServer() {
  const app = new Elysia()
    .use(
      await autoload({
        dir: './api/routes',
      })
    )
    .listen(API_PORT);

  logger.info(`API service is running on port ${API_PORT}`);

  return app;
}

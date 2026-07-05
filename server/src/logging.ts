import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:d mmm h:MMtt',
    ignore: 'pid,hostname,component',
    messageFormat: '{component}: {msg}',
  },
});

export const logger = pino(
  {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

export function createLogger(name: string) {
  return logger.child({ component: name });
}

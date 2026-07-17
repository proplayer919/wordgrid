export const API_PORT = Number(process.env.API_PORT) || 8210;
export const MATCHMAKING_PORT = Number(process.env.MATCHMAKING_PORT) || 8211;

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://wordgrid-mongo:27017/wordgrid';
export const REDIS_HOST = process.env.REDIS_HOST || 'wordgrid-redis';
export const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
export const TOKEN_EXPIRATION = '24h' as const;

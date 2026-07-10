export const API_PORT = Number(process.env.API_PORT) || 3000;
export const MATCHMAKING_PORT = Number(process.env.MATCHMAKING_PORT) || 3001;

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wordgrid';
export const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
export const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

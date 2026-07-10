import { MongoClient } from 'mongodb';
import { createLogger } from '../logging';
import { MONGODB_URI } from '../env';

const logger = createLogger('MongoClient');

const client = new MongoClient(MONGODB_URI);

client
  .connect()
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error(`MongoDB connection error: ${err.message}`));

client.on('connectionPoolCreated', () => logger.info('MongoDB connection pool created'));
client.on('error', err => logger.error(`MongoDB error: ${err.message}`));

export default client;

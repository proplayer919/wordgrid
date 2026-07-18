import mongo from './mongo';
import { createLogger } from '../logging';
import type { Collection } from 'mongodb';

const logger = createLogger('MongoCollections');

function getCollectionOrInitialise(collectionName: string): Collection {
  const db = mongo.db();
  const collection = db.collection(collectionName);

  if (!collection) {
    logger.error(`Collection ${collectionName} does not exist. Initialising...`);
    db.createCollection(collectionName);
    return db.collection(collectionName);
  }

  return collection;
}

export const usersCollection = getCollectionOrInitialise('users');
export const friendshipsCollection = getCollectionOrInitialise('friendships');
export const friendRequestsCollection = getCollectionOrInitialise('friendRequests');

usersCollection.createIndex({ username: 1 }, { unique: true });
usersCollection.createIndex({ uuid: 1 }, { unique: true });

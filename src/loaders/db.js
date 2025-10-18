import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import User from '../db/models/User.js';

async function ensureUserIndexes() {
  try {
    const coll = User.collection;
    const idx = await coll.indexes();
    const byName = Object.fromEntries(idx.map(i => [i.name, i]));

    // si existiera uid_1 único de intentos previos, lo bajamos
    if (byName['uid_1']?.unique) {
      await coll.dropIndex('uid_1').catch(() => {});
      logger.info('[db] dropped uid_1 unique index');
    }

    await coll.createIndex({ email: 1 }, { unique: true, sparse: true });
    await coll.createIndex({ uid: 1 }); // no unique
  } catch (e) {
    logger.warn('[db] ensureUserIndexes warn:', e?.message || e);
  }
}

export async function connectDB() {
  const uri = config.mongoUri;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  logger.info(`[db] connected → ${uri}`);
  await ensureUserIndexes();
}

import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  const uri = config.mongoUri;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  logger.info(`[db] connected → ${uri}`);
}

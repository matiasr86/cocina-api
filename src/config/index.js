import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5175),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/dekam',
  adminToken: process.env.ADMIN_TOKEN || 'super-secreto-123'
};

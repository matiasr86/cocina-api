import dotenv from 'dotenv';
dotenv.config();

function parseMap(json, fallback) {
  try { return JSON.parse(json || ''); } catch { return fallback; }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5175),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/dekam',
  adminToken: process.env.ADMIN_TOKEN || 'super-secreto-123',
  odoo: {
    url: process.env.ODOO_URL,     
    db: process.env.ODOO_DB,       
    user: process.env.ODOO_USER,   
    apiKey: process.env.ODOO_API_KEY,
  },
  programToCredits: parseMap(process.env.PROGRAM_TO_CREDITS_JSON, {
    // fallback de ejemplo: { "4": 3 }
  }),
  cooldownSeconds: Number(process.env.COOLDOWN_SECONDS || 600),  // 10 min
  inflightLockSeconds: Number(process.env.INFLIGHT_LOCK_SECONDS || 900), // 15 min
};

import { createExpressApp } from './loaders/express.js';
import { connectDB } from './loaders/db.js';

export async function initApp() {
  await connectDB();
  const app = createExpressApp();
  return app;
}

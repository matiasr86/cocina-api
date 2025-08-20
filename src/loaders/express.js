import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from '../routes/index.js';
import { errorHandler } from '../middlewares/errorHandler.js';

export function createExpressApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api', routes);        // rutas de la app
  app.use(errorHandler);          // manejo centralizado de errores

  return app;
}

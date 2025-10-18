import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from '../routes/index.js';
import { errorHandler } from '../middlewares/errorHandler.js';

export function createExpressApp() {
  const app = express();
  app.use(cors());
  app.set('etag', false); // evita 304 por ETag en respuestas GET

  // ⬇️ NUEVO: más límite solo para /api/render (para el DataURL del canvas)
  app.use('/api/render', express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api', routes);        // rutas de la app
  app.use(errorHandler);          // manejo centralizado de errores

  return app;
}

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from '../routes/index.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { globalLimiter } from '../middlewares/rateLimit.js';

export function createExpressApp() {
  const app = express();

  // (opcional) si vas detrás de proxy (Nginx/Render/Heroku), activá trust proxy
  if (process.env.RL_TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }
  
  const allowlist = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const allowSuffixes = (process.env.ALLOWED_ORIGIN_SUFFIXES || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const corsOptions = {
    origin: (origin, cb) => {
      // requests sin Origin (postman, server-to-server, etc.)
      if (!origin) return cb(null, true);

      const okByList = allowlist.includes(origin);
      const okBySuffix = allowSuffixes.some(suf => origin.endsWith(suf));

      if (okByList || okBySuffix) return cb(null, true);
      return cb(null, false); // sin headers CORS => el browser lo bloquea
    },
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Authorization','Content-Type'],
    credentials: false,
    optionsSuccessStatus: 204,
    maxAge: 60 * 60 * 24
  };

  app.use((req, res, next) => { res.header('Vary', 'Origin'); next(); });
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));




  app.set('etag', false); // evita 304 por ETag en respuestas GET

  // ⬇️ NUEVO: más límite solo para /api/render (para el DataURL del canvas)
  app.use('/api/render', express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

   app.use('/api', globalLimiter);

  app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api', routes);        // rutas de la app
  app.use(errorHandler);          // manejo centralizado de errores

  return app;
}

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
  
  // CORS por allowlist (desde ALLOWED_ORIGINS)
  const allowlist = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);


  console.log('[CORS] NODE_ENV=', process.env.NODE_ENV);
  console.log('[CORS] ALLOWED_ORIGINS=', process.env.ALLOWED_ORIGINS);

  const corsOptions = {
    origin: (origin, cb) => {
      // Permite requests sin Origin (curl/health checks) y los que estén en allowlist
      if (!origin || allowlist.includes(origin)) {
        return cb(null, true);
      }
      // Bloquea orígenes no permitidos (sin lanzar error)
      return cb(null, false);
    },
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Authorization','Content-Type'],
    credentials: false,              // No usamos cookies para auth
    optionsSuccessStatus: 204,
    maxAge: 60 * 60 * 24,            // cache del preflight (24h)
  };

  // Sugerencia: ayuda a caches/proxies a variar por Origin
  app.use((req, res, next) => {
    res.header('Vary', 'Origin');
    next();
  });

  // Aplica CORS
  app.use(cors(corsOptions));
  // Preflight explícito (por si algún proxy no lo maneja solo)
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

import { initApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

initApp()
  .then(app => {
    app.listen(config.port, () => {
      logger.info(`[api] listening on http://localhost:${config.port}`);
    });
  })
  .catch(err => {
    logger.error('[api] failed to start:', err);
    process.exit(1);
  });

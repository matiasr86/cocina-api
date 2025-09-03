// src/routes/overrides.routes.js
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import * as ctrl from '../controllers/overrides.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Lectura (pública)
router.get('/overrides', asyncHandler(ctrl.getOverrides));

// Escritura: sólo admin autenticado
router.put(
  '/overrides/:type',
  requireAuth,
  requireAdmin,
  asyncHandler(ctrl.putOverride)      // <- nombre correcto
);

router.delete(
  '/overrides',
  requireAuth,
  requireAdmin,
  asyncHandler(ctrl.deleteOverrides)  // <- nombre correcto
);

export default router;

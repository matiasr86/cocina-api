// api/src/routes/overrides.routes.js
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import * as ctrl from '../controllers/overrides.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/**
 * Base mount: /api/overrides
 * - GET    /           → público: listar overrides
 * - PUT    /:type      → admin: crear/actualizar override por tipo
 * - DELETE /           → admin: borrar todos los overrides
 */

// Lectura (pública)
router.get('/', asyncHandler(ctrl.getOverrides));

// Escritura: sólo admin autenticado
router.put('/:type', requireAuth, requireAdmin, asyncHandler(ctrl.putOverride));
router.delete('/',  requireAuth, requireAdmin, asyncHandler(ctrl.deleteOverrides));

export default router;

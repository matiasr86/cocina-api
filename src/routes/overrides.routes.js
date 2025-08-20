import { Router } from 'express';
import { getOverrides, putOverride, deleteOverrides } from '../controllers/overrides.controller.js';
import { requireAdmin } from '../middlewares/auth.js';

const router = Router();

// público (lectura)
router.get('/', getOverrides);

// admin (escritura)
router.put('/:type', requireAdmin, putOverride);
router.delete('/', requireAdmin, deleteOverrides);

export default router;

import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { postRenderTriad } from '../controllers/renders.controller.js';
import { renderLimiterByUser } from '../middlewares/rateLimit.js';

const router = Router();


// NUEVO: flujo “best of 3” con consumo de 1 crédito solo si hay 3 renders OK
router.post('/triad', requireAuth, renderLimiterByUser, asyncHandler(postRenderTriad));

export default router;

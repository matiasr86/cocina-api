import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { postPhotoGeminiRaw, postRenderTriad } from '../controllers/renders.controller.js';

const router = Router();

// (sigue igual) texto+imagen -> una imagen (preview simple, sin consumir crédito)
router.post('/photo.gemini.raw', asyncHandler(postPhotoGeminiRaw));

// NUEVO: flujo “best of 3” con consumo de 1 crédito solo si hay 3 renders OK
router.post('/triad', requireAuth, asyncHandler(postRenderTriad));

export default router;

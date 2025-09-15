import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  postPhotoRaw,
  postPhotoGuidedRaw,
  postPhotoGeminiRaw,
  postPhotoGeminiMultiRaw
} from '../controllers/renders.controller.js';

const router = Router();

router.post('/photo.raw',        asyncHandler(postPhotoRaw));
router.post('/photo.guided.raw', asyncHandler(postPhotoGuidedRaw));

// Nuevo (Gemini, imagen + prompt)
router.post('/photo.gemini.raw', asyncHandler(postPhotoGeminiRaw));
// 👇 nuevo multi-pared
router.post('/photo.gemini.multi.raw', asyncHandler(postPhotoGeminiMultiRaw));

export default router;

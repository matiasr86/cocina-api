// api/src/routes/fabricators.routes.js
import { Router } from 'express';
import { listPublic, createPublic, adminList, adminPatch } from '../controllers/fabricators.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// Público
router.get('/', asyncHandler(listPublic));
router.post('/', asyncHandler(createPublic)); // si validás reCAPTCHA, dejalo antes de este handler

// Admin
router.get('/admin', requireAuth, requireAdmin, asyncHandler(adminList));
router.patch('/admin/:id', requireAuth, requireAdmin, asyncHandler(adminPatch));

export default router;

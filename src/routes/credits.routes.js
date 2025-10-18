// api/src/routes/credits.routes.js
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { getMyCredits, redeemCode } from '../controllers/credits.controller.js';

const router = Router();
router.get('/me', requireAuth, asyncHandler(getMyCredits));
router.post('/redeem', requireAuth, asyncHandler(redeemCode));

export default router;

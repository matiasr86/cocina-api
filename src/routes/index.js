import { Router } from 'express';
import overridesRoutes from './overrides.routes.js';

const router = Router();

router.use('/overrides', overridesRoutes);

export default router;

import { Router } from 'express';
import overridesRoutes from './overrides.routes.js';
import projectsRoutes  from './projects.routes.js'; 
import rendersRoutes   from './renders.routes.js';
import creditsRoutes   from './credits.routes.js';

const router = Router();

router.use('/overrides', overridesRoutes);
router.use('/projects', projectsRoutes);
router.use('/render', rendersRoutes);
router.use('/credits', creditsRoutes);   

export default router;

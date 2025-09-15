// api/src/routes/index.js
import { Router } from 'express';
import overridesRoutes from './overrides.routes.js';
import projectsRoutes  from './projects.routes.js'; 
import rendersRoutes from './renders.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

router.use('/',          overridesRoutes);
router.use('/projects',  projectsRoutes);
router.use('/render', rendersRoutes);

export default router;

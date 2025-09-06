// src/routes/projects.routes.js
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listMyProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
} from '../controllers/projects.controller.js';

const router = Router();

// Todas requieren auth
router.use(requireAuth);

router.get('/',        asyncHandler(listMyProjects));
router.post('/',       asyncHandler(createProject));
router.get('/:id',     asyncHandler(getProject));
router.put('/:id',     asyncHandler(updateProject));
router.delete('/:id',  asyncHandler(deleteProject));

export default router;

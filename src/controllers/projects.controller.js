// src/controllers/projects.controller.js
import { Project } from '../db/models/Project.js';

const MAX_PROJECTS_PER_USER = 5;

function getUid(req) {
  // viene del verifyIdToken() de Firebase
  // req.user = decoded token → contiene uid y email
  return req.user?.uid || null;
}

/** GET /api/projects */
export async function listMyProjects(req, res) {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const docs = await Project
    .find({ userId: uid })
    .sort({ updatedAt: -1 })
    .select({ __v: 0 });

  res.json({ items: docs });
}

/** POST /api/projects */
export async function createProject(req, res) {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  // Limite por usuario
  const count = await Project.countDocuments({ userId: uid });
  if (count >= MAX_PROJECTS_PER_USER) {
    return res.status(409).json({
      error: 'limit_reached',
      message: `Alcanzaste el máximo de ${MAX_PROJECTS_PER_USER} proyectos.`,
    });
  }

  const {
    title,
    kitchenType,
    walls,
    modulesByWall,
    quality,
    summary,
    breakdown,
  } = req.body || {};

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title_required' });
  }

  const doc = await Project.create({
    userId: uid,
    title: title.trim(),
    kitchenType,
    walls,
    modulesByWall,
    quality,
    summary,
    breakdown,
  });

  res.status(201).json({ ok: true, project: doc });
}

/** GET /api/projects/:id */
export async function getProject(req, res) {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const doc = await Project.findOne({ _id: id, userId: uid }).select({ __v: 0 });
  if (!doc) return res.status(404).json({ error: 'Not found' });

  res.json({ project: doc });
}

/** PUT /api/projects/:id */
export async function updateProject(req, res) {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const payload = req.body || {};

  // Solo permitir actualizar campos conocidos
  const patch = {};
  if (typeof payload.title === 'string')       patch.title       = payload.title.trim();
  if (payload.kitchenType !== undefined)       patch.kitchenType = payload.kitchenType;
  if (payload.walls !== undefined)             patch.walls       = payload.walls;
  if (payload.modulesByWall !== undefined)     patch.modulesByWall = payload.modulesByWall;
  if (payload.quality !== undefined)           patch.quality     = payload.quality;
  if (payload.summary !== undefined)           patch.summary     = payload.summary;
  if (payload.breakdown !== undefined)         patch.breakdown   = payload.breakdown;

  const doc = await Project.findOneAndUpdate(
    { _id: id, userId: uid },
    { $set: patch },
    { new: true, runValidators: true }
  ).select({ __v: 0 });

  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, project: doc });
}

/** DELETE /api/projects/:id */
export async function deleteProject(req, res) {
  const uid = getUid(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const doc = await Project.findOneAndDelete({ _id: id, userId: uid });
  if (!doc) return res.status(404).json({ error: 'Not found' });

  res.json({ ok: true });
}

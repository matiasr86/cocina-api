// api/src/services/projects.service.js
import Project from '../db/models/Project.js';

export const LIMIT_PER_USER = 5;

export async function listByUser(userId) {
  return Project.find({ userId }).sort({ updatedAt: -1 }).lean();
}

export async function countByUser(userId) {
  return Project.countDocuments({ userId });
}

export async function getByIdOwned(id, userId) {
  const doc = await Project.findById(id).lean();
  if (!doc) return null;
  if (doc.userId !== userId) return 'FORBIDDEN';
  return doc;
}

export async function createForUser(userId, payload) {
  const current = await countByUser(userId);
  if (current >= LIMIT_PER_USER) return 'LIMIT_REACHED';
  const doc = await Project.create({ ...payload, userId });
  return doc.toObject();
}

export async function updateOwned(id, userId, payload) {
  const doc = await Project.findById(id);
  if (!doc) return null;
  if (doc.userId !== userId) return 'FORBIDDEN';

  doc.name         = payload.name;
  doc.version      = payload.version;
  doc.quality      = payload.quality ?? null;
  doc.kitchenType  = payload.kitchenType;
  doc.walls        = payload.walls;
  doc.activeWallId = payload.activeWallId;
  doc.modules      = payload.modules || new Map();

  await doc.save();
  return doc.toObject();
}

export async function removeOwned(id, userId) {
  const doc = await Project.findById(id);
  if (!doc) return null;
  if (doc.userId !== userId) return 'FORBIDDEN';
  await doc.deleteOne();
  return true;
}

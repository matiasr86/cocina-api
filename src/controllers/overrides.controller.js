import { asyncHandler } from '../utils/asyncHandler.js';
import { listOverrides, upsertOverride, resetOverrides } from '../services/overrides.service.js';

export const getOverrides = asyncHandler(async (req, res) => {
  const data = await listOverrides();
  res.json(data);
});

export const putOverride = asyncHandler(async (req, res) => {
  const { type } = req.params;
  if (!type) return res.status(400).json({ error: 'type is required' });

  const patch = req.body || {};
  const saved = await upsertOverride(type, patch);
  // devolver estado completo para que el cliente refresque
  const data = await listOverrides();
  res.json({ ok: true, saved, ...data });
});

export const deleteOverrides = asyncHandler(async (req, res) => {
  await resetOverrides();
  res.json({ ok: true, byType: {} });
});

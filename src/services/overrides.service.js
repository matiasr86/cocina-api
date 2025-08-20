import { Override } from '../db/models/Override.js';

export async function listOverrides() {
  // Devuelve objeto { byType: { [type]: {...} } }
  const docs = await Override.find().lean();
  const byType = {};
  for (const d of docs) {
    byType[d.type] = {
      visible: d.visible,
      sizes: d.sizes,
      prices: d.prices
    };
  }
  return { byType };
}

export async function upsertOverride(type, patch) {
  const update = {};
  if ('visible' in patch) update.visible = !!patch.visible;
  if ('sizes' in patch)   update.sizes   = Array.isArray(patch.sizes) ? patch.sizes : [];
  if ('prices' in patch)  update.prices  = patch.prices || {};

  const doc = await Override.findOneAndUpdate(
    { type },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc.toObject();
}

export async function resetOverrides() {
  await Override.deleteMany({});
  return { ok: true };
}

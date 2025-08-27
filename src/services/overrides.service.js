// src/services/overrides.service.js
import { Override } from '../db/models/Override.js'; // ⬅️ Ajustá esta ruta si tu modelo vive en /db/models
import { sanitizeSizes } from '../utils/sanitizeSizes.js';

/**
 * Devuelve { byType } para que el front pueda mergear con el catálogo base.
 * Estructura:
 * {
 *   byType: {
 *     [type]: { name, visible, prices, sizes }
 *   }
 * }
 */
export async function listOverrides() {
  const docs = await Override.find().lean();

  const byType = {};
  for (const d of docs) {
    byType[d.type] = {
      name:    d.name ?? null,
      subtitle: d.subtitle ?? null, 
      visible: d.visible ?? true,
      sizes:   Array.isArray(d.sizes) ? d.sizes : [],
      prices:  d.prices ?? {},
    };
  }

  return { byType };
}

/**
 * Upsert por type. Recibe patch flexible: { name?, visible?, prices?, sizes? }
 * - prices se normaliza a Number o null
 * - sizes se normaliza con sanitizeSizes (asegura 1 sola estándar)
 */
export async function upsertOverride(type, patch = {}) {
  const update = { type };

  if ('name' in patch)    update.name    = patch.name ?? null;
  if ('subtitle' in patch) update.subtitle = patch.subtitle;  
  if ('visible' in patch) update.visible = !!patch.visible;

  if ('prices' in patch) {
    update.prices = {
      started: patch.prices?.started != null ? Number(patch.prices.started) : null,
      premium: patch.prices?.premium != null ? Number(patch.prices.premium) : null,
      deluxe:  patch.prices?.deluxe  != null ? Number(patch.prices.deluxe)  : null,
    };
  }

  if ('sizes' in patch) {
    update.sizes = sanitizeSizes(patch.sizes);
  }

  // Upsert y devolvemos el doc actualizado en formato plano
  const doc = await Override.findOneAndUpdate(
    { type },
    { $set: update },
    { upsert: true, new: true }
  ).lean();

  return doc ?? update; // fallback por las dudas
}

export async function resetOverrides() {
  await Override.deleteMany({});
  return { ok: true };
}

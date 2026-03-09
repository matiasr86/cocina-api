import { generatePhotoGeminiRaw } from '../services/renders.service.js';
import { reserveWelcomeMonthlySlot } from '../services/credits.service.js';
import { buildPromptForPayload } from '../utils/prompts/index.js';
import User from '../db/models/User.js';
import Transaction from '../db/models/Transaction.js';



// (ya no hace falta: import mongoose from 'mongoose')

// ====== helpers ======
function normalizeSize(q) {
  const s = (q || '').toString();
  if (s === '512'  || s === '512x512')   return '512x512';
  if (s === '768'  || s === '768x768')   return '768x768';
  if (s === '1024' || s === '1024x1024') return '1024x1024';
  return '1024x1024';
}
function dataUrlToBuffer(dataUrl) {
  const m = /^data:(.+?);base64,([\s\S]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Bad data URL');
  return { buffer: Buffer.from(m[2], 'base64'), mimeType: m[1] };
}


/* ---------- TRIAD: consume crédito sólo si hay 3 OK ---------- */

export async function postRenderTriad(req, res) {
  const email = (req.user?.email || '').toLowerCase().trim();
  const uid = req.user?.uid || req.user?.user_id || null;

  if (!uid || !email) {
    return res.status(401).json({ ok: false, error: 'auth_required' });
  }

  const size = normalizeSize(req.body?.size || '1024x1024');
  const imageDataUrl = req.body?.imageDataUrl;
  const payload = req.body?.payload || null;
  if (!imageDataUrl || !payload) {
    return res.status(400).json({ ok: false, error: 'missing_params' });
  }

  const now = new Date();
  let userDoc = await User.findOne({ email });

  if (!userDoc) {
    return res.status(404).json({ ok: false, error: 'user_not_found' });
  }

  if (userDoc.cooldownUntil && userDoc.cooldownUntil > now) {
    const secs = Math.max(1, Math.ceil((userDoc.cooldownUntil - now) / 1000));
    return res.status(429).json({ ok:false, error:'cooldown', cooldownSeconds: secs });
  }

  if ((userDoc.credits || 0) <= 0) {
    return res.status(402).json({ ok:false, error:'no_credits' });
  }

  const locked = await User.findOneAndUpdate(
    { _id: userDoc._id, $or: [{ inflightRender: { $ne: true } }, { inflightRender: { $exists: false } }] },
    { $set: { inflightRender: true } },
    { new: true }
  );
  if (!locked) return res.status(409).json({ ok:false, error:'render_in_progress' });
  userDoc = locked;

  // ===== SAFETY-NET: todo lo que sigue va dentro de try/catch =====
  try {
    // 1) Prompt
    let prompt;
    try {
      prompt = buildPromptForPayload(payload);
    } catch (e) {
      await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false } });
      return res.status(400).json({ ok:false, error:'bad_payload', detail:e?.message });
    }

    // 2) Imagen
    let buf, mime;
    try {
      ({ buffer: buf, mimeType: mime } = dataUrlToBuffer(imageDataUrl));
    } catch {
      await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false } });
      return res.status(400).json({ ok:false, error:'bad_image' });
    }

    // ✅ si el usuario NUNCA compró, este render cuenta como "gratuito"
    const isFreeRender = !userDoc.hasPurchasedCredits;

    if (isFreeRender) {
      const slot = await reserveWelcomeMonthlySlot();
      if (!slot) {
        await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false } });
        return res.status(429).json({
          ok: false,
          error: 'welcome_monthly_limit',
          message: 'Se alcanzó el límite mensual de renders gratuitos (100).',
        });
      }
    }

    // 3) Llamadas al modelo
    async function genOne() {
      return generatePhotoGeminiRaw({ prompt, inputImageBuffer: buf, inputImageMime: mime, size });
    }

    let results = [];
    try {
      const all = await Promise.allSettled([genOne(), genOne(), genOne()]);
      results = all.filter(r => r.status === 'fulfilled').map(r => r.value);
    } catch {
      results = [];
    }

    // 4) Éxito → descuenta 1 crédito
    if (results.length === 3) {
      const updated = await User.findOneAndUpdate(
        { _id: userDoc._id },
        { $inc: { credits: -1 }, $set: { inflightRender: false, cooldownUntil: null } },
        { new: true }
      );
      await Transaction.create({ email, uid, type: 'render_triad', creditsDelta: -1, meta: { size, ok: true, freeRender: !userDoc.hasPurchasedCredits} });
      const images = results.map(b => `data:image/png;base64,${b.toString('base64')}`);
      return res.json({ ok:true, images, newTotal: updated?.credits ?? null });
    }

    // 5) Fallo parcial/total → cooldown y 503
    const cooldownMs = Number(process.env.COOLDOWN_SECONDS || 600) * 1000; // default 10 min
    const until = new Date(Date.now() + cooldownMs);
    await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false, cooldownUntil: until } });
    await Transaction.create({ email, uid, type: 'render_triad', creditsDelta: 0, meta: { size, ok:false, successCount: results.length, freeRender: isFreeRender } });
    return res.status(503).json({ ok:false, error:'model_failed', cooldownSeconds: Math.ceil(cooldownMs/1000) });

  } catch (e) {
    // 6) Cualquier excepción inesperada → mismo tratamiento de cooldown y 503
    console.error('[render/triad] unexpected error', e);
    const cooldownMs = Number(process.env.COOLDOWN_SECONDS || 600) * 1000;
    const until = new Date(Date.now() + cooldownMs);
    try {
      await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false, cooldownUntil: until } });
      await Transaction.create({ email, uid, type: 'render_triad', creditsDelta: 0, meta: { size, ok:false, crashed:true }, freeRender: isFreeRender });
    } catch {}
    return res.status(503).json({ ok:false, error:'model_failed', cooldownSeconds: Math.ceil(cooldownMs/1000) });
  }
}




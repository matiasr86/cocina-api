import { generatePhotoGeminiRaw } from '../services/renders.service.js';
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

/* ---------- TU endpoint simple se queda igual ---------- */
export async function postPhotoGeminiRaw(req, res) {
  const size = normalizeSize(req.query.size || req.body?.size);
  const imageDataUrl = req.body?.imageDataUrl;
  if (!imageDataUrl) return res.status(400).json({ error: 'Missing imageDataUrl' });

  let prompt = req.body?.prompt;
  if (!prompt && req.body?.payload) {
    try { prompt = buildPromptForPayload(req.body.payload); }
    catch (e) { return res.status(400).json({ error: 'Bad payload', detail: e?.message }); }
  }
  if (!prompt) return res.status(400).json({ error: 'Missing prompt or payload' });

  const { buffer, mimeType } = dataUrlToBuffer(imageDataUrl);
  const out = await generatePhotoGeminiRaw({
    prompt,
    inputImageBuffer: buffer,
    inputImageMime: mimeType,
    size,
  });

  res.setHeader('Content-Type', 'image/png');
  res.send(out);
}

/* ---------- TRIAD: consume crédito sólo si hay 3 OK ---------- */
export async function postRenderTriad(req, res) {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ ok:false, error:'auth_required' });

  const size = normalizeSize(req.body?.size || '1024x1024');
  const imageDataUrl = req.body?.imageDataUrl;
  const payload = req.body?.payload || null;
  if (!imageDataUrl || !payload) {
    return res.status(400).json({ ok:false, error:'missing_params' });
  }

  const now = new Date();
  let userDoc = await User.findOneAndUpdate(
    { uid },
    { $setOnInsert: { uid, credits: 0, welcomeCreditGranted: false } },
    { new: true, upsert: true }
  );

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

  let prompt;
  try {
    // Construye el prompt estricto en base al payload (ya mezcla userText + bridgeStrict)
    prompt = buildPromptForPayload(payload);
  } catch (e) {
    await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false } });
    return res.status(400).json({ ok:false, error:'bad_payload', detail:e?.message });
  }



  let buf, mime;
  try { ({ buffer: buf, mimeType: mime } = dataUrlToBuffer(imageDataUrl)); }
  catch {
    await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false } });
    return res.status(400).json({ ok:false, error:'bad_image' });
  }

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

  if (results.length === 3) {
    const updated = await User.findOneAndUpdate(
      { _id: userDoc._id },
      { $inc: { credits: -1 }, $set: { inflightRender: false, cooldownUntil: null } },
      { new: true }
    );
    await Transaction.create({ uid, type: 'render_triad', creditsDelta: -1, meta: { size, ok: true } });
    const images = results.map(b => `data:image/png;base64,${b.toString('base64')}`);
    return res.json({ ok:true, images, newTotal: updated?.credits ?? null });
  }

  const cooldownMs = 10 * 60 * 1000;
  const until = new Date(Date.now() + cooldownMs);
  await User.updateOne({ _id: userDoc._id }, { $set: { inflightRender: false, cooldownUntil: until } });
  await Transaction.create({ uid, type: 'render_triad', creditsDelta: 0, meta: { size, ok:false, successCount: results.length } });

  return res.status(503).json({ ok:false, error:'model_failed', cooldownSeconds: Math.ceil(cooldownMs/1000) });
}

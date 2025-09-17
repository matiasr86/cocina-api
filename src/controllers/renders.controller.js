// api/src/controllers/renders.controller.js
import {
  generatePhotoRaw,
  generatePhotoGeminiRaw,
  generatePhotoGeminiMultiRaw
} from '../services/renders.service.js';
import { buildImagePromptFromPayload } from '../utils/buildImagePrompt.js';

function normalizeSize(q) {
  const s = (q || '').toString();
  if (s === '512'  || s === '512x512')   return '512x512';
  if (s === '768'  || s === '768x768')   return '768x768';
  if (s === '1024' || s === '1024x1024') return '1024x1024';
  return '1024x1024'; // por defecto, más grande
}

// Devuelve { buffer, mimeType } desde un DataURL (PNG/JPEG)
function dataUrlToBuffer(dataUrl) {
  const m = /^data:(.+?);base64,([\s\S]+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Bad data URL');
  return { buffer: Buffer.from(m[2], 'base64'), mimeType: m[1] };
}

// ========== OpenAI (texto → imagen) ==========
export async function postPhotoRaw(req, res) {
  const size = normalizeSize(req.query.size || req.body?.size);
  let prompt = req.body?.prompt;

  if (!prompt && req.body?.payload) {
    try {
      prompt = buildImagePromptFromPayload(req.body.payload);
    } catch (e) {
      return res.status(400).json({ error: 'Bad payload', detail: e?.message });
    }
  }
  if (!prompt) return res.status(400).json({ error: 'Missing prompt or payload' });

  const buf = await generatePhotoRaw({ prompt, size });
  res.setHeader('Content-Type', 'image/png');
  res.send(buf);
}

export async function postPhotoGuidedRaw(req, res) {
  return postPhotoRaw(req, res);
}

// ========== Gemini (imagen + texto → imagen) ==========
// Body: { payload?:object, prompt?:string, imageDataUrl: string(DataURL), size? }
export async function postPhotoGeminiRaw(req, res) {
  const size = normalizeSize(req.query.size || req.body?.size);
  const imageDataUrl = req.body?.imageDataUrl;
  if (!imageDataUrl) return res.status(400).json({ error: 'Missing imageDataUrl' });

  let prompt = req.body?.prompt;
  if (!prompt && req.body?.payload) {
    try {
      prompt = buildImagePromptFromPayload(req.body.payload);
    } catch (e) {
      return res.status(400).json({ error: 'Bad payload', detail: e?.message });
    }
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

/* ===== Helpers mini (para multi-pared) ===== */
function _rowOf(m) {
  if (m.row) return String(m.row);
  const h = Number(m.height) || 0;
  if (h >= 130) return 'tall';
  if (h >= 45 && h <= 95) return 'base';
  return 'upper';
}
function _label(m) {
  const w = m.width != null ? `${Number(m.width)} cm` : '';
  const extra =
    m.subtitle ? ` — ${m.subtitle}` :
    m.sizeLabel ? ` — ${m.sizeLabel}` :
    '';
  return `${m.title || m.type}${w ? ` (${w})` : ''}${extra}`;
}
function _lineByRow(mods = []) {
  const byRow = { base: [], upper: [], tall: [] };
  for (const m of mods) byRow[_rowOf(m)].push(m);
  const order = (arr) => {
    return [...arr].sort((a,b) => {
      const ax = Number(a.xCm ?? a.x ?? 0);
      const bx = Number(b.xCm ?? b.x ?? 0);
      if (Number.isFinite(ax) && Number.isFinite(bx)) return ax - bx;
      return String(a.title || a.type).localeCompare(String(b.title || b.type));
    });
  };
  const lines = [];
  if (byRow.base.length)  lines.push(`Bajo mesada (izq→der): ${order(byRow.base).map(_label).join(' | ')}.`);
  if (byRow.upper.length) lines.push(`Alacenas superiores (izq→der): ${order(byRow.upper).map(_label).join(' | ')}.`);
  if (byRow.tall.length)  lines.push(`Columnas/alto (izq→der): ${order(byRow.tall).map(_label).join(' | ')}.`);
  return lines;
}

/**
 * POST /api/render/photo.gemini.multi.raw
 * Body: {
 *   payload: {
 *     kitchenType: 'L'|'C',
 *     walls: [{ id, name, width, height }],
 *     modulesByWall: { [wallId]: Module[] },
 *     quality: 'started'|'premium'|'deluxe'
 *   },
 *   imageDataUrls: string[],   // DataURL de cada pared, ordenadas
 *   size?: '512x512'|'768x768'|'1024x1024'
 * }
 */
export async function postPhotoGeminiMultiRaw(req, res) {
  const { payload, imageDataUrls, size } = req.body || {};
  const kt = String(payload?.kitchenType || 'Recta');
  if (!Array.isArray(imageDataUrls) || !imageDataUrls.length) {
    return res.status(400).json({ error: 'Missing imageDataUrls[]' });
  }
  if (kt !== 'L' && kt !== 'C') {
    return res.status(400).json({ error: 'kitchenType must be "L" or "C" for multi-wall' });
  }

  // Prompt multi-pared textual (resumen por pared)
  const walls = Array.isArray(payload?.walls) ? payload.walls : [];
  const modulesByWall = payload?.modulesByWall || {};
  const order = kt === 'L' ? ['left','right'] : ['left','front','right'];

  const header = [
    `COCINA ${kt === 'L' ? 'EN L' : 'EN C/U'} — Referencias MULTI-PARED.`,
    `Recibirás ${imageDataUrls.length} imagen(es) en orden: ${order.join(' → ')} (cuando existan).`,
    'Objetivo: generar UNA imagen final de la pared principal (frontal/elevación) fiel a módulos y alineaciones.',
    '',
    'Esquineros / “parte negra”: cuando un esquinero muestre un lateral oscuro junto a la pared, ESO representa la profundidad del retorno de la pared adyacente. No es hueco; mantener continuidad y proporción con el módulo de la otra pared.',
  ].join('\n');

  const perWall = [];
  for (const wallId of order) {
    const w = walls.find(x => x.id === wallId);
    const mods = Array.isArray(modulesByWall?.[wallId]) ? modulesByWall[wallId] : [];
    if (!w && mods.length === 0) continue;
    perWall.push([
      `\n[Pared: ${w?.name || wallId}] Dimensiones aprox: ${Number(w?.width || 4)} m × ${Number(w?.height || 3)} m.`,
      'Composición (usa el orden literal izq→der):',
      ..._lineByRow(mods).map(s => `- ${s}`),
    ].join('\n'));
  }

  const reglas = [
    '',
    'REGLAS ESTRICTAS:',
    '• Seguir cantidades y orden por pared (izq→der) sin inventar.',
    '• No convertir puertas↔cajones ni mover hornos/anafes.',
    '• Alinear alacenas superiores en una línea limpia.',
    '• Vista frontal, fondo/piso neutros, sin personas ni textos.',
  ].join('\n');

  const finalPrompt = [header, ...perWall, reglas].join('\n');

  // DataURLs -> buffers
  function dataUrlToBuffer(d) {
    const m = /^data:(.+?);base64,([\s\S]+)$/.exec(d || '');
    if (!m) throw new Error('Bad data URL');
    return { buffer: Buffer.from(m[2], 'base64'), mime: m[1] || 'image/png' };
  }
  const imgs = imageDataUrls.map(dataUrlToBuffer);

  const buf = await generatePhotoGeminiMultiRaw({
    prompt: finalPrompt,
    images: imgs,
  });

  res.setHeader('Content-Type', 'image/png');
  res.send(buf);
}

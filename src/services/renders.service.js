// api/src/services/renders.service.js
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genai  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

/* ============== retry/backoff para 5xx ============== */
async function withRetry(fn, times = 3) {
  let lastErr;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status || e?.status || e?.code;
      const is5xx = typeof status === 'number' ? status >= 500 : false;
      if (is5xx && i < times - 1) {
        const delay = 400 * (i + 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

/* ============== extraer inline PNG ============== */
function extractInlinePng(resp) {
  const parts =
    resp?.response?.candidates?.[0]?.content?.parts ||
    resp?.candidates?.[0]?.content?.parts ||
    [];
  const imgPart = parts.find(p => p?.inlineData?.data);
  if (!imgPart) {
    const fr = resp?.response?.candidates?.[0]?.finishReason || 'unknown';
    throw new Error(`Gemini did not return an image (finishReason: ${fr})`);
  }
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

/* ===================== OPENAI (texto→img) ===================== */
export async function generatePhotoRaw({ prompt, size = '1024x1024' }) {
  const out = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size,
    n: 1,
  });
  const b64 = out.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned');
  return Buffer.from(b64, 'base64');
}

/* ============ GEMINI (texto + 1 imagen → img) ============ */
export async function generatePhotoGeminiRaw({
  prompt,
  inputImageBuffer,
  inputImageMime = 'image/png',
  size = '1024x1024',
}) {
  if (!inputImageBuffer) throw new Error('Missing input image buffer');

  const model = genai.getGenerativeModel({
    model: GEMINI_IMAGE_MODEL,
    generationConfig: {
      temperature: 0.15,   // ↓ menos invención
      topP: 0.9,
    },
  });

  const sizeHint =
    size === '512x512'  ? 'Imagen cuadrada 512×512.'  :
    size === '768x768'  ? 'Imagen cuadrada 768×768.'  :
    'Imagen cuadrada 1024×1024.';

  const strictRules = `
REGLAS ESTRICTAS DE FIDELIDAD:
• Seguí el SPEC textual (módulos, orden y bounding boxes) con tolerancia ≤ 2 cm.
• No agregues ni quites módulos. No conviertas puertas↔cajones.
• No dibujes textos o etiquetas en el resultado.
• Vista frontal tipo elevación, fondo/piso neutros, sin personas.
`.trim();

  const guidedPrompt = [sizeHint, strictRules, (prompt || '')].join('\n\n');

  const base64 = inputImageBuffer.toString('base64');
  const resp = await withRetry(() =>
    model.generateContent([
      { text: guidedPrompt },
      { inlineData: { data: base64, mimeType: inputImageMime } },
    ])
  );

  return extractInlinePng(resp);
}

/* ============ GEMINI (texto + N imágenes → img) ============ */
export async function generatePhotoGeminiMultiRaw({
  prompt,
  images = [], // [{ buffer: Buffer, mime: 'image/png' }]
}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('Missing images array');
  }

  const model = genai.getGenerativeModel({
    model: GEMINI_IMAGE_MODEL,
    generationConfig: {
      temperature: 0.15,
      topP: 0.9,
    },
  });

  const parts = [{ text: `${prompt}\n\nNo dibujar textos ni etiquetas en el resultado.` }];
  for (const img of images) {
    if (!img?.buffer) continue;
    const mime = img?.mime || 'image/png';
    parts.push({
      inlineData: { data: img.buffer.toString('base64'), mimeType: mime },
    });
  }

  const resp = await withRetry(() => model.generateContent(parts));
  return extractInlinePng(resp);
}

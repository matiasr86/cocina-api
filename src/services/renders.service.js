// api/src/services/renders.service.js
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ✅ Modelo estable (evitá el deprecated preview)
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

/* ============== retry/backoff para 5xx/429 ============== */
async function withRetry(fn, times = 3) {
  let lastErr;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e?.status || e?.response?.status;
      const isRetryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (isRetryable && i < times - 1) {
        const delay = 500 * (i + 1);
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
  // En GenAI nuevo, la respuesta suele estar en resp.candidates[0].content.parts
  const parts =
    resp?.candidates?.[0]?.content?.parts ||
    resp?.response?.candidates?.[0]?.content?.parts ||
    [];

  const imgPart = parts.find(p => p?.inlineData?.data);
  if (!imgPart) {
    const fr =
      resp?.candidates?.[0]?.finishReason ||
      resp?.response?.candidates?.[0]?.finishReason ||
      'unknown';
    throw new Error(`Gemini did not return an image (finishReason: ${fr})`);
  }
  return Buffer.from(imgPart.inlineData.data, 'base64');
}

export async function generatePhotoGeminiRaw({
  prompt,
  inputImageBuffer,
  inputImageMime = 'image/png',
  size = '1024x1024',
}) {
  if (!inputImageBuffer) throw new Error('Missing input image buffer');

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
    ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: guidedPrompt },
            { inlineData: { data: base64, mimeType: inputImageMime } },
          ],
        },
      ],
      // Si querés mantener el estilo de tu config:
      generationConfig: { temperature: 0.15, topP: 0.9 },
    })
  );

  return extractInlinePng(resp);
}
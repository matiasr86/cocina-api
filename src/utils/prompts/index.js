// api/src/utils/prompts/index.js
import buildImagePromptFromPayloadRecta from './buildImagePrompt.js';
import buildPromptLC from './buildPromptLC.js';

/**
 * Selecciona el builder según el tipo de cocina.
 * - Recta -> usa el builder existente (buildImagePromptFromPayload)
 * - L o C -> usa el builder LC (con reglas de vértices/esquineros)
 */
export function buildPromptForPayload(payload) {
  const kt = String(payload?.kitchenType || 'Recta');
  if (kt === 'L' || kt === 'C') return buildPromptLC(payload);
  return buildImagePromptFromPayloadRecta(payload);
}

export default buildPromptForPayload;

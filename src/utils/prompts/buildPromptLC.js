// api/src/utils/prompts/buildPromptLC.js
import buildImagePromptFromPayloadRecta from './buildImagePrompt.js';

/**
 * Builder para lienzo único en L o C.
 * Reusa el prompt de Recta (que ya lista las BOX, filas, etc.)
 * y le agrega reglas claras de interpretación de VÉRTICES y ESQUINEROS.
 */
export function buildPromptLC(payload) {
  const kt = String(payload?.kitchenType || 'L').toUpperCase(); // 'L' o 'C'
  const base = buildImagePromptFromPayloadRecta(payload);

  const rules = [
    `COCINA EN ${kt} — LIENZO ÚNICO con VÉRTICES`,
    '',
    'INTERPRETACIÓN DEL BOCETO:',
    '• La(s) línea(s) vertical(es) verde(s) son VÉRTICES (quiebre entre paredes).',
    kt === 'L'
      ? '• Habrá 1 vértice; divide tramo IZQUIERDA y tramo DERECHA.'
      : '• Habrá 2 vértices; separan IZQUIERDA, FRENTE y DERECHA.',
    '• Módulo(s) gris(es) contiguo(s) al vértice = ESQUINERO: representa la profundidad/continuidad de la pared adyacente (no es hueco).',
    '',
    'REQUERIMIENTOS PARA EL RESULTADO:',
    '• Render frontal (elevación) de la pared principal.',
    '• Coincidir módulos 1:1 con las BOX declaradas (posiciones y medidas en cm, tolerancia ±2).',
    '• NO dibujar textos ni las líneas verdes/bordes guía en el resultado.',
  ].join('\n');

  // Anteponemos reglas LC al prompt “base” (que ya trae BOX y restricciones).
  return `${rules}\n\n${base}`;
}

export default buildPromptLC;

// Versión fiel + acabados por calidad + ANCLAS DE POSICIÓN (x en cm)
// ❗️Quitada la regla que forzaba la heladera a la derecha.

function num(n, fb = null) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fb;
}

function normalizarFila(m) {
  if (m.row) return String(m.row);
  const h = Number(m.height) || 0;
  if (h >= 130) return 'tall';
  if (h >= 45 && h <= 95) {
    const t = (m.title || '').toLowerCase();
    if (t.includes('al ') || t.includes('alacena')) return 'upper';
    return 'base';
  }
  return 'base';
}

function moduloToEtiqueta(m) {
  const w = m.width != null ? `${Number(m.width)} cm` : '';
  const extra =
    m.subtitle ? ` — ${m.subtitle}` :
    m.sizeLabel ? ` — ${m.sizeLabel}` :
    '';
  return `${m.title || m.type}${w ? ` (${w})` : ''}${extra}`;
}

function ordenarIzqDer(arr = []) {
  return [...arr].sort((a, b) => {
    const ax = Number(a.xCm ?? a.x ?? NaN);
    const bx = Number(b.xCm ?? b.x ?? NaN);
    if (Number.isFinite(ax) && Number.isFinite(bx)) return ax - bx;
    return String(a.title || a.type).localeCompare(String(b.title || b.type));
  });
}

function filaToLinea(mods) {
  return ordenarIzqDer(mods).map(moduloToEtiqueta).join(' | ');
}

// Anclas de posición: x inicial (cm) y ancho (cm) por módulo (izq→der)
function filaToAnchors(mods) {
  const ordered = ordenarIzqDer(mods);
  let cursor = 0;
  const tokens = [];

  for (const m of ordered) {
    const w = Number(m.width) || null;
    let x = Number(m.xCm ?? m.x);
    if (!Number.isFinite(x)) {
      // si no tenemos x, aproximamos con acumulado
      if (Number.isFinite(cursor)) x = cursor;
    }
    if (Number.isFinite(x) && Number.isFinite(w)) {
      tokens.push(`${Math.round(x)}cm: ${m.title || m.type} (${w}cm)`);
      cursor = x + w;
    } else if (Number.isFinite(w)) {
      tokens.push(`${m.title || m.type} (${w}cm)`);
      cursor += w;
    } else {
      tokens.push(`${m.title || m.type}`);
    }
  }
  return tokens.length ? `Anclas (cm, izq→der): ${tokens.join(' · ')}.` : null;
}

function resumenPorFilas(modules = []) {
  const filas = { base: [], upper: [], tall: [] };
  for (const m of modules) filas[normalizarFila(m)].push(m);

  const lineas = [];
  const anchors = [];

  if (filas.base.length)  {
    lineas.push(`Bajo mesada (izq→der): ${filaToLinea(filas.base)}.`);
    const a = filaToAnchors(filas.base); if (a) anchors.push(a);
  }
  if (filas.upper.length) {
    lineas.push(`Alacenas superiores (izq→der): ${filaToLinea(filas.upper)}.`);
    const a = filaToAnchors(filas.upper); if (a) anchors.push(a);
  }
  if (filas.tall.length)  {
    lineas.push(`Columnas/alto (izq→der): ${filaToLinea(filas.tall)}.`);
    const a = filaToAnchors(filas.tall); if (a) anchors.push(a);
  }

  return { lineas, anchors };
}

function pistasPorModulo(modules = [], quality = 'premium') {
  const out = [];
  for (const m of modules) {
    const name = m.title || m.type || 'Módulo';
    const hints = m.aiHints || {};
    const pieces = [];
    if (hints.common) pieces.push(hints.common);
    if (quality === 'started' && hints.started) pieces.push(hints.started);
    if (quality === 'premium' && hints.premium) pieces.push(hints.premium);
    if (quality === 'deluxe' && hints.deluxe) pieces.push(hints.deluxe);
    if (pieces.length) out.push(`• ${name}: ${pieces.join('; ')}`);
  }
  return out;
}

export function buildImagePromptFromPayload(payload) {
  const quality = String(payload?.quality || 'premium');
  const wall = payload?.wall || payload?.activeWall || {};
  const type = String(payload?.kitchenType || 'Recta');

  const modules =
    payload?.modules ||
    payload?.plan?.modules ||
    payload?.breakdown?.instances ||
    [];

  const widthM  = num(wall.width, 4.0);
  const heightM = num(wall.height, 2.6);

  // Acabados por calidad (perfil J/gola y push-open en premium/deluxe)
  const acabados = {
    started: [
      'frentes melamina lisa tono blanco o arena',
      'tiradores rectos simples visibles en base y alacena',
      'mesada laminada color gris claro',
    ],
    premium: [
      'frentes mate lisos (laminado/termolaminado)',
      'bajo mesada: uñero de aluminio tipo “J” o perfil gola horizontal continuo — sin tiradores aplicados',
      'alacenas superiores: apertura push-open — sin tiradores visibles',
      'mesada tipo cuarzo gris claro',
      'herrajes con cierre suave',
    ],
    deluxe: [
      'frentes laqueados satinados o chapa natural',
      'bajo mesada: uñero oculto tipo “J” o gola minimal — sin tiradores visibles',
      'alacenas superiores: push-open — sin tiradores visibles',
      'mesada de cuarzo/piedra con canto fino y zócalo mínimo',
      'alineaciones perfectas y tolerancias mínimas',
    ],
  }[quality];

  const { lineas: plano, anchors } = resumenPorFilas(modules);
  const pistas = pistasPorModulo(modules, quality);

  const lineaCocina =
    type === 'L' ? 'Cocina en L: renderizar la pared principal de frente (no perspectiva de esquina).'
    : type === 'C' ? 'Cocina en C/U: renderizar la pared frontal centrada.'
    : 'Cocina lineal en una pared: vista frontal centrada.';

  const reglas = [
    'REGLAS ESTRICTAS:',
    '• Respetar exactamente el ORDEN y CANTIDADES por fila (izquierda a derecha).',
    '• No agregar, quitar ni sustituir módulos (no convertir puertas↔cajones, ni mover la heladera).',
    '• Alinear todas las alacenas superiores a una línea horizontal limpia y continua.',
    '• El horno queda en el módulo indicado.',
    '• Sin decoraciones (sin personas, cuadros, plantas ni texto).',
    '• Fondo y piso neutros, iluminación LED lineal bajo alacenas.',
  ];
  if (quality === 'premium' || quality === 'deluxe') {
    reglas.push('• En BAJO MESADA usar uñero/perfil gola (sin tiradores aplicados).');
    reglas.push('• En ALACENAS SUPERIORES usar push-open (sin tiradores visibles).');
  }

  const prompt = [
    lineaCocina,
    `Dimensiones de pared aproximadas (proporción): ${widthM?.toFixed?.(2) || widthM} m de ancho × ${heightM?.toFixed?.(2) || heightM} m de alto.`,
    `Estilo y acabados (${quality}): ${acabados.join('; ')}.`,
    'Composición EXACTA del frente (usa este orden literal):',
    ...plano.map(s => `- ${s}`),
    ...(anchors.length ? ['Referencias de posición en cm desde el borde izquierdo:', ...anchors.map(a => `- ${a}`)] : []),
    ...(pistas.length ? ['Pistas por módulo:', ...pistas] : []),
    ...reglas,
    'Cámara: elevación/frontal, altura de ojos, lente “normal” (~50 mm), mínima distorsión.',
    'Iluminación: ambiente suave + LED continuo bajo alacenas; sin viñeteo fuerte.',
  ].join('\n');

  return prompt;
}

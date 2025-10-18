// src/utils/buildImagePrompt.js
// Prompt con PUENTE ESTRICTO reforzado + BRIDGE_SPAN:
// - Si payload.bridgeStrict === true:
//   • TODAS las alacenas superiores se interpretan/renderizan como PUENTE profundo
//   • co-planar con columnas y bajo mesada (front_plane = flush-with-bases, depth ≈ 58–60 cm)
//   • banda puente continua (x_min→x_max) con constraint geométrica y tolerancia ≤ 1 cm

function n(v, fb = 0) { const x = Number(v); return Number.isFinite(x) ? x : fb; }
const readX = (m) => n(m.x_cm ?? m.xCm ?? m.x, 0);
const readY = (m) => n(m.y_cm ?? m.yCm ?? m.y, 0);
const readW = (m) => n(m.width_cm ?? m.width, 0);
const readH = (m) => n(m.height_cm ?? m.height, 0);

function filaDe(m) {
  if (m.row) return String(m.row);
  const h = readH(m);
  if (h >= 130) return 'tall';
  if (h >= 45 && h <= 95) return 'base';
  return 'upper';
}
function byX(a, b) {
  const ax = readX(a), bx = readX(b);
  if (ax !== bx) return ax - bx;
  return String(a.aiTag || a.title || a.type).localeCompare(String(b.aiTag || b.title || b.type));
}

function shapeLabel(ai = {}, fallback = '') {
  const s = String(ai?.shape || '');
  const doors = n(ai?.doors, 0), drawers = n(ai?.drawers, 0), open = !!ai?.open;
  if (s === 'linear-skirting') return 'BANQUINA/ZÓCALO lineal';
  if (s === 'base-doors') return `BAJO MESADA de ${doors || 1} puerta(s)`;
  if (s === 'base-drawers') return `BAJO MESADA CAJONERO de ${drawers || 2} cajón(es)`;
  if (s === 'base-open' || (s.startsWith('base') && open)) return 'BAJO MESADA ABIERTO';
  if (s === 'base-corner') return 'BAJO MESADA ESQUINERO';
  if (s === 'upper-doors') return `ALACENA de ${doors || 1} puerta(s)`;
  if (s === 'upper-open'  || (s.startsWith('upper') && open)) return 'ALACENA ABIERTA';
  if (s === 'upper-horizontal') return 'ALACENA HORIZONTAL (flap)';
  if (s === 'upper-extractor')  return 'ALACENA con extractor';
  if (s.startsWith('upper-bridge')) return 'ALACENA PUENTE';
  if (s === 'tall-column') return 'COLUMNA/ALTO';
  if (s.startsWith('appliance-')) return 'ELECTRODOMÉSTICO';
  return fallback || 'MÓDULO';
}

function acabadosPorCalidad(q) {
  if (q === 'started') return [
    'frentes melamina clara', 'tiradores de barra visibles',
    'mesada laminada gris claro', 'render fotográfico, no boceto'
  ];
  if (q === 'deluxe')  return [
    'frentes laqueados o chapa natural', 'sin tiradores visibles',
    'mesada de cuarzo/piedra canto fino', 'iluminación física realista'
  ];
  return [
    'frentes mate', 'sin tiradores visibles (gola J en base; push-open en alacenas)',
    'herrajes cierre suave', 'mesada tipo cuarzo gris claro', 'render fotográfico, no boceto'
  ];
}

function resumenInventario(mods) {
  const out = { total: mods.length, base:0, upper:0, tall:0, abiertos:0, cajoneros:0, puertas:0, lineales:0, electro:0 };
  for (const m of mods) {
    const row = m.row || filaDe(m); out[row] = (out[row] || 0) + 1;
    const ai = m.ai || {}; const s = String(ai.shape || '');
    if (ai.open) out.abiertos++;
    if (n(ai.drawers,0) > 0) out.cajoneros++;
    if (n(ai.doors,0)   > 0) out.puertas += n(ai.doors,0);
    if (s === 'linear-skirting') out.lineales++;
    if (s.startsWith('appliance-')) out.electro++;
  }
  return out;
}

/* Heurísticas */
function looksBridge(m) {
  const ai  = m.ai || {};
  const s   = String(ai.shape || '');
  const t   = String(m.type   || '').toUpperCase();
  const tag = String(m.aiTag  || '').toUpperCase();
  return !!(
    ai.bridge === true ||
    s.startsWith('upper-bridge') ||
    t.includes('ALA60') || t.includes('ALAH60') || t.includes('EXTRA60') ||
    tag.startsWith('AP-')
  );
}
function looksShallow35(m) {
  if ((m.row || filaDe(m)) !== 'upper') return false;
  if (looksBridge(m)) return false;
  const t   = String(m.type  || '').toUpperCase();
  const tag = String(m.aiTag || '').toUpperCase();
  const s   = String(m.ai?.shape || '');
  return (
    t.includes('ALA35') || t.includes('ALAH35') || tag.startsWith('AL-') ||
    s === 'upper-doors' || s === 'upper-horizontal' || s === 'upper-open'
  );
}
function isFridge(m) {
  const t = String(m.type  || '').toUpperCase();
  const g = String(m.aiTag || '').toUpperCase();
  const s = String(m.ai?.shape || '');
  return t.includes('FRIDGE') || g.includes('FRIDGE') || s.startsWith('appliance-fridge');
}
function allowsOverFridge(m) {
  const txt = (m.title || m.type || m.aiTag || '').toString().toLowerCase();
  return /sobre.?heladera|over.?fridge|overhead.?fridge/.test(txt);
}
function rangesFrom(boxes) {
  if (!boxes.length) return [];
  const sorted = [...boxes].sort((a,b) => n(a.x) - n(b.x));
  const out = [];
  let cur = { min: sorted[0].x, max: sorted[0].x + sorted[0].w };
  for (let i = 1; i < sorted.length; i++) {
    const { x, w } = sorted[i];
    if (x <= cur.max + 1) cur.max = Math.max(cur.max, x + w);
    else { out.push(cur); cur = { min: x, max: x + w }; }
  }
  out.push(cur);
  return out;
}

export function buildImagePromptFromPayload(payload) {
  const quality      = String(payload?.quality || 'premium');
  const wall         = payload?.wall || payload?.activeWall || {};
  const type         = String(payload?.kitchenType || 'Recta');
  const bridgeStrict = payload?.bridgeStrict === true;
  const userText     = (payload?.userText || '').trim();

  const modules  = Array.isArray(payload?.modules) ? payload.modules : [];
  const widthM   = n(wall.width ?? wall.width_m, 4.0);
  const heightM  = n(wall.height ?? wall.height_m, 2.6);
  const ordered  = [...modules].sort(byX);

  const hasUpper = ordered.some(m => (m.row || filaDe(m)) === 'upper');
  const hasTall  = ordered.some(m => (m.row || filaDe(m)) === 'tall');

  const allowedTags = ordered.map((m,i)=>String(m.aiTag || m.type || m.title || `M${i+1}`).toUpperCase());
  const forbiddenShapes = [
    bridgeStrict ? ['upper-doors','upper-open','upper-horizontal','upper-extractor'] : [],
    !hasUpper && ['upper-doors','upper-open','upper-horizontal','upper-extractor','upper-bridge'],
    !hasTall  && ['tall-column'],
    ['shelf','floating-shelf','rail','pegboard','panel','island','peninsula','table','chair']
  ].flat().filter(Boolean);

  // Forzar PUENTE en todos los upper cuando bridgeStrict
  const parts = ordered.map((m, i) => {
    const tag  = String(m.aiTag || m.type || m.title || `M${i+1}`).toUpperCase();
    const ai   = m.ai || {};
    const row  = m.row || filaDe(m);
    const x    = readX(m), y = readY(m), w = readW(m), h = readH(m);

    const bridgeForced = bridgeStrict && row === 'upper';
    const bridge    = bridgeForced || looksBridge(m);
    const shallow35 = !bridge && looksShallow35(m);

    const part = {
      tag, row,
      shape: (bridgeForced ? 'upper-bridge' : (ai.shape || 'n/a')),
      doors: n(ai.doors, 0), drawers: n(ai.drawers, 0), open: !!ai.open,
      orientation: ai.orientation || null, hinge: ai.hinge || null,
      bridge,
      depthHint: bridge ? 'deep-60' : (shallow35 ? 'shallow-35' : null),
      front_plane: bridgeForced ? 'flush-with-bases' : (ai.front_plane || null),
      depth_override_cm: bridgeForced ? 60 : (ai.depth_cm ?? null),
      box: { x, y, w, h, unit: 'cm', origin: 'floor-left' }
    };
    const human = shapeLabel({ ...ai, shape: part.shape }, m.title || m.type);
    return { part, human };
  });

  // BANDA PUENTE CONTINUA + constraint cuando es estricto
  const uppers = parts.filter(p => p.part.row === 'upper');
  let bridgeTxt;
  let constraints = [];
  if (bridgeStrict && uppers.length) {
    const minX = Math.min(...uppers.map(p => p.part.box.x));
    const maxX = Math.max(...uppers.map(p => p.part.box.x + p.part.box.w));
    const tagsUpper = uppers.map(p => p.part.tag);

    constraints.push({
      kind: 'BRIDGE_SPAN',
      x_min_cm: minX,
      x_max_cm: maxX,
      must_be_flush_with: 'FRONT_PLANE_OF_BASES_AND_COLUMNS',
      depth_target_cm: 60,
      coplanarity_tolerance_cm: 1,
      apply_to_tags: tagsUpper
    });

    bridgeTxt =
      `• MODO PUENTE ESTRICTO — BANDA CONTINUA ${minX}–${maxX} cm: ` +
      `todas las alacenas superiores coplanares con columnas y bajo mesada (profundidad 58–60 cm, offset 0 cm).`;
  } else {
    const bridgeBoxes  = parts.filter(p => p.part.bridge || p.part.depthHint === 'deep-60').map(p => ({ x:p.part.box.x, w:p.part.box.w }));
    const bridgeRanges = rangesFrom(bridgeBoxes);
    bridgeTxt = bridgeRanges.length
      ? bridgeRanges.map(r => `• BANDA PUENTE — prof. 58–60 cm, FLUSH con columnas/bajo mesada — entre ${r.min}–${r.max} cm.`).join('\n')
      : '• Sin banda puente profunda declarada.';
  }

  const shallowTxt = bridgeStrict
    ? '• PROHIBIDAS bandas 35–40 cm (ninguna alacena superior retraída).'
    : '• Si existen alacenas 35 cm: RETRAER 20–25 cm respecto del plano frontal.';

  const inv = resumenInventario(ordered);
  const acabados = acabadosPorCalidad(quality);

  const hasFridge = ordered.some(isFridge);
  const overFridgeAllowed = ordered.some(allowsOverFridge);
  const reglaSobreHeladera =
    hasFridge && !overFridgeAllowed
      ? '• PROHIBIDO dibujar “módulo sobre-heladera”. Zona sobre la heladera = pared vista.'
      : null;

  const lineaCocina =
    type === 'L' ? 'Cocina en L: renderizar SOLO la pared principal (vista frontal).'
  : type === 'C' ? 'Cocina en C/U: renderizar la pared frontal centrada.'
  : 'Cocina lineal (una pared): vista frontal.';

  const inventarioGlobal = [
    'INVENTARIO (debe coincidir EXACTAMENTE):',
    `• Módulos totales: ${inv.total}`,
    `• Bajo mesada: ${inv.base}`,
    `• Alacenas: ${inv.upper}`,
    `• Columnas/altos: ${inv.tall}`,
    `• Lineales (zócalo/banquina): ${inv.lineales}`,
    `• Electrodomésticos: ${inv.electro}`,
    `• Nº total de puertas: ${inv.puertas}`,
    `• Módulos abiertos: ${inv.abiertos}`,
    'Si el conteo visual no coincide, el resultado es inválido.',
  ].join('\n');

  const planoFrontal = bridgeStrict ? [
    'TESTS GEOMÉTRICOS (OBLIGATORIOS):',
    '• Definir PLANO_FRONTAL usando la cara de frentes de columnas y bajo mesada.',
    '• TODAS las alacenas superiores deben tener su cara frontal EXACTAMENTE sobre PLANO_FRONTAL.',
    '• Tolerancia ≤ 1 cm. Cualquier escalón o sombra de retracción bajo el puente = resultado INVÁLIDO.',
    '• Sombra permitida sólo en la pared del nicho (no bajo el plano de puertas).',
  ].join('\n') : null;

  const permisos = [
    'CONTROL DE CONJUNTO:',
    `• TAGS PERMITIDOS: ${allowedTags.join(', ') || '—'}.`,
    `• SHAPES PROHIBIDOS: ${forbiddenShapes.join(', ')}.`,
    bridgeStrict ? '• Interpretar TODA alacena superior como “upper-bridge” (prof. ≈58–60 cm). Ninguna 35–40 cm.' : null,
    !hasTall  ? '• NO hay columnas altas declaradas: no dibujar columnas adicionales.' : null,
  ].filter(Boolean).join('\n');

  const reglasProfundidad = [
    'REGLAS DE PROFUNDIDAD (CRÍTICAS):',
    bridgeTxt,
    shallowTxt,
    '• Las zonas PUENTE son CO-PLANARES con columnas/bajo mesada; diferencia ≤ 1 cm.',
    '• Alinear todas las alacenas a la misma altura superior.',
  ].join('\n');

  const reglasDuras = [
    'REGLAS DE BLOQUEO ABSOLUTO:',
    '• Usar la imagen aportada como FUENTE POSICIONAL. Los BOX son inmutables (esquina inferior izquierda, unidades cm). Tolerancia ±2 cm.',
    '• Renderizar EXCLUSIVAMENTE los módulos listados; PROHIBIDO inventar/quitar.',
    '• Respetar la forma declarada (doors/drawers/open). No convertir puertas↔cajones.',
    '• La mesada sólo sobre los módulos de base.',
    '• No escribir texto ni overlays. Sin líneas/contornos (incluye cian/teal).',
    '• Cámara frontal ~50 mm. Iluminación física realista. Fondo y piso neutros.',
  ].join('\n');

  const constraintLines = constraints.length
    ? ['CONSTRAINTS:', ...constraints.map(c => `CONSTRAINT ${JSON.stringify(c)}`)].join('\n')
    : null;

  const prompt = [
    lineaCocina,
    `Dimensiones pared: ${widthM.toFixed(2)} m × ${heightM.toFixed(2)} m.`,
    `Acabados (${quality}): ${acabados.join('; ')}.`,
    userText ? `Preferencias del usuario (colores/acabados): ${userText}` : null,
    inventarioGlobal,
    permisos,
    planoFrontal,
    reglasProfundidad,
    reglaSobreHeladera,
    constraintLines,
    'LISTA POSICIONAL (izquierda→derecha). Cada línea es un bounding box inmutable (incluye overrides de profundidad cuando aplica):',
    ...parts.map(({ part, human }) => `BOX ${JSON.stringify(part)}  // ${human}`),
    reglasDuras
  ].filter(Boolean).join('\n');

  return prompt;
}

export default buildImagePromptFromPayload;

// src/utils/buildImagePrompt.js
function n(v, fb = 0) { const x = Number(v); return Number.isFinite(x) ? x : fb; }
function filaDe(m) {
  if (m.row) return String(m.row);
  const h = n(m.height);
  if (h >= 130) return 'tall';
  if (h >= 45 && h <= 95) return 'base';
  return 'upper';
}
function byX(a, b) {
  const ax = n(a.xCm ?? a.x); const bx = n(b.xCm ?? b.x);
  if (ax !== bx) return ax - bx;
  return String(a.aiTag || a.title || a.type).localeCompare(String(b.aiTag || b.title || b.type));
}
function shapeLabel(ai = {}, fallback = '') {
  const s = String(ai?.shape || ''); const doors = n(ai?.doors, 0); const drawers = n(ai?.drawers, 0); const open = !!ai?.open;
  if (s === 'linear-skirting') return 'BANQUINA/ZÓCALO lineal';
  if (s === 'base-doors') return `BAJO MESADA de ${doors || 1} puerta(s)`;
  if (s === 'base-drawers') return `BAJO MESADA CAJONERO de ${drawers || 2} cajón(es)`;
  if (s === 'base-open' || (s.startsWith('base') && open)) return 'BAJO MESADA ABIERTO (sin puertas)';
  if (s === 'base-corner') return 'BAJO MESADA ESQUINERO';
  if (s === 'upper-doors') return `ALACENA de ${doors || 1} puerta(s)`;
  if (s === 'upper-open'  || (s.startsWith('upper') && open)) return 'ALACENA ABIERTA';
  if (s === 'upper-horizontal') return 'ALACENA de puerta(s) HORIZONTALES';
  if (s === 'upper-extractor') return 'ALACENA con extractor integrado';
  if (s === 'upper-bridge') return 'ALACENA PUENTE';
  if (s === 'tall-column') return 'COLUMNA/ALTO';
  if (s === 'appliance-fridge') return 'HELADERA independiente';
  if (s === 'appliance-range-free-standing') return 'COCINA/HORNO FREE-STANDING';
  if (s === 'appliance-oven-built-in') return 'HORNO EMPOTRADO';
  return fallback || 'MÓDULO';
}
function acabadosPorCalidad(q) {
  if (q === 'started') return ['frentes melamina clara','tiradores de barra visibles','mesada laminada gris claro'];
  if (q === 'deluxe')  return ['frentes laqueados o chapa natural','sin tiradores visibles','mesada de cuarzo/piedra canto fino'];
  return ['frentes mate','sin tiradores visibles (gola J en bajo mesada; push-open en alacenas)','herrajes con cierre suave','mesada tipo cuarzo gris claro'];
}
function resumenInventario(mods) {
  const out = { total: mods.length, base:0, upper:0, tall:0, abiertos:0, cajoneros:0, puertas:0, lineales:0, electro:0 };
  for (const m of mods) {
    const row = m.row || filaDe(m); out[row] = (out[row] || 0) + 1;
    const ai = m.ai || {}; const s = String(ai.shape || '');
    if (ai.open) out.abiertos++; if (n(ai.drawers,0) > 0) out.cajoneros++; if (n(ai.doors,0) > 0) out.puertas += n(ai.doors,0);
    if (s === 'linear-skirting') out.lineales++; if (s.startsWith('appliance-')) out.electro++;
  }
  return out;
}

export function buildImagePromptFromPayload(payload) {
  const quality = String(payload?.quality || 'premium');
  const wall    = payload?.wall || payload?.activeWall || {};
  const type    = String(payload?.kitchenType || 'Recta');

  const modules = Array.isArray(payload?.modules) ? payload.modules : [];
  const widthM  = n(wall.width, 4.0);
  const heightM = n(wall.height, 2.6);

  const ordered = [...modules].sort(byX);

  // === Permisos / prohibiciones dinámicas ===
  const allowedTags = ordered.map((m,i)=>String(m.aiTag || m.type || m.title || `M${i+1}`).toUpperCase());
  const usedShapes  = Array.from(new Set(ordered.map(m => String(m.ai?.shape || '').trim()).filter(Boolean)));
  const hasBase  = ordered.some(m => (m.row || filaDe(m)) === 'base');
  const hasUpper = ordered.some(m => (m.row || filaDe(m)) === 'upper');
  const hasTall  = ordered.some(m => (m.row || filaDe(m)) === 'tall');

  const forbiddenShapes = [
    !hasUpper && ['upper-doors','upper-open','upper-horizontal','upper-extractor','upper-bridge'],
    !hasTall  && ['tall-column'],
    // nada “decorativo”
    ['shelf','floating-shelf','rail','pegboard','panel','island','peninsula','table','chair']
  ].flat().filter(Boolean);

  // Bounding boxes declarativas (origen piso-izquierda)
  const posLines = ordered.map((m, i) => {
    const tag  = String(m.aiTag || m.type || m.title || `M${i+1}`).toUpperCase();
    const ai   = m.ai || {};
    const row  = m.row || filaDe(m);
    const x    = n(m.xCm ?? m.x);
    const y    = n(m.yCm ?? m.y);
    const w    = n(m.width);
    const h    = n(m.height);
    const part = {
      tag, row, shape: ai.shape || 'n/a',
      doors: n(ai.doors, 0), drawers: n(ai.drawers, 0), open: !!ai.open,
      orientation: ai.orientation || null, hinge: ai.hinge || null,
      box: { x, y, w, h, unit: 'cm', origin: 'floor-left' }
    };
    const human = shapeLabel(ai, m.title || m.type);
    return `BOX ${JSON.stringify(part)}  // ${human}`;
  });

  const inv = resumenInventario(ordered);
  const acabados = acabadosPorCalidad(quality);

  const lineaCocina =
    type === 'L' ? 'Cocina en L: renderizar SOLO la pared principal (vista frontal).'
  : type === 'C' ? 'Cocina en C/U: renderizar la pared frontal centrada.'
  : 'Cocina lineal (una pared): vista frontal.';

  const reglasDuras = [
    'REGLAS DE BLOQUEO ABSOLUTO:',
    '• Renderizar EXCLUSIVAMENTE los módulos listados. Coincidencia 1:1 por cantidad y TAG. PROHIBIDO inventar.',
    '• Cada área FUERA DE TODA BOX debe quedar como PARED LISA sin muebles ni estantes.',
    '• Mantener posiciones y tamaños EXACTOS según {box:{x,y,w,h}} (cm, origen floor-left). Tolerancia ±2 cm.',
    '• Respetar la forma declarada (doors/drawers/open). No convertir puertas↔cajones ni empotrar aparatos free-standing.',
    '• La mesada sólo sobre los módulos de base. No generar alacenas si no existen BOX de fila upper.',
    '• Ignorar textos del boceto. No imprimir textos en el resultado.',
    '• Fondo y piso neutros. Cámara: elevación frontal.',
  ].join('\n');

  const permisos = [
    'CONTROL DE CONJUNTO:',
    `• TAGS PERMITIDOS (únicos válidos): ${allowedTags.join(', ') || '—'}.`,
    `• SHAPES USADOS (permitidos): ${usedShapes.join(', ') || '—'}.`,
    `• SHAPES PROHIBIDOS: ${forbiddenShapes.join(', ')}.`,
    !hasUpper ? '• NO HAY ALACENAS: la pared superior debe quedar vacía.' : null,
    !hasTall  ? '• NO HAY COLUMNAS ALTAS: no dibujar columnas/torres.' : null,
  ].filter(Boolean).join('\n');

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

  const prompt = [
    lineaCocina,
    `Dimensiones pared: ${widthM.toFixed(2)} m × ${heightM.toFixed(2)} m.`,
    `Acabados (${quality}): ${acabados.join('; ')}.`,
    inventarioGlobal,
    permisos,
    'LISTA POSICIONAL (izquierda→derecha). Cada línea es un bounding box inmutable:',
    ...posLines,
    reglasDuras,
  ].join('\n');

  return prompt;
}

export default buildImagePromptFromPayload;

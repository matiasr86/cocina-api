export function sanitizeSizes(input) {
  const arr = Array.isArray(input) ? input : [];

  const cleaned = arr
    .map((s) => ({
      width:      Number(s.width)  || 0,
      height:     Number(s.height) || 0,
      isStandard: !!s.isStandard,
      deltaPct:   (s.deltaPct === 0 || s.deltaPct)
        ? Number(s.deltaPct)
        : 0,
    }))
    .filter((s) => s.width > 0 && s.height > 0);

  if (cleaned.length === 0) return [];

  // Asegurar UNA sola estándar
  let idx = cleaned.findIndex((s) => s.isStandard);
  if (idx === -1) idx = 0;
  cleaned.forEach((s, i) => { s.isStandard = i === idx; });

  return cleaned;
}

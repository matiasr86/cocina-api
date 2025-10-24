// api/src/middlewares/rateLimit.js
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';


/**
 * Handler común en JSON (429)
 */
function json429(messageObj) {
  return (req, res /*, next */) => {
    res.status(429).json(messageObj);
  };
}

/**
 * Global: límites suaves para cualquier endpoint bajo /api
 * (evita flooding accidental; no bloquea el uso normal)
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,                           // 15 min
  max: Number(process.env.RL_GLOBAL_MAX || 400),      // por IP
  standardHeaders: true,                              // RateLimit-* headers
  legacyHeaders: false,
  handler: json429({ error: 'rate_limited', message: 'Demasiadas solicitudes, probá más tarde.' }),
});

/**
 * Canje de códigos: 3 intentos por usuario / 10 min
 * + tope por IP para evitar abuso con cuentas múltiples desde la misma IP.
 */
export const redeemLimiterByUser = rateLimit({
  windowMs: 10 * 60 * 1000,                           // 10 min
  max: Number(process.env.RL_REDEEM_MAX_PER10M || 3),
  keyGenerator: (req, res) => {
    if (req.user?.uid) return `uid:${req.user.uid}`;
    return ipKeyGenerator(req); // ✅ NUNCA req.ip directo
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: process.env.RL_TRUST_PROXY === '1' }, // opcional pero recomendado

  handler: json429({
    ok: false,
    error: 'too_many_attempts',
    message: 'Demasiados intentos de canje. Probá nuevamente en unos minutos.',
  }),
});

export const redeemLimiterByIp = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RL_REDEEM_IP_MAX_PER10M || 10),
  keyGenerator: (req, res) => {
    if (req.user?.uid) return `uid:${req.user.uid}`;
    return ipKeyGenerator(req); // ✅ NUNCA req.ip directo
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: process.env.RL_TRUST_PROXY === '1' }, // opcional pero recomendado
  handler: json429({
    ok: false,
    error: 'too_many_attempts_ip',
    message: 'Demasiados intentos desde esta IP. Intentá más tarde.',
  }),
});

/**
 * Render (opcional pero recomendado): limita ráfagas
 * Aun con créditos, evita spam de llamadas back-to-back.
 */
export const renderLimiterByUser = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.RL_RENDER_MAX_PER10M || 5),
  keyGenerator: (req, res) => {
    if (req.user?.uid) return `uid:${req.user.uid}`;
    return ipKeyGenerator(req); // ✅ NUNCA req.ip directo
    },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: process.env.RL_TRUST_PROXY === '1' }, // opcional pero recomendado
  handler: json429({
    ok: false,
    error: 'too_many_renders',
    message: 'Demasiadas solicitudes de render seguidas. Esperá unos minutos.',
  }),
});

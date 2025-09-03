// src/middlewares/auth.js
import { firebaseAdmin } from '../utils/firebaseAdmin.js';

export async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const m = hdr.match(/^Bearer (.+)$/i);
    if (!m) return res.status(401).json({ error: 'Missing Bearer token' });

    req.user = await firebaseAdmin.auth().verifyIdToken(m[1]);
    return next();
  } catch (err) {
    console.warn('[auth] verifyIdToken error:', err);
    return res.status(401).json({
      error: 'Invalid token',
      code: err?.code || null,
      message: err?.message || String(err),
      // tip: en prod podés quitar estos campos si no querés tanto detalle
    });
  }
}

export function requireAdmin(req, res, next) {
  const allowed = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const email = (req.user?.email || '').toLowerCase();
  if (allowed && email === allowed) return next();
  return res.status(403).json({ error: 'Forbidden (admin required)' });
}

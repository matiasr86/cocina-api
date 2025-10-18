// api/src/controllers/credits.controller.js
import {
  ensureUserAndWelcome, redeemCodeForUser,
} from '../services/credits.service.js';

function setNoCache(res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
}

export async function getMyCredits(req, res) {
  try {
    const email = (req.user?.email || '').toLowerCase().trim();
    const uid   = req.user?.uid || req.user?.user_id || null;
    if (!email) {
      setNoCache(res);
      return res.status(400).json({ error: 'missing_email' });
    }

    const signInProvider =
      req.user?.firebase?.sign_in_provider ||
      req.user?.signInProvider ||
      null;

    const user = await ensureUserAndWelcome({ uid, email, signInProvider });

    setNoCache(res);
    return res.json({
      total: Number(user?.credits || 0),
      cooldownUntil: user?.cooldownUntil || null,
      inflight: !!user?.inflightRender,
    });
  } catch (err) {
    console.error('[getMyCredits] error:', err);
    setNoCache(res);
    return res.status(500).json({ error: 'internal_error', message: String(err?.message || err) });
  }
}

export async function redeemCode(req, res) {
  try {
    const email = (req.user?.email || '').toLowerCase().trim();
    const uid   = req.user?.uid || req.user?.user_id || null;
    if (!email) {
      setNoCache(res);
      return res.status(400).json({ ok: false, error: 'missing_email', message: 'Tu sesión no tiene e-mail. Volvé a iniciar sesión.' });
    }
    const code = (req.body?.code || '').trim();

    const out = await redeemCodeForUser({ email, uid, code });

    setNoCache(res);
    if (!out.ok) return res.status(out.status || 400).json(out);
    return res.json(out);
  } catch (err) {
    console.error('[redeemCode] error:', err);
    setNoCache(res);
    return res.status(500).json({ ok: false, error: 'redeem_failed', message: String(err?.message || err) });
  }
}


export default { getMyCredits, redeemCode };

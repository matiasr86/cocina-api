import fetch from 'node-fetch';

export function verifyCaptcha(expectedAction = 'fabricator_register') {
  return async (req, res, next) => {
    try {
      const provider = (process.env.RECAPTCHA_PROVIDER || 'google_v3').toLowerCase();
      const secret   = process.env.RECAPTCHA_SECRET;
      if (!secret) {
        return res.status(500).json({ ok:false, error:'captcha_not_configured' });
      }

      // v3: esperamos req.body.captchaToken
      // v2: algunos fronts envían 'g-recaptcha-response'
      const token = req.body?.captchaToken || req.body?.['g-recaptcha-response'];
      if (!token) {
        return res.status(400).json({ ok:false, error:'captcha_missing' });
      }

      const params = new URLSearchParams();
      params.set('secret',   secret);
      params.set('response', token);
      // útil si confiás en X-Forwarded-For:
      if (req.ip) params.set('remoteip', req.ip);

      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        timeout: 3000,
      });
      const data = await resp.json().catch(() => null);

      if (!data?.success) {
        return res.status(400).json({ ok:false, error:'captcha_invalid', detail: data?.['error-codes'] || null });
      }

      // Validaciones extra para v3
      if (provider === 'google_v3') {
        const min = Number(process.env.RECAPTCHA_SCORE_MIN ?? 0.5);

        // Validar acción (si tu front la fija)
        if (expectedAction && data?.action && data.action !== expectedAction) {
          return res.status(400).json({ ok:false, error:'captcha_bad_action', action: data?.action });
        }
        // Validar hostname (opcional)
        if (process.env.RECAPTCHA_HOST && data?.hostname && data.hostname !== process.env.RECAPTCHA_HOST) {
          return res.status(400).json({ ok:false, error:'captcha_bad_host', hostname: data?.hostname });
        }
        // Validar score
        if (typeof data?.score === 'number' && data.score < min) {
          return res.status(400).json({ ok:false, error:'captcha_low_score', score: data.score });
        }
      }

      return next();
    } catch (e) {
      return res.status(400).json({ ok:false, error:'captcha_check_failed' });
    }
  };
}

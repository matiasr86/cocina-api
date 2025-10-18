// api/src/services/credits.service.js
import fetch from 'node-fetch';
import User from '../db/models/User.js';
import Transaction from '../db/models/Transaction.js';
import RedeemedCode from '../db/models/RedeemedCode.js';

/* ==============================
   Odoo JSON-RPC helpers (password o API Key como password)
   ============================== */

const ODOO_URL = process.env.ODOO_URL;      
const ODOO_DB  = process.env.ODOO_DB;        
// Soportar ambos nombres para el user:
const ODOO_LOGIN = (process.env.ODOO_LOGIN || '').trim();
// Preferir password real; si no hay, usar API KEY como password (fallback)
const ODOO_PASSWORD = (process.env.ODOO_PASSWORD || process.env.ODOO_API_KEY || '').trim();

if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_PASSWORD) {
  console.warn('[odoo] faltan variables: ODOO_URL / ODOO_DB / ODOO_LOGIN (o ODOO_USER) / ODOO_PASSWORD (o ODOO_API_KEY)');
}

let _odooSession = null; // { session_id, when }
const _SESSION_TTL_MS = 15 * 60 * 1000;

/** Autenticación: captura session_id desde Set-Cookie (node-fetch v3 usa headers.raw()) */
async function odooAuth() {
  const now = Date.now();
  if (_odooSession && (now - _odooSession.when) < _SESSION_TTL_MS) {
    return _odooSession.session_id;
  }

  const url = `${ODOO_URL}/web/session/authenticate`;
  const body = {
    jsonrpc: '2.0',
    method:  'call', // ← importante para muchas instalaciones
    params: { db: ODOO_DB, login: ODOO_LOGIN, password: ODOO_PASSWORD },
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });

  // Intentamos leer el JSON para diagnosticar si hay error lógico
  let js = null;
  const rawText = await r.text();
  try { js = JSON.parse(rawText); } catch {}

  // Captura robusta del Set-Cookie
  let sessionId = null;
  try {
    const raw = r.headers?.raw?.() || {};
    const setCookies = raw['set-cookie'] || [];
    for (const c of setCookies) {
      const m = /session_id=([^;]+)/i.exec(c);
      if (m) { sessionId = m[1]; break; }
    }
    // Fallback (algunos runtimes soportan get('set-cookie') en singular)
    if (!sessionId) {
      const single = r.headers.get('set-cookie');
      const m2 = single && /session_id=([^;]+)/i.exec(single);
      if (m2) sessionId = m2[1];
    }
  } catch {}

  if (!sessionId) {
    console.warn('[odooAuth] No llegó session_id en Set-Cookie');
    console.warn('[odooAuth] status:', r.status);
    if (js) console.warn('[odooAuth] json:', js);
    else console.warn('[odooAuth] raw:', rawText?.slice?.(0, 500));

    // Si hay error JSON-RPC, mostrarlo claro
    const jserr = js?.error?.message || js?.error?.data?.message;
    if (jserr) throw new Error(`Odoo auth error: ${jserr}`);
    if (!r.ok) throw new Error(`Odoo auth HTTP ${r.status}`);
    throw new Error('No se pudo obtener session_id de Odoo');
  }

  _odooSession = { session_id: sessionId, when: now };
  return sessionId;
}

async function odooCallKw(model, method, args = [], kwargs = {}) {
  const call = async (sid) => {
    const url = `${ODOO_URL}/web/dataset/call_kw`;
    const body = {
      jsonrpc: '2.0',
      method:  'call', // ← importante
      params: { model, method, args, kwargs },
    };

    const rr = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': `session_id=${sid}`,
      },
      body: JSON.stringify(body),
    });

    const txt = await rr.text();
    let js = null;
    try { js = JSON.parse(txt); } catch {}

    if (!rr.ok) {
      const msg = js?.error?.message || `HTTP ${rr.status}`;
      throw new Error(`Odoo call_kw: ${msg}`);
    }
    if (js?.error) {
      const msg = js.error?.message || 'RPC error';
      throw new Error(`Odoo call_kw: ${msg}`);
    }
    return js?.result;
  };

  let sid = await odooAuth();
  try {
    return await call(sid);
  } catch (e) {
    // Si la sesión caducó o se invalidó, reautenticar una vez
    _odooSession = null;
    sid = await odooAuth();
    return await call(sid);
  }
}

async function odooSearchRead(model, domain = [], fields = [], kwargs = {}) {
  return odooCallKw(model, 'search_read', [domain, fields], kwargs);
}
async function odooWrite(model, ids = [], values = {}) {
  return odooCallKw(model, 'write', [ids, values], {});
}

/* ==============================
   Users / Credits base
   ============================== */

export async function ensureUserAndWelcome({ uid, email, signInProvider }) {
  const emailKey = (email || '').toLowerCase().trim();
  if (!emailKey) throw new Error('missing_email');

  let user;
  try {
    user = await User.findOneAndUpdate(
      { email: emailKey },
      {
        $setOnInsert: {
          credits: 0,
          welcomeCreditGranted: false,
          inflightRender: false,
          inflightLockUntil: null,
          cooldownUntil: null,
          createdAt: new Date(),
        },
        $set: { uid, lastUid: uid, updatedAt: new Date() },
      },
      { new: true, upsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) user = await User.findOne({ email: emailKey });
    else throw err;
  }

  const isGoogle = String(signInProvider || '').toLowerCase() === 'google.com';
  if (isGoogle && !user.welcomeCreditGranted) {
    const updated = await User.findOneAndUpdate(
      { _id: user._id, welcomeCreditGranted: false },
      { $inc: { credits: 1 }, $set: { welcomeCreditGranted: true, updatedAt: new Date() } },
      { new: true }
    );
    if (updated) {
      user = updated;
      try {
        await Transaction.create({
          email: emailKey,
          uid,
          type: 'adjust',
          creditsDelta: +1,
          meta: { reason: 'welcome_google' },
          createdAt: new Date(),
        });
      } catch {}
    }
  }

  return user;
}

export async function getCreditsStateByEmail(email) {
  const emailKey = (email || '').toLowerCase().trim();
  const user = await User.findOne({ email: emailKey });
  if (!user) return { total: 0, cooldownSecondsRemaining: 0 };

  const now = new Date();
  const cooldown = user.cooldownUntil && user.cooldownUntil > now
    ? Math.max(1, Math.ceil((user.cooldownUntil - now) / 1000))
    : 0;

  return { total: user.credits, cooldownSecondsRemaining: cooldown };
}

export async function debitOneCreditForRender(email, meta = {}) {
  const emailKey = (email || '').toLowerCase().trim();
  const updated = await User.findOneAndUpdate(
    { email: emailKey, credits: { $gte: 1 } },
    { $inc: { credits: -1 }, $set: { updatedAt: new Date() } },
    { new: true }
  );
  if (!updated) return { ok: false, status: 409, error: 'no_credits' };

  try {
    await Transaction.create({
      email: emailKey,
      type: 'render',
      creditsDelta: -1,
      meta,
      createdAt: new Date(),
    });
  } catch {}

  return { ok: true, creditsLeft: updated.credits };
}

/* ==============================
   Redeem (Odoo gift -> créditos)
   ============================== */

/** Resuelve créditos a partir del nombre del programa*/
function resolveCreditsFromProgram({programName}) {
  const name = String(programName);

  if (name === "Pack 3 Créditos") return 3;
  if (name === "Pack 10 Créditos") return 10;
  if (name === "Pack 20 Créditos") return 20;
  else
    return 0;
}

/** Lee gift en Odoo (modelo loyalty.card) por `code` */
async function fetchGiftFromOdooByCode(codeRaw) {
  const code = String(codeRaw || '').trim();
  if (!code) return null;

  // búsqueda exacta
  let rows = await odooSearchRead(
    'loyalty.card',
    [['code', '=', code]],
    ['id','code','program_id','program_type','points','use_count','expiration_date','company_id','create_date'],
    { limit: 1, order: 'id desc' }
  );

  // reintento en minúsculas
  if (!rows?.length) {
    rows = await odooSearchRead(
      'loyalty.card',
      [['code', '=', code.toLowerCase()]],
      ['id','code','program_id','program_type','points','use_count','expiration_date','company_id','create_date'],
      { limit: 1, order: 'id desc' }
    );
  }

  if (!rows?.length) return null;

  const r = rows[0];
  const programName = Array.isArray(r.program_id) ? r.program_id[1] : null;
  return {
    id: r.id,
    code: r.code,
    programType: r.program_type,
    programName,
    points: Number(r.points || 0),
    useCount: Number(r.use_count || 0),
    expiration: r.expiration_date || null,
  };
}


/**
 * Canjea un código:
 * - valida local (no usado), consulta Odoo, verifica expiración/uso
 * - resuelve créditos, suma al usuario, registra Transaction
 * - marca gift como usada en Odoo (best-effort)
 * - guarda RedeemedCode (índice único por code)
 */
export async function redeemCodeForUser({ email, uid, code }) {
  const emailKey = (email || '').toLowerCase().trim();
  const clean = (code || '').trim();
  if (!clean) return { ok: false, status: 400, error: 'missing_code', message: 'Ingresá un código.' };

  // 0) bloqueo por duplicado local
  const already = await RedeemedCode.findOne({ code: clean });
  if (already) {
    return { ok: false, status: 409, error: 'code_already_redeemed', message: 'Ese código ya fue usado en esta app.' };
  }

  // 1) consultar Odoo (capturamos excepción para enviar error claro al front)
  let gift;
  try {
    gift = await fetchGiftFromOdooByCode(clean);
  } catch (e) {
    return { ok: false, status: 503, error: 'odoo_unreachable', message: e?.message || 'No se pudo contactar a Odoo' };
  }
  if (!gift) {
    return { ok: false, status: 404, error: 'code_not_found', message: 'El código no existe.' };
  }

  // 2) validaciones
  if (gift.programType && gift.programType !== 'gift_card') {
    return { ok: false, status: 400, error: 'not_a_gift_card', message: 'El código no corresponde a una Gift Card.' };
  }
  if (gift.useCount > 0) {
    return { ok: false, status: 409, error: 'code_already_used_in_odoo', message: 'Ese código ya figura usado en Odoo.' };
  }
  if (gift.expiration) {
    const today = new Date();
    const exp = new Date(gift.expiration + 'T23:59:59');
    if (exp < today) return { ok: false, status: 410, error: 'code_expired', message: 'El código está vencido.' };
  }

  // 3) resolver créditos (usás tu implementación actual basada en programName)
  const creditsToAdd = resolveCreditsFromProgram({ programName: gift.programName });
  if (creditsToAdd <= 0) {
    return { ok: false, status: 422, error: 'unable_to_resolve_credits', message: 'No se pudo determinar cuántos créditos otorga el código.' };
  }

  // 4) sumar créditos al usuario
  const user = await User.findOneAndUpdate(
    { email: emailKey },
    { $inc: { credits: creditsToAdd }, $set: { updatedAt: new Date() } },
    { new: true, upsert: true }
  );

  // 5) transaction log
  try {
    await Transaction.create({
      email: emailKey,
      uid: uid || null,
      type: 'redeem',
      creditsDelta: +creditsToAdd,
      meta: {
        code: gift.code,
        odooCardId: gift.id,
        programName: gift.programName,
        points: gift.points,
      },
      createdAt: new Date(),
    });
  } catch {}

  // 6) marcar gift usada (best-effort)
  let odooMarked = false;
  try {
    const ok = await odooWrite('loyalty.card', [gift.id], { use_count: 1 });
    odooMarked = !!ok;
  } catch (e) {
    console.warn('[redeem] no se pudo marcar como usada en Odoo:', e?.message || e);
  }

  // 7) registrar canje local con índice único
  try {
    await RedeemedCode.create({
      code: gift.code,
      email: emailKey,
      uid: uid || null,
      odooCardId: gift.id,
      programName: gift.programName,
      creditsAdded: creditsToAdd,
      odooMarkedUsed: odooMarked,
      meta: { points: gift.points },
      redeemedAt: new Date(),
    });
  } catch (err) {
    if (err?.code === 11000) {
      // carrera: revertimos el crédito agregado
      await User.updateOne({ _id: user._id }, { $inc: { credits: -creditsToAdd } });
      return { ok: false, status: 409, error: 'code_already_redeemed', message: 'Ese código ya fue usado en esta app.' };
    }
    throw err;
  }

  return {
    ok: true,
    added: creditsToAdd,
    newTotal: user.credits,
    gift: {
      id: gift.id,
      code: gift.code,
      programName: gift.programName,
      points: gift.points,
      odooMarkedUsed: odooMarked,
    },
  };
}


export default {
  ensureUserAndWelcome,
  getCreditsStateByEmail,
  redeemCodeForUser,
  debitOneCreditForRender,
};

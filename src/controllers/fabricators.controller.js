// api/src/controllers/fabricators.controller.js
import { Fabricator } from '../db/models/Fabricator.js';

// Util seguro para regex
function makeRe(s) {
  const esc = String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc, 'i');
}

/* ===================== PÚBLICO ===================== */
// GET /api/fabricators?province=&city=&q=
export async function listPublic(req, res) {
  const { province = '', city = '', q = '' } = req.query || {};
  const query = { approved: true, rejected: { $ne: true } };

  if (province.trim()) query.province = makeRe(province.trim());
  if (city.trim())     query.city = makeRe(city.trim());

  if (q.trim()) {
    const re = makeRe(q.trim());
    query.$or = [
      { name: re }, { city: re }, { province: re }, { address: re },
      { email: re }, { phone: re }, { zip: re },
    ];
  }

  const items = await Fabricator.find(query).sort({ createdAt: -1 }).limit(500).lean();
  res.json({ items });
}

// POST /api/fabricators
export async function createPublic(req, res) {
  // (si usás reCAPTCHA, la validación estaría en un middleware previo)
  const {
    name, province, city, zip, address, phone, website, email, geo,
  } = req.body || {};

  if (!name || !address) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  const doc = await Fabricator.create({
    name: String(name).trim(),
    province: String(province || '').trim(),
    city: String(city || '').trim(),
    zip: String(zip || '').trim(),
    address: String(address || '').trim(),
    phone: String(phone || '').trim(),
    website: String(website || '').trim(),
    email: String(email || '').trim(),
    geo: {
      lat: Number(geo?.lat ?? NaN),
      lng: Number(geo?.lng ?? NaN),
    },
    approved: false,
    rejected: false,
  });

  res.status(201).json({ ok: true, item: doc });
}

/* ===================== ADMIN ===================== */
// GET /api/fabricators/admin?status=pending|approved|rejected&q=
export async function adminList(req, res) {
  const status = String(req.query?.status || 'pending').toLowerCase();
  const q = String(req.query?.q || '').trim();

  let query;
  if (status === 'approved') {
    query = { approved: true };
  } else if (status === 'rejected') {
    query = { rejected: true };
  } else {
    // pending = no aprobados y no rechazados
    query = { approved: { $ne: true }, $or: [{ rejected: { $exists: false } }, { rejected: false }] };
  }

  if (q) {
    const re = makeRe(q);
    query.$or = [
      ...(query.$or || []),
      { name: re }, { city: re }, { province: re }, { address: re }, { email: re }, { phone: re }, { zip: re },
    ];
  }

  const items = await Fabricator.find(query).sort({ createdAt: -1 }).limit(500).lean();
  res.json({ items });
}

// PATCH /api/fabricators/admin/:id { action: "approve" | "reject" }
export async function adminPatch(req, res) {
  const { id } = req.params || {};
  const action = String(req.body?.action || '').toLowerCase();

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ ok: false, error: 'bad_action' });
  }

  const set =
    action === 'approve'
      ? { approved: true, rejected: false, approvedAt: new Date(), rejectedAt: null }
      : { approved: false, rejected: true, rejectedAt: new Date(), approvedAt: null };

  const doc = await Fabricator.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
  if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

  res.json({ ok: true, item: doc });
}

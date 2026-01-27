import { Fabricator } from '../db/models/Fabricator.js';

export async function createFabricator(input) {
  const doc = await Fabricator.create({
    name:     String(input?.name || '').trim(),
    province: String(input?.province || '').trim(),
    city:     String(input?.city || '').trim(),
    address:  String(input?.address || '').trim(),
    phone:    String(input?.phone || '').trim(),
    website:  String(input?.website || '').trim(),
    email:    String(input?.email || '').trim(),
    geo: {
      lat: input?.geo?.lat != null ? Number(input.geo.lat) : undefined,
      lng: input?.geo?.lng != null ? Number(input.geo.lng) : undefined,
    },
    approved: false,
  });
  return doc.toObject();
}

export async function listFabricators({ province, city }) {
  const q = { approved: true };
  if (province) q.province = province;
  if (city)     q.city     = city;

  const docs = await Fabricator.find(q).sort({ province: 1, city: 1, name: 1 }).lean();
  return { items: docs };
}

// Admin
export async function listPending() {
  const docs = await Fabricator.find({ approved: false }).sort({ createdAt: -1 }).lean();
  return { items: docs };
}

export async function setApproved(id, approved) {
  const doc = await Fabricator.findByIdAndUpdate(
    id,
    { $set: { approved: !!approved } },
    { new: true }
  ).lean();
  return doc;
}

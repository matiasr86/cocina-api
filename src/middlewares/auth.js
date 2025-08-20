import { config } from '../config/index.js';

export function requireAdmin(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
  if (token !== config.adminToken) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

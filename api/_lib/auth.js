// api/_lib/auth.js — the admin check, same scheme as save-content.js:
// an x-admin-secret header compared in constant time against ADMIN_SECRET.
// Fails closed: no ADMIN_SECRET set means nobody is an admin.

const crypto = require('crypto');

function timingSafeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return timingSafeEqual(req.headers['x-admin-secret'] || '', secret);
}

module.exports = { isAdmin, timingSafeEqual };

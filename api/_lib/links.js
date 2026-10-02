// api/_lib/links.js — HMAC-signed, expiring links (ORDERS_LINK_SECRET).
// Used for the "Mark submitted" link in the fulfilment card, so the admin
// secret never travels in a URL.
//
//   signToken(pi, action, ttlDays = 14) → "<exp>.<sig>"
//   verifyToken(pi, action, token)      → true | false

const crypto = require('crypto');

function key() {
  const k = process.env.ORDERS_LINK_SECRET;
  if (!k) throw new Error('ORDERS_LINK_SECRET is not set');
  return k;
}

function mac(pi, action, exp) {
  return crypto.createHmac('sha256', key()).update(`${pi}|${action}|${exp}`).digest('base64url');
}

function signToken(pi, action, ttlDays = 14) {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  return `${exp}.${mac(pi, action, exp)}`;
}

function verifyToken(pi, action, token) {
  const [expStr, sig] = String(token || '').split('.');
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now() / 1000) return false;
  const want = Buffer.from(mac(pi, action, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

module.exports = { signToken, verifyToken };

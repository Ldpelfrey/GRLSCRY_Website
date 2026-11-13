// api/_rate.js — a small in-memory rate limiter shared by the functions in this folder.
// (The leading underscore keeps Vercel from turning this file into an endpoint.)
//
// What it is: a brake. Counts live in the memory of one warm function instance, so they
// reset on a cold start and are not shared between instances. It stops a script hammering
// the booking form or guessing the admin password from one address; it is not a wall.
// A hard limit across all instances needs a rate-limit rule in Vercel's Firewall settings.

const buckets = new Map();
const MAX_KEYS = 5000;

function recent(key, windowMs, now) {
  const list = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (list.length) buckets.set(key, list); else buckets.delete(key);
  return list;
}

// True when `key` has already used its `limit` inside the window. Does not count a hit.
function blocked(key, limit, windowMs, now = Date.now()) {
  return recent(key, windowMs, now).length >= limit;
}

// Count one hit. Returns false when the limit was already reached (the hit is not counted).
function hit(key, limit, windowMs, now = Date.now()) {
  const list = recent(key, windowMs, now);
  if (list.length >= limit) return false;
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > MAX_KEYS) buckets.delete(buckets.keys().next().value);   // oldest key out
  return true;
}

// Vercel puts the caller's address first in x-forwarded-for.
function clientIp(req) {
  const h = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '';
  const ip = String(Array.isArray(h) ? h[0] : h).split(',')[0].trim();
  return ip || 'unknown';
}

module.exports = { hit, blocked, clientIp, _reset: () => buckets.clear() };

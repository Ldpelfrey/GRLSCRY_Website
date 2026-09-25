// api/save-content.js — Vercel serverless function.
// Originally ported from the Netlify function (removed 2026-09-25). Same contract:
// POST with an x-admin-secret header matching ADMIN_SECRET; body is either
// {verify:true} to check the password, or {content:{...}} to commit
// content.json to GitHub. Fails closed if ADMIN_SECRET is unset.

const crypto = require('crypto');

const REPO   = 'Ldpelfrey/GRLSCRY_Website';
const BRANCH = 'main';
const FILE   = 'content.json';
const API    = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

const ALLOWED_KEYS = ['meta','ticker','hero','about','tracks','events','contact','shop','footer'];
const MAX_BYTES    = 256 * 1024;
const MAX_STRING   = 8000;
const MAX_ITEMS    = 200;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Caller must present the admin secret ──────────────── */
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error('ADMIN_SECRET environment variable is not set');
    return res.status(500).json({ error: 'Server misconfiguration: ADMIN_SECRET not set' });
  }

  const supplied = req.headers['x-admin-secret'] || '';
  if (!timingSafeEqual(supplied, secret)) {
    console.warn('save-content: rejected request with bad or missing admin secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  /* ── Parse body (Vercel may hand us an object or a string) ── */
  let content, verifyOnly = false;
  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    if (body.verify === true) {
      verifyOnly = true;
    } else {
      content = body.content;
      if (!content || typeof content !== 'object') throw new Error('Missing content object');
    }
  } catch (err) {
    return res.status(400).json({ error: `Invalid request body: ${err.message}` });
  }

  if (verifyOnly) return res.status(200).json({ ok: true });

  const shapeError = validateContent(content);
  if (shapeError) {
    console.warn('save-content: rejected payload —', shapeError);
    return res.status(422).json({ error: `Invalid content: ${shapeError}` });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN environment variable is not set');
    return res.status(500).json({ error: 'Server misconfiguration: GITHUB_TOKEN not set' });
  }

  const headers = {
    Authorization:  `token ${token}`,
    Accept:         'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent':   'grlscry-admin-function',
  };

  try {
    let sha;
    const getRes = await fetch(API, { headers });
    if (getRes.ok) {
      sha = (await getRes.json()).sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub GET error: ${getRes.status}`);
    }

    const encoded = Buffer.from(JSON.stringify(content, null, 2), 'utf8').toString('base64');
    const putBody = {
      message: `content: update via admin panel [${new Date().toISOString().slice(0, 10)}]`,
      content: encoded,
      branch:  BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(API, { method: 'PUT', headers, body: JSON.stringify(putBody) });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub PUT error: ${putRes.status}`);
    }

    const result = await putRes.json();
    return res.status(200).json({
      success: true,
      commit:  result.commit.sha.slice(0, 7),
      sha:     result.content.sha,
    });
  } catch (err) {
    console.error('save-content function error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Structural validation only — output escaping on the page handles hostile values.
function validateContent(c) {
  const size = Buffer.byteLength(JSON.stringify(c), 'utf8');
  if (size > MAX_BYTES) return `payload too large (${size} bytes, max ${MAX_BYTES})`;

  for (const k of Object.keys(c)) {
    if (!ALLOWED_KEYS.includes(k)) return `unexpected top-level key "${k}"`;
  }
  if (c.events && !Array.isArray(c.events)) return 'events must be an array';
  if (c.tracks && !Array.isArray(c.tracks)) return 'tracks must be an array';
  if ('ticker' in c && typeof c.ticker !== 'string') return 'ticker must be a string';
  for (const k of ['meta','hero','about','contact','shop','footer']) {
    if (k in c && (typeof c[k] !== 'object' || c[k] === null || Array.isArray(c[k]))) {
      return `${k} must be an object`;
    }
  }
  if (Array.isArray(c.events) && c.events.length > MAX_ITEMS) return 'too many events';
  if (Array.isArray(c.tracks) && c.tracks.length > MAX_ITEMS) return 'too many tracks';

  let bad = null;
  (function walk(node, path, depth) {
    if (bad) return;
    if (depth > 6) { bad = `nesting too deep at ${path}`; return; }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`, depth + 1));
    if (node && typeof node === 'object') {
      return Object.keys(node).forEach(k => walk(node[k], `${path}.${k}`, depth + 1));
    }
    if (typeof node === 'string' && node.length > MAX_STRING) bad = `string too long at ${path}`;
    else if (node !== null && !['string','number','boolean'].includes(typeof node)) {
      bad = `unsupported value type "${typeof node}" at ${path}`;
    }
  })(c, 'content', 0);

  return bad;
}

function timingSafeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

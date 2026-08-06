// netlify/functions/save-content.js
// Receives updated content JSON, commits it to GitHub as content.json.
// GITHUB_TOKEN and ADMIN_SECRET are read from Netlify environment variables —
// never from the repo. Requests must carry ADMIN_SECRET in the x-admin-secret
// header; without it this endpoint would be an unauthenticated write to main.

const crypto = require('crypto');

const REPO   = 'Ldpelfrey/GRLSCRY_Website';
const BRANCH = 'main';
const FILE   = 'content.json';
const API    = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

exports.handler = async function (event) {
  /* ── Only accept POST ───────────────────────────────────── */
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  /* ── Caller must present the admin secret ──────────────── */
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // Fail closed: an unset secret must never mean "allow everyone".
    console.error('ADMIN_SECRET environment variable is not set');
    return respond(500, { error: 'Server misconfiguration: ADMIN_SECRET not set' });
  }

  const supplied = event.headers['x-admin-secret'] || '';
  if (!timingSafeEqual(supplied, secret)) {
    console.warn('save-content: rejected request with bad or missing admin secret');
    return respond(401, { error: 'Unauthorized' });
  }

  /* ── Token must be set in Netlify env ──────────────────── */
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN environment variable is not set');
    return respond(500, { error: 'Server misconfiguration: GITHUB_TOKEN not set' });
  }

  /* ── Parse request body ─────────────────────────────────── */
  let content, verifyOnly = false;
  try {
    const body = JSON.parse(event.body || '{}');
    // The admin panel calls this on login to check the password without writing.
    if (body.verify === true) {
      verifyOnly = true;
    } else {
      content = body.content;
      if (!content || typeof content !== 'object') throw new Error('Missing content object');
    }
  } catch (err) {
    return respond(400, { error: `Invalid request body: ${err.message}` });
  }

  // Secret already validated above, so reaching here means the password is good.
  if (verifyOnly) return respond(200, { ok: true });

  /* ── Validate shape before it reaches the repo ───────────────
     Defence in depth. The public page escapes on output, but a
     malformed payload committed here would still deploy site-wide,
     so reject anything that isn't the expected schema. */
  const shapeError = validateContent(content);
  if (shapeError) {
    console.warn('save-content: rejected payload —', shapeError);
    return respond(422, { error: `Invalid content: ${shapeError}` });
  }

  const headers = {
    Authorization:  `token ${token}`,
    Accept:         'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent':   'grlscry-admin-function',
  };

  try {
    /* ── Get current file SHA (needed to update an existing file) ── */
    let sha;
    const getRes = await fetch(API, { headers });

    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status === 404) {
      // File doesn't exist yet — first-time create, no SHA needed
      sha = undefined;
    } else {
      const err = await getRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub GET error: ${getRes.status}`);
    }

    /* ── Encode content as UTF-8 base64 ────────────────────── */
    const jsonStr = JSON.stringify(content, null, 2);
    const encoded = Buffer.from(jsonStr, 'utf8').toString('base64');

    /* ── Commit to GitHub ───────────────────────────────────── */
    const putBody = {
      message: `content: update via admin panel [${new Date().toISOString().slice(0, 10)}]`,
      content: encoded,
      branch:  BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(API, {
      method:  'PUT',
      headers,
      body:    JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `GitHub PUT error: ${putRes.status}`);
    }

    const result = await putRes.json();
    return respond(200, {
      success: true,
      commit:  result.commit.sha.slice(0, 7),
      sha:     result.content.sha,
    });

  } catch (err) {
    console.error('save-content function error:', err);
    return respond(500, { error: err.message });
  }
};

const ALLOWED_KEYS = ['meta','ticker','hero','about','tracks','events','contact','footer'];
const MAX_BYTES    = 256 * 1024;   // content.json is ~6KB today
const MAX_STRING   = 8000;
const MAX_ITEMS    = 200;

// Structural validation only — no content blocklisting. Output escaping on the
// page handles hostile *values*; this rejects hostile *shapes*.
function validateContent(c) {
  const size = Buffer.byteLength(JSON.stringify(c), 'utf8');
  if (size > MAX_BYTES) return `payload too large (${size} bytes, max ${MAX_BYTES})`;

  for (const k of Object.keys(c)) {
    if (!ALLOWED_KEYS.includes(k)) return `unexpected top-level key "${k}"`;
  }
  if (c.events && !Array.isArray(c.events)) return 'events must be an array';
  if (c.tracks && !Array.isArray(c.tracks)) return 'tracks must be an array';
  // Fields that must be scalars, so an object here can't render as "[object Object]"
  if ('ticker' in c && typeof c.ticker !== 'string') return 'ticker must be a string';
  // Fields that must be objects
  for (const k of ['meta','hero','about','contact','footer']) {
    if (k in c && (typeof c[k] !== 'object' || c[k] === null || Array.isArray(c[k]))) {
      return `${k} must be an object`;
    }
  }
  if (Array.isArray(c.events) && c.events.length > MAX_ITEMS) return 'too many events';
  if (Array.isArray(c.tracks) && c.tracks.length > MAX_ITEMS) return 'too many tracks';

  // Every leaf must be a primitive; no nested objects smuggling in structure.
  let bad = null;
  (function walk(node, path, depth) {
    if (bad || depth > 6) { if (depth > 6) bad = `nesting too deep at ${path}`; return; }
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

// Constant-time compare so response latency can't be used to guess the secret.
// Hashing both sides first keeps the buffers equal-length for timingSafeEqual.
function timingSafeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

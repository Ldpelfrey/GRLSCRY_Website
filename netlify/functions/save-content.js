// netlify/functions/save-content.js
// Receives updated content JSON, commits it to GitHub as content.json.
// GITHUB_TOKEN is read from Netlify environment variables — never from the repo.

const REPO   = 'Ldpelfrey/GRLSCRY_Website';
const BRANCH = 'main';
const FILE   = 'content.json';
const API    = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

exports.handler = async function (event) {
  /* ── Only accept POST ───────────────────────────────────── */
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  /* ── Token must be set in Netlify env ──────────────────── */
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN environment variable is not set');
    return respond(500, { error: 'Server misconfiguration: GITHUB_TOKEN not set' });
  }

  /* ── Parse request body ─────────────────────────────────── */
  let content;
  try {
    const body = JSON.parse(event.body || '{}');
    content = body.content;
    if (!content || typeof content !== 'object') throw new Error('Missing content object');
  } catch (err) {
    return respond(400, { error: `Invalid request body: ${err.message}` });
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

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// api/orders.js — fulfilment status page + admin order actions.
//
//   GET  ?action=submitted&pi&t     signed link from the fulfilment card → HTML form
//   POST form (urlencoded)          action=submitted: record the Tapstitch order number
//   POST JSON + x-admin-secret      action list | tracking | resend
//
// Stripe is the only order database (PaymentIntent metadata, see _lib/stripe.js).
// Nothing customer-related is ever written to a file.

const { getStripe } = require('./_lib/stripe');
const { isAdmin } = require('./_lib/auth');
const { verifyToken } = require('./_lib/links');
const { shipAndNotify, customerFor } = require('./_lib/ship-mail');

const PI_RE = /^pi_[A-Za-z0-9]{6,80}$/;
const ORDER_RE = /^\d{10,25}$/;
const TRACK_RE = /^[A-Za-z0-9]{6,40}$/;

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function page(res, code, title, inner) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><style>
body{background:#0a0a0a;color:#fff;font:14px/1.6 ui-monospace,Menlo,monospace;margin:0;padding:32px 20px}
main{max-width:440px;margin:0 auto}h1{font-size:20px;letter-spacing:.1em;color:#d7efc2;margin:0 0 16px}
p{margin:0 0 14px}.ref{color:#d7efc2}input{width:100%;box-sizing:border-box;background:#161616;border:1px solid #333;color:#fff;padding:12px;font:inherit;margin:6px 0 14px}
button{background:#fff;color:#000;border:0;padding:12px 24px;font:inherit;cursor:pointer;letter-spacing:.1em;text-transform:uppercase}
.err{color:#ff69b4}</style></head><body><main>${inner}</main></body></html>`);
}

function parseBody(req) {
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  const s = Buffer.isBuffer(b) ? b.toString('utf8') : typeof b === 'string' ? b : '';
  if (!s) return {};
  try { return JSON.parse(s); } catch (_) { /* fall through to urlencoded */ }
  return Object.fromEntries(new URLSearchParams(s));
}

function isForm(req) {
  return /application\/x-www-form-urlencoded/i.test(String((req.headers || {})['content-type'] || ''));
}

function formPage(res, meta, pi, t, error, code = 200) {
  return page(res, code, 'Mark submitted', `<h1>GRLS CRY / Order</h1>
<p><span class="ref">${esc(meta.order_ref)}</span> &middot; ${esc(meta.size_qty)} &middot; status ${esc(meta.fulfil_status)}</p>
${error ? `<p class="err">${esc(error)}</p>` : ''}
<form method="POST" action="/api/orders">
<input type="hidden" name="action" value="submitted"><input type="hidden" name="pi" value="${esc(pi)}"><input type="hidden" name="t" value="${esc(t)}">
<label for="n">Tapstitch order number</label>
<input id="n" name="tapstitch_order" inputmode="numeric" pattern="[0-9]{10,25}" minlength="10" maxlength="25" required autocomplete="off">
<button type="submit">Mark submitted</button></form>`);
}

async function handleSubmittedGet(req, res) {
  const { pi, t } = req.query || {};
  if (!PI_RE.test(String(pi || '')) || !safeVerify(pi, t)) {
    return page(res, 403, 'Link invalid', '<h1>Link invalid</h1><p>This link is invalid or has expired.</p>');
  }
  const meta = (await getStripe().paymentIntents.retrieve(pi)).metadata || {};
  return formPage(res, meta, pi, t, '');
}

async function handleSubmittedPost(req, res) {
  const b = parseBody(req);
  const pi = String(b.pi || ''); const t = String(b.t || '');
  if (b.action !== 'submitted') return page(res, 400, 'Bad request', '<h1>Bad request</h1>');
  if (!PI_RE.test(pi) || !safeVerify(pi, t)) {
    return page(res, 403, 'Link invalid', '<h1>Link invalid</h1><p>This link is invalid or has expired.</p>');
  }
  const stripe = getStripe();
  const meta = (await stripe.paymentIntents.retrieve(pi)).metadata || {};
  const num = String(b.tapstitch_order || '').trim();
  if (!ORDER_RE.test(num)) return formPage(res, meta, pi, t, 'Enter the Tapstitch order number: digits only, 10 to 25 long.', 400);
  if (meta.fulfil_status !== 'NEW' && meta.fulfil_status !== 'SUBMITTED') {
    return page(res, 409, 'Already processed', `<h1>Already ${esc(String(meta.fulfil_status || '').toLowerCase())}</h1><p><span class="ref">${esc(meta.order_ref)}</span> is already ${esc(meta.fulfil_status)}.</p>`);
  }
  await stripe.paymentIntents.update(pi, { metadata: { fulfil_status: 'SUBMITTED', tapstitch_order: num } });
  return page(res, 200, 'Submitted', `<h1>Marked submitted</h1><p><span class="ref">${esc(meta.order_ref)}</span> &middot; ${esc(meta.size_qty)}</p><p>Tapstitch order ${esc(num)}. Tracking goes out to the customer automatically when Tapstitch ships it.</p>`);
}

function safeVerify(pi, t) {
  try { return verifyToken(pi, 'submitted', t); } catch (_) { return false; }
}

async function adminList(stripe) {
  const r = await stripe.checkout.sessions.list({ limit: 50, expand: ['data.payment_intent'] });
  return (r.data || []).filter(s => s.payment_status === 'paid').map(s => {
    const p = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : {};
    const m = p.metadata || {};
    const cd = s.customer_details || {};
    const addr = (s.shipping_details && s.shipping_details.address) || cd.address || {};
    return {
      pi: p.id || (typeof s.payment_intent === 'string' ? s.payment_intent : ''),
      created: s.created, order_ref: m.order_ref || '', size_qty: m.size_qty || '',
      name: cd.name || '', city: addr.city || '', state: addr.state || '',
      status: m.fulfil_status || '', tapstitch_order: m.tapstitch_order || '',
      tracking: m.tracking || '', email: cd.email || '',
    };
  });
}

async function handleAdmin(req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const b = parseBody(req);
  const stripe = getStripe();
  try {
    if (b.action === 'list') return res.status(200).json({ orders: await adminList(stripe) });

    if (b.action === 'tracking' || b.action === 'resend') {
      const pi = String(b.pi || '');
      if (!PI_RE.test(pi)) return res.status(400).json({ error: 'Invalid pi' });
      const meta = (await stripe.paymentIntents.retrieve(pi)).metadata || {};
      if (!meta.order_ref) return res.status(404).json({ error: 'Not a fulfilment order' });

      if (b.action === 'tracking') {
        const tracking = String(b.tracking || '').trim();
        if (!TRACK_RE.test(tracking)) return res.status(400).json({ error: 'Invalid tracking number' });
        const extra = {};
        if (b.tapstitch_order !== undefined && b.tapstitch_order !== '') {
          const n = String(b.tapstitch_order).trim();
          if (!ORDER_RE.test(n)) return res.status(400).json({ error: 'Invalid Tapstitch order number' });
          extra.tapstitch_order = n;
        }
        const r = await shipAndNotify({ stripe, pi, meta, tracking, extra });
        return res.status(200).json({ success: true, emailed: r.sent, note: r.reason || null });
      }

      if (!meta.tracking) return res.status(400).json({ error: 'No tracking number on this order yet' });
      const r = await shipAndNotify({ stripe, pi, meta, tracking: meta.tracking, force: true });
      return res.status(200).json({ success: true, emailed: r.sent, note: r.reason || null });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('orders admin error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if ((req.query || {}).action === 'submitted') return await handleSubmittedGet(req, res);
      return res.status(400).json({ error: 'Unknown action' });
    }
    if (req.method === 'POST') {
      if (isForm(req)) return await handleSubmittedPost(req, res);
      return await handleAdmin(req, res);
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('orders error:', err);
    return page(res, 500, 'Error', '<h1>Something went wrong</h1><p>Try again in a moment.</p>');
  }
};

// api/stripe-webhook.js — Stripe webhook for the per-size Payment Links shop.
// Paid order → fulfilment card mailed to Luke, then PaymentIntent metadata marks it NEW.
// Mail first, metadata second: a duplicate alert on retry is harmless, a lost alert is not.

const { sendMail } = require('./_lib/mail');
const { getStripe } = require('./_lib/stripe');
const { signToken } = require('./_lib/links');

const TAPSTITCH_UNIT = 16.97;
const PRODUCT = 'Classic Loose Boxy Tee (RU0034) Black';

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const money = n => n.toFixed(2);
const alertTo = () => process.env.BOOKING_TO || process.env.GMAIL_USER;
const piId = pi => (pi && typeof pi === 'object' ? pi.id : pi) || '';

function sizeInfo(session) {
  const meta = session.metadata && session.metadata.size ? String(session.metadata.size).trim() : '';
  const m = /^TEE-(.+)$/i.exec(session.client_reference_id || '');
  const refSize = m ? m[1].trim() : '';
  const li = session.line_items && session.line_items.data && session.line_items.data[0];
  const desc = li && li.description ? String(li.description) : '';
  const i = desc.lastIndexOf('— ');
  const descSize = i >= 0 ? desc.slice(i + 2).trim() : '';
  const found = [meta, refSize, descSize].filter(Boolean);
  const size = (found[0] || '?').toUpperCase();
  const disagree = found.some(s => s.toUpperCase() !== size);
  return { size, disagree, sources: { metadata: meta, client_reference_id: refSize, description: descSize } };
}

function buildCard(session) {
  const pi = piId(session.payment_intent);
  const { size, disagree, sources } = sizeInfo(session);
  const li = session.line_items && session.line_items.data && session.line_items.data[0];
  const qty = (li && li.quantity) || 1;
  const ship = (session.collected_information && session.collected_information.shipping_details)
    || session.shipping_details || {};
  const a = ship.address || {};
  const cd = session.customer_details || {};
  const total = (session.amount_total || 0) / 100;
  const fee = total * 0.029 + 0.30;
  const cost = TAPSTITCH_UNIT * qty;
  const net = total - fee - cost;
  const created = new Date((session.created || 0) * 1000);
  const yymmdd = String(created.getUTCFullYear()).slice(2)
    + String(created.getUTCMonth() + 1).padStart(2, '0')
    + String(created.getUTCDate()).padStart(2, '0');
  const orderRef = `GC-${yymmdd}-${pi.slice(-4).toUpperCase()}`;

  const rows = [
    ['Product', `${PRODUCT} / ${size}`],
    ['Quantity', String(qty)],
    ['Name', ship.name || cd.name || ''],
    ['Address 1', a.line1 || ''],
    ['Address 2', a.line2 || ''],
    ['City', a.city || ''],
    ['State', a.state || ''],
    ['ZIP', a.postal_code || ''],
    ['Country', a.country || ''],
    ['Phone', cd.phone || 'none given'],
    ['Email', cd.email || ''],
  ];
  const w = Math.max(...rows.map(r => r[0].length)) + 2;
  const lines = [];
  if (disagree) {
    lines.push(`SIZE CHECK: sources disagree (metadata "${sources.metadata}", reference "${sources.client_reference_id}", description "${sources.description}"). Using ${size}. Confirm in the Stripe session before ordering.`, '');
  }
  for (const [k, v] of rows) lines.push(`${(k + ':').padEnd(w)}${v}`);
  lines.push('');
  lines.push(`Paid: $${money(total)} (Stripe fee est. $${money(fee)}, Tapstitch est. $${TAPSTITCH_UNIT.toFixed(2)} × ${qty}, net est. $${money(net)})`);
  lines.push('');
  lines.push('After you place it in Tapstitch, open this link and paste the Tapstitch order number:');
  const base = process.env.SITE_URL || 'https://grlscry.com';
  lines.push(`${base}/api/orders?action=submitted&pi=${encodeURIComponent(pi)}&t=${encodeURIComponent(signToken(pi, 'submitted'))}`);

  const place = [a.city, a.state].filter(Boolean).join(', ');
  return {
    subject: `[GC ORDER] ${orderRef} · ${size} ×${qty} · ${place}`,
    text: lines.join('\n') + '\n',
    orderRef, size, qty, pi,
  };
}

async function newOrder(stripe, sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items', 'payment_intent'] });
  // The Stripe account also holds non-tee products; only tee Payment Links are orders.
  if (!((session.metadata && session.metadata.grlscry_sku) || /^TEE-/.test(session.client_reference_id || ''))) {
    return { ignored: 'not a tee order' };
  }
  const pi = session.payment_intent;
  if (!pi || typeof pi !== 'object') throw new Error('payment_intent not expanded');
  if (pi.metadata && pi.metadata.fulfil_status) return { duplicate: true };
  const card = buildCard(session);
  await sendMail({ to: alertTo(), subject: card.subject, text: card.text, fromName: 'GRLS CRY Orders' });
  await stripe.paymentIntents.update(pi.id, {
    metadata: { fulfil_status: 'NEW', order_ref: card.orderRef, size_qty: `${card.size}×${card.qty}` },
  });
  return { order_ref: card.orderRef };
}

async function problemAlert(stripe, kind, obj) {
  const id = piId(obj.payment_intent);
  let ref = '';
  if (id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(id);
      ref = (pi.metadata && pi.metadata.order_ref) || '';
    } catch (e) { /* alert anyway */ }
  }
  const label = kind === 'refund' ? 'REFUND' : 'DISPUTE';
  const amount = kind === 'refund' ? (obj.amount_refunded || obj.amount || 0) : (obj.amount || 0);
  const text = [
    `A ${kind} was recorded. Do not fulfil this order. Check Tapstitch and cancel it if it has not shipped.`,
    '',
    `Order:   ${ref || 'unknown'}`,
    `Amount:  $${money(amount / 100)}`,
    `PI:      ${id || 'unknown'}`,
  ].join('\n') + '\n';
  await sendMail({ to: alertTo(), subject: `[GC ${label}] ${ref || id || 'unknown'}`, text, fromName: 'GRLS CRY Orders' });
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'webhook secret not configured' });

  let raw;
  try { raw = await readRaw(req); } catch (e) { return res.status(400).json({ error: 'unreadable body' }); }

  let stripe;
  try { stripe = getStripe(); } catch (e) { return res.status(500).json({ error: 'stripe not configured' }); }
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers['stripe-signature'], secret);
  } catch (e) {
    return res.status(400).json({ error: 'bad signature' });
  }

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (obj.payment_status !== 'paid') return res.status(200).json({ ignored: true });
        return res.status(200).json({ ok: true, ...(await newOrder(stripe, obj.id)) });
      case 'checkout.session.async_payment_succeeded':
        return res.status(200).json({ ok: true, ...(await newOrder(stripe, obj.id)) });
      case 'charge.refunded':
        await problemAlert(stripe, 'refund', obj);
        return res.status(200).json({ ok: true });
      case 'charge.dispute.created':
        await problemAlert(stripe, 'dispute', obj);
        return res.status(200).json({ ok: true });
      default:
        return res.status(200).json({ ignored: true });
    }
  } catch (e) {
    console.error('stripe-webhook failed', e && e.message);
    return res.status(500).json({ error: 'processing failed, will retry' });
  }
}

handler._buildCard = buildCard;
module.exports = handler;

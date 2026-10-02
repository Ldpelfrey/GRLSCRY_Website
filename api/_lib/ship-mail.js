// api/_lib/ship-mail.js — the customer shipping email, and the shared
// "mark shipped + email once" step used by api/orders.js and the cron.
// Idempotency lives in PaymentIntent metadata shipped_mail_at.

const realMail = require('./mail');

function replyTo() {
  return process.env.BOOKING_TO || process.env.GMAIL_USER;
}

function shippingEmail({ order_ref, size_qty, tracking, name }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  const text = [
    first ? `Hi ${first},` : 'Hi,',
    '',
    `Your GRLS CRY tee (${size_qty}) is on its way. Order ${order_ref}.`,
    '',
    `Tracking number: ${tracking}`,
    `Track it here: https://t.17track.net/en#nums=${encodeURIComponent(tracking)}`,
    '',
    'Tracking can take a day or two to show movement after the label is created.',
    `If anything looks off, just reply to this email and quote ${order_ref}.`,
    '',
    'Thank you for the support.',
    'GRLS CRY',
  ].join('\n');
  return { subject: `Your GRLS CRY tee has shipped (${order_ref})`, text };
}

// Find the paid checkout session for a PaymentIntent → { name, email }.
async function customerFor(stripe, pi) {
  const r = await stripe.checkout.sessions.list({ payment_intent: pi, limit: 1 });
  const s = r.data && r.data[0];
  const d = (s && s.customer_details) || {};
  return { name: d.name || '', email: d.email || '' };
}

// Set tracking + SHIPPED, email the customer unless already emailed, record it.
// meta = current PI metadata. Returns { sent: boolean, reason? }.
async function shipAndNotify({ stripe, sendMail, pi, meta, tracking, extra = {}, force = false }) {
  const send = sendMail || realMail.sendMail;
  const already = meta.shipped_mail_at && meta.tracking === tracking;
  const update = { tracking, ...extra };
  if (meta.fulfil_status !== 'DELIVERED') update.fulfil_status = 'SHIPPED';
  await stripe.paymentIntents.update(pi, { metadata: update });
  // A corrected tracking number is worth a second email; the same one is not.
  if (already && !force) return { sent: false, reason: 'already-sent' };
  const { name, email } = await customerFor(stripe, pi);
  if (!email) return { sent: false, reason: 'no-email' };
  const { subject, text } = shippingEmail({ order_ref: meta.order_ref, size_qty: meta.size_qty, tracking, name });
  await send({ to: email, subject, text, replyTo: replyTo() });
  await stripe.paymentIntents.update(pi, { metadata: { shipped_mail_at: new Date().toISOString() } });
  return { sent: true };
}

module.exports = { shippingEmail, shipAndNotify, customerFor, replyTo };

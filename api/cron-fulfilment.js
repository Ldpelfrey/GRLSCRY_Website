// api/cron-fulfilment.js — daily Vercel cron. Reads Tapstitch emails from Gmail
// (IMAP), matches them to orders by Tapstitch order number, emails the customer
// once when shipped, and sends Luke ONE digest of anything needing attention.
// Idempotent over the 7-day mail window via PaymentIntent metadata.

const { getStripe } = require('./_lib/stripe');
const { timingSafeEqual } = require('./_lib/auth');
const { sendMail: realSend } = require('./_lib/mail');
const { shipAndNotify, replyTo } = require('./_lib/ship-mail');
const { parseTapstitch, sizeQtyToLines, sameLines } = require('./_lib/tapstitch-mail');

const DAY = 86400000;
const HOUR = 3600000;

// Only tee Payment Link sessions are orders (the account holds other products).
const isTee = s => Boolean((s.metadata && s.metadata.grlscry_sku) || /^TEE-/.test(s.client_reference_id || ''));

// ── default mail source: Gmail IMAP ─────────────────────────────────────────
function findPart(node, type) {
  if (!node) return null;
  if (node.type === type && !node.childNodes) return node.part || '1';
  for (const c of node.childNodes || []) {
    const p = findPart(c, type);
    if (p) return p;
  }
  return null;
}

async function readAll(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function imapFetchMail({ now = new Date() } = {}) {
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true, logger: false,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  const out = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(now.getTime() - 7 * DAY);
      const uids = await client.search({ from: 'notify.tapstitch.com', since });
      for (const uid of uids || []) {
        const msg = await client.fetchOne(uid, { envelope: true, bodyStructure: true }, { uid: true });
        const textPart = findPart(msg.bodyStructure, 'text/plain');
        const htmlPart = findPart(msg.bodyStructure, 'text/html');
        let text = '', html = '';
        if (textPart) text = await readAll((await client.download(uid, textPart, { uid: true })).content);
        else if (htmlPart) html = await readAll((await client.download(uid, htmlPart, { uid: true })).content);
        out.push({ subject: msg.envelope.subject, text, html, date: msg.envelope.date });
      }
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
  return out;
}

// ── core ────────────────────────────────────────────────────────────────────
async function run({ fetchMail, stripe, sendMail, now = new Date() }) {
  const send = sendMail || realSend;
  const emails = await fetchMail({ now });
  const sum = { emails: 0, parsed: 0, shippedSent: 0, delivered: 0, costSet: 0, unmatched: 0, ambiguous: 0, mismatch: 0, stale: 0 };
  const digest = { shipped: [], unmatched: [], ambiguous: [], mismatch: [], stale: [] };

  for (const e of emails) {
    sum.emails++;
    const p = parseTapstitch(e);
    if (!p.kind || !p.order) continue;
    sum.parsed++;

    const r = await stripe.paymentIntents.search({ query: `metadata['tapstitch_order']:'${p.order}'` });
    const hits = r.data || [];
    if (hits.length === 0) { sum.unmatched++; digest.unmatched.push(`Tapstitch ${p.order} (${p.kind}): no order has this number`); continue; }
    if (hits.length > 1) { sum.ambiguous++; digest.ambiguous.push(`Tapstitch ${p.order} (${p.kind}): ${hits.length} orders share this number`); continue; }

    const pi = hits[0].id;
    // Search results lag behind writes; re-read so shipped_mail_at is current.
    const meta = (await stripe.paymentIntents.retrieve(pi)).metadata || {};
    if (p.lines.length && !sameLines(p.lines, sizeQtyToLines(meta.size_qty))) {
      sum.mismatch++;
      digest.mismatch.push(`${meta.order_ref} (Tapstitch ${p.order}, ${p.kind}): ordered ${meta.size_qty}, Tapstitch email says ${p.lines.map(l => `${l.size}×${l.qty}`).join(', ')}`);
      continue;
    }

    if (p.kind === 'confirmed') {
      if (p.total && !meta.tapstitch_cost) {
        await stripe.paymentIntents.update(pi, { metadata: { tapstitch_cost: p.total } });
        sum.costSet++;
      }
    } else if (p.kind === 'shipped') {
      if (meta.shipped_mail_at || !p.tracking) continue;
      const res = await shipAndNotify({ stripe, sendMail: send, pi, meta, tracking: p.tracking });
      if (res.sent) { sum.shippedSent++; digest.shipped.push(`${meta.order_ref}: shipping email sent, tracking ${p.tracking}`); }
      else if (res.reason === 'no-email') {
        sum.stale++;
        digest.stale.push(`${meta.order_ref}: shipped (${p.tracking}) but no customer email on the session`);
      }
    } else if (p.kind === 'delivered') {
      const upd = {};
      if (meta.fulfil_status !== 'DELIVERED') upd.fulfil_status = 'DELIVERED';
      if (p.tracking && !meta.tracking) upd.tracking = p.tracking;
      if (Object.keys(upd).length) { await stripe.paymentIntents.update(pi, { metadata: upd }); sum.delivered++; }
    }
  }

  // Stale checks over paid sessions from the last 30 days.
  const sessions = await stripe.checkout.sessions.list({
    limit: 100, created: { gte: Math.floor((now.getTime() - 30 * DAY) / 1000) }, expand: ['data.payment_intent'],
  });
  for (const s of sessions.data || []) {
    if (s.payment_status !== 'paid' || !isTee(s)) continue;
    const m = (s.payment_intent && s.payment_intent.metadata) || {};
    const age = now.getTime() - s.created * 1000;
    if (!m.fulfil_status && age > HOUR) {
      // The webhook never processed this order, so Luke never got a card.
      sum.stale++; digest.stale.push(`Paid ${new Date(s.created * 1000).toISOString().slice(0, 10)} but no fulfilment card was sent (webhook failed). Check Stripe session ${s.id}`);
    } else if (m.fulfil_status === 'NEW' && age > DAY) {
      sum.stale++; digest.stale.push(`${m.order_ref}: still NEW after ${Math.floor(age / DAY)}d, not yet in Tapstitch`);
    } else if (m.fulfil_status === 'SUBMITTED' && !m.tracking && age > 7 * DAY) {
      sum.stale++; digest.stale.push(`${m.order_ref}: SUBMITTED ${Math.floor(age / DAY)}d ago, no tracking yet (Tapstitch ${m.tapstitch_order || '?'})`);
    }
  }

  const sections = [
    ['Shipping emails sent', digest.shipped], ['Unmatched Tapstitch emails', digest.unmatched],
    ['Ambiguous (not emailed)', digest.ambiguous], ['Size mismatch (not emailed)', digest.mismatch],
    ['Stale orders', digest.stale],
  ];
  const count = sections.reduce((n, [, a]) => n + a.length, 0);
  sum.digestSent = false;
  if (count) {
    const text = sections.filter(([, a]) => a.length).map(([h, a]) => `${h}\n${a.map(x => `  - ${x}`).join('\n')}`).join('\n\n');
    await send({ to: replyTo(), subject: `[GC DIGEST] ${now.toISOString().slice(0, 10)} · ${count} items`, text });
    sum.digestSent = true;
  }
  return sum;
}

async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: 'CRON_SECRET is not set' });
  if (!timingSafeEqual((req.headers || {}).authorization || '', `Bearer ${secret}`)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const summary = await run({ fetchMail: imapFetchMail, stripe: getStripe(), sendMail: realSend, now: new Date() });
    return res.status(200).json(summary);
  } catch (err) {
    console.error('cron-fulfilment error:', err);
    try {
      await realSend({ to: replyTo(), subject: '[GC DIGEST] cron could not read mail', text: `The fulfilment cron failed: ${err.message}\nNo shipping emails were processed this run.` });
    } catch (_) { /* best effort */ }
    return res.status(500).json({ error: 'cron failed' });
  }
}

module.exports = handler;
module.exports.run = run;

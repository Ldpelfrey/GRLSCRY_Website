import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.GMAIL_USER = 'site@example.com';
process.env.ORDERS_LINK_SECRET = 'test-link-secret';
const SECRET = 'whsec_test_secret';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

const Stripe = require('stripe');
const real = new Stripe('sk_test_dummy');
const mail = require('../api/_lib/mail.js');
const { setStripe } = require('../api/_lib/stripe.js');
const handler = require('../api/stripe-webhook.js');

const fx = n => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));

let sent, updates, session, piMeta;
beforeEach(() => {
  sent = []; updates = []; session = fx('webhook-session'); piMeta = {};
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  mail.setTransport({ sendMail: async m => { sent.push(m); } });
  setStripe({
    webhooks: real.webhooks,
    checkout: { sessions: { retrieve: async () => session } },
    paymentIntents: {
      retrieve: async () => ({ id: 'pi_3TestAbCdWxyz', metadata: piMeta }),
      update: async (id, body) => { updates.push([id, body]); return {}; },
    },
  });
});

function res() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}
function reqFor(event, { sig, method = 'POST' } = {}) {
  const payload = JSON.stringify(event);
  const header = sig === undefined ? real.webhooks.generateTestHeaderString({ payload, secret: SECRET }) : sig;
  const r = Readable.from([Buffer.from(payload)]);
  r.method = method;
  r.headers = header ? { 'stripe-signature': header } : {};
  return r;
}
const paidEvent = () => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: session.id, payment_status: session.payment_status } } });
async function run(event, opts) { const r = res(); await handler(reqFor(event, opts), r); return r; }

test('valid paid session → 1 mail + NEW metadata', async () => {
  const r = await run(paidEvent());
  assert.equal(r.code, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'site@example.com');
  assert.match(sent[0].subject, /^\[GC ORDER\] GC-\d{6}-WXYZ · M ×1 · Phoenix, AZ$/);
  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], 'pi_3TestAbCdWxyz');
  assert.equal(updates[0][1].metadata.fulfil_status, 'NEW');
  assert.match(updates[0][1].metadata.order_ref, /^GC-\d{6}-WXYZ$/);
  assert.equal(updates[0][1].metadata.size_qty, 'M×1');
  assert.ok(!sent[0].text.includes('!'));
  assert.match(sent[0].text, /api\/orders\?action=submitted&pi=pi_3TestAbCdWxyz&t=/);
  assert.match(sent[0].text, /Paid: \$41\.00 \(Stripe fee est\. \$1\.49, Tapstitch est\. \$16\.97 × 1, net est\. \$22\.54\)/);
});

test('non-POST → 405', async () => {
  const r = await run(paidEvent(), { method: 'GET' });
  assert.equal(r.code, 405);
});

test('bad signature → 400, no mail, no update', async () => {
  const r = await run(paidEvent(), { sig: 't=1,v1=deadbeef' });
  assert.equal(r.code, 400);
  assert.equal(sent.length, 0);
  assert.equal(updates.length, 0);
});

test('missing signature → 400', async () => {
  const r = await run(paidEvent(), { sig: '' });
  assert.equal(r.code, 400);
  assert.equal(sent.length, 0);
});

test('same event twice, 2nd sees fulfil_status → 1 mail total', async () => {
  await run(paidEvent());
  session = fx('webhook-session');
  session.payment_intent.metadata = { fulfil_status: 'NEW' };
  const r = await run(paidEvent());
  assert.equal(r.code, 200);
  assert.equal(sent.length, 1);
  assert.equal(updates.length, 1);
});

test('qty 3 → subject and card say ×3', async () => {
  session.line_items.data[0].quantity = 3;
  await run(paidEvent());
  assert.match(sent[0].subject, /M ×3/);
  assert.match(sent[0].text, /Quantity:\s+3/);
  assert.match(sent[0].text, /Tapstitch est\. \$16\.97 × 3/);
  assert.equal(updates[0][1].metadata.size_qty, 'M×3');
});

test('missing phone → "none given"; legacy shipping_details shape works', async () => {
  delete session.customer_details.phone;
  session.shipping_details = session.collected_information.shipping_details;
  delete session.collected_information;
  await run(paidEvent());
  assert.match(sent[0].text, /Phone:\s+none given/);
  assert.match(sent[0].text, /City:\s+Phoenix/);
});

test('unpaid completed session → 200, no mail', async () => {
  const ev = paidEvent(); ev.data.object.payment_status = 'unpaid';
  const r = await run(ev);
  assert.equal(r.code, 200);
  assert.equal(sent.length, 0);
  assert.equal(updates.length, 0);
});

test('size disagreement → SIZE CHECK line first, metadata size wins', async () => {
  session.client_reference_id = 'TEE-L';
  await run(paidEvent());
  assert.match(sent[0].text, /^SIZE CHECK:/);
  assert.match(sent[0].subject, / M ×1 /);
});

test('size falls back to client_reference_id when metadata missing', async () => {
  session.metadata = {};
  await run(paidEvent());
  assert.match(sent[0].subject, / M ×1 /);
  assert.ok(!sent[0].text.startsWith('SIZE CHECK'));
});

test('paid session that is not a tee (no grlscry_sku, no TEE- ref) → 200, no card', async () => {
  session.metadata = {};
  session.client_reference_id = null;
  const r = await run(paidEvent());
  assert.equal(r.code, 200);
  assert.equal(sent.length, 0);
});

test('charge.refunded → 1 alert mail with order_ref from PI', async () => {
  piMeta = { order_ref: 'GC-260921-WXYZ' };
  const r = await run({ id: 'evt_2', type: 'charge.refunded', data: { object: fx('webhook-refund') } });
  assert.equal(r.code, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].subject, '[GC REFUND] GC-260921-WXYZ');
  assert.match(sent[0].text, /do not fulfil/i);
  assert.equal(updates.length, 0);
});

test('charge.dispute.created → dispute alert', async () => {
  const d = { id: 'dp_1', amount: 4100, payment_intent: 'pi_3TestAbCdWxyz' };
  await run({ id: 'evt_3', type: 'charge.dispute.created', data: { object: d } });
  assert.match(sent[0].subject, /^\[GC DISPUTE\] /);
});

test('unknown event → 200 ignored', async () => {
  const r = await run({ id: 'evt_4', type: 'customer.created', data: { object: {} } });
  assert.equal(r.code, 200);
  assert.equal(r.body.ignored, true);
});

test('mail throws → 500 and NO metadata update', async () => {
  mail.setTransport({ sendMail: async () => { throw new Error('smtp down'); } });
  const r = await run(paidEvent());
  assert.equal(r.code, 500);
  assert.equal(updates.length, 0);
});

test('missing STRIPE_WEBHOOK_SECRET → 500', async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const r = await run(paidEvent());
  assert.equal(r.code, 500);
  assert.equal(sent.length, 0);
});

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.GMAIL_USER = 'site@example.com';
process.env.GMAIL_APP_PASSWORD = 'x';
const mail = require('../api/_lib/mail.js');
const sent = [];
const sendMail = async m => { sent.push(m); };
mail.setTransport({ sendMail });
const cron = require('../api/cron-fulfilment.js');

const NOW = new Date('2026-10-10T15:00:00Z');
const ORDER = '1000000000000000001';
let pis, sessions;

function fakeStripe() {
  return {
    paymentIntents: {
      search: async ({ query }) => {
        const n = /'(\d+)'/.exec(query)[1];
        return { data: Object.values(pis).filter(p => p.metadata.tapstitch_order === n) };
      },
      retrieve: async id => pis[id],
      update: async (id, { metadata }) => { Object.assign(pis[id].metadata, metadata); return pis[id]; },
    },
    checkout: { sessions: { list: async args => {
      if (args.payment_intent) {
        return { data: [{ customer_details: { name: 'Test Person', email: 'buyer@example.com' } }] };
      }
      return { data: sessions };
    } } },
  };
}
beforeEach(() => {
  sent.length = 0;
  pis = { pi_a: { id: 'pi_a', metadata: { fulfil_status: 'SUBMITTED', order_ref: 'GC-261001-AAAA', size_qty: 'M×1', tapstitch_order: ORDER } } };
  sessions = [];
});

const shippedMail = (extra = {}) => ({
  subject: `A shipment from order #${ORDER} is on the way`,
  text: `Order number: | ${ORDER} |\nTracking number: | YT0000000000000001 |\nClassic Loose Boxy Tee Black / M | x1 |`,
  date: NOW, ...extra,
});
const go = emails => cron.run({ fetchMail: async () => emails, stripe: fakeStripe(), sendMail, now: NOW });

function res() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

test('no CRON_SECRET → 500; wrong/no bearer → 401', async () => {
  delete process.env.CRON_SECRET;
  let r = res(); await cron({ headers: {} }, r); assert.equal(r.code, 500);
  process.env.CRON_SECRET = 'cron-test';
  r = res(); await cron({ headers: {} }, r); assert.equal(r.code, 401);
  r = res(); await cron({ headers: { authorization: 'Bearer wrong' } }, r); assert.equal(r.code, 401);
  assert.equal(sent.length, 0);
});

test('shipped email matched → one customer mail (+ digest); rerun → none', async () => {
  const s1 = await go([shippedMail()]);
  assert.equal(s1.shippedSent, 1);
  const customer = sent.filter(m => m.to === 'buyer@example.com');
  assert.equal(customer.length, 1);
  assert.match(customer[0].text, /17track\.net\/en#nums=YT0000000000000001/);
  assert.equal(pis.pi_a.metadata.fulfil_status, 'SHIPPED');
  assert.ok(pis.pi_a.metadata.shipped_mail_at);
  assert.equal(sent.filter(m => m.subject.startsWith('[GC DIGEST]')).length, 1);
  sent.length = 0;
  const s2 = await go([shippedMail()]);
  assert.equal(s2.shippedSent, 0);
  assert.equal(sent.length, 0);
});

test('unmatched → digest only', async () => {
  pis.pi_a.metadata.tapstitch_order = '1000000000000000999';
  const s = await go([shippedMail()]);
  assert.equal(s.unmatched, 1);
  assert.equal(sent.filter(m => m.to === 'buyer@example.com').length, 0);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /^\[GC DIGEST\] 2026-10-10 · 1 items$/);
  assert.equal(sent[0].to, 'site@example.com');
});

test('ambiguous → digest only', async () => {
  pis.pi_b = { id: 'pi_b', metadata: { ...pis.pi_a.metadata, order_ref: 'GC-261001-BBBB' } };
  const s = await go([shippedMail()]);
  assert.equal(s.ambiguous, 1);
  assert.equal(sent.filter(m => m.to === 'buyer@example.com').length, 0);
  assert.equal(pis.pi_a.metadata.shipped_mail_at, undefined);
});

test('size mismatch → digest only, nothing written', async () => {
  pis.pi_a.metadata.size_qty = 'L×2';
  const s = await go([shippedMail()]);
  assert.equal(s.mismatch, 1);
  assert.equal(sent.filter(m => m.to === 'buyer@example.com').length, 0);
  assert.equal(pis.pi_a.metadata.fulfil_status, 'SUBMITTED');
  assert.match(sent[0].text, /L×2/);
});

test('confirmed sets cost once; delivered sets DELIVERED', async () => {
  const confirmed = { subject: `Order #${ORDER} confirmed`, text: `Order number: ${ORDER}\nM / M x1 $1.00\nTotal USD 20.50`, date: NOW };
  await go([confirmed]);
  assert.equal(pis.pi_a.metadata.tapstitch_cost, '20.50');
  pis.pi_a.metadata.fulfil_status = 'SHIPPED';
  await go([{ subject: 'Your order has been delivered', text: `Order number: ${ORDER}\nTracking number: GFUS00000000000001`, date: NOW }]);
  assert.equal(pis.pi_a.metadata.fulfil_status, 'DELIVERED');
});

test('stale NEW (>24h) and stale SUBMITTED without tracking (>7d) → digest', async () => {
  const t = Math.floor(NOW.getTime() / 1000);
  sessions = [
    { metadata: { grlscry_sku: 'TEE-M' }, payment_status: 'paid', created: t - 2 * 86400, payment_intent: { metadata: { fulfil_status: 'NEW', order_ref: 'GC-OLD-NEW1' } } },
    { metadata: { grlscry_sku: 'TEE-M' }, payment_status: 'paid', created: t - 3600, payment_intent: { metadata: { fulfil_status: 'NEW', order_ref: 'GC-FRESH-1' } } },
    { metadata: { grlscry_sku: 'TEE-M' }, payment_status: 'paid', created: t - 9 * 86400, payment_intent: { metadata: { fulfil_status: 'SUBMITTED', order_ref: 'GC-OLD-SUB1' } } },
    { metadata: { grlscry_sku: 'TEE-M' }, payment_status: 'paid', created: t - 9 * 86400, payment_intent: { metadata: { fulfil_status: 'SUBMITTED', tracking: 'YT1', order_ref: 'GC-OK-SUB2' } } },
  ];
  const s = await go([]);
  assert.equal(s.stale, 2);
  assert.match(sent[0].subject, /2 items/);
  assert.match(sent[0].text, /GC-OLD-NEW1/);
  assert.match(sent[0].text, /GC-OLD-SUB1/);
  assert.ok(!/GC-FRESH-1|GC-OK-SUB2/.test(sent[0].text));
});

test('paid tee with no fulfil_status after 1h → digest; non-tee and fresh ones ignored', async () => {
  const t = Math.floor(NOW.getTime() / 1000);
  sessions = [
    { id: 'cs_lost', metadata: { grlscry_sku: 'TEE-L' }, payment_status: 'paid', created: t - 2 * 3600, payment_intent: { metadata: {} } },
    { id: 'cs_justnow', metadata: { grlscry_sku: 'TEE-L' }, payment_status: 'paid', created: t - 600, payment_intent: { metadata: {} } },
    { id: 'cs_other', metadata: {}, payment_status: 'paid', created: t - 5 * 86400, payment_intent: { metadata: {} } },
  ];
  const s = await go([]);
  assert.equal(s.stale, 1);
  assert.match(sent[0].text, /cs_lost/);
  assert.ok(!/cs_justnow|cs_other/.test(sent[0].text));
});

test('nothing to report → no digest', async () => {
  const s = await go([]);
  assert.equal(s.digestSent, false);
  assert.equal(sent.length, 0);
});

test('IMAP failure → 500 and a best-effort mail to Luke', async () => {
  process.env.CRON_SECRET = 'cron-test';
  // handler uses the real IMAP fetch; with no reachable server it must fail closed
  const imap = require('imapflow');
  const orig = imap.ImapFlow;
  imap.ImapFlow = class { async connect() { throw new Error('imap down'); } async logout() {} };
  const { setStripe } = require('../api/_lib/stripe.js');
  setStripe(fakeStripe());
  const r = res();
  await cron({ headers: { authorization: 'Bearer cron-test' } }, r);
  imap.ImapFlow = orig;
  assert.equal(r.code, 500);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /could not read mail/);
});

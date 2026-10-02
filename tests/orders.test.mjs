import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.GMAIL_USER = 'site@example.com';
process.env.GMAIL_APP_PASSWORD = 'x';
process.env.ADMIN_SECRET = 'admin-secret-test';
process.env.ORDERS_LINK_SECRET = 'link-secret-test';
const mail = require('../api/_lib/mail.js');
const sent = [];
mail.setTransport({ sendMail: async m => { sent.push(m); } });
const { setStripe } = require('../api/_lib/stripe.js');
const { signToken } = require('../api/_lib/links.js');
const handler = require('../api/orders.js');

const PI = 'pi_test123456';
let pis;
function fakeStripe() {
  return {
    paymentIntents: {
      retrieve: async id => pis[id],
      update: async (id, { metadata }) => { Object.assign(pis[id].metadata, metadata); return pis[id]; },
    },
    checkout: { sessions: {
      list: async args => {
        const s = { id: 'cs_1', created: 1790000000, payment_status: 'paid', payment_intent: pis[PI],
          customer_details: { name: 'Test Person', email: 'buyer@example.com', address: { city: 'Testville', state: 'AZ' } },
          // Current API shape: shipping lives here and must win over the billing address.
          collected_information: { shipping_details: { name: 'Test Person', address: { city: 'Shipville', state: 'CA' } } } };
        return { data: [s, { ...s, id: 'cs_2', payment_status: 'unpaid' }] };
      },
    } },
  };
}
beforeEach(() => {
  sent.length = 0;
  pis = { [PI]: { id: PI, metadata: { fulfil_status: 'NEW', order_ref: 'GC-261001-ABCD', size_qty: 'M×2' } } };
  setStripe(fakeStripe());
});

function res() {
  return { code: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; } };
}
const admin = { 'x-admin-secret': 'admin-secret-test', 'content-type': 'application/json' };
const call = async req => { const r = res(); await handler(req, r); return r; };
const form = body => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });

test('GET submitted: bad / tampered / expired token → 403', async () => {
  const good = signToken(PI, 'submitted');
  for (const t of ['', 'garbage', good.slice(0, -2) + 'xx', signToken('pi_other123456', 'submitted'), signToken(PI, 'other')]) {
    const r = await call({ method: 'GET', query: { action: 'submitted', pi: PI, t } });
    assert.equal(r.code, 403, t);
  }
  const expired = signToken(PI, 'submitted', -1);
  assert.equal((await call({ method: 'GET', query: { action: 'submitted', pi: PI, t: expired } })).code, 403);
});

test('GET submitted: good token → form with escaped ref, no scripts', async () => {
  pis[PI].metadata.order_ref = 'GC-<b>x</b>';
  const t = signToken(PI, 'submitted');
  const r = await call({ method: 'GET', query: { action: 'submitted', pi: PI, t } });
  assert.equal(r.code, 200);
  assert.match(r.body, /<form method="POST" action="\/api\/orders">/);
  assert.match(r.body, /GC-&lt;b&gt;x&lt;\/b&gt;/);
  assert.ok(!/<script/i.test(r.body));
});

test('POST form valid → SUBMITTED + tapstitch_order; re-entry allowed; then locked', async () => {
  const t = signToken(PI, 'submitted');
  let r = await call(form({ action: 'submitted', pi: PI, t, tapstitch_order: '1000000000000000001' }));
  assert.equal(r.code, 200);
  assert.equal(pis[PI].metadata.fulfil_status, 'SUBMITTED');
  assert.equal(pis[PI].metadata.tapstitch_order, '1000000000000000001');
  // string body, typo correction
  r = await call(form(`action=submitted&pi=${PI}&t=${encodeURIComponent(t)}&tapstitch_order=1000000000000000002`));
  assert.equal(r.code, 200);
  assert.equal(pis[PI].metadata.tapstitch_order, '1000000000000000002');
  pis[PI].metadata.fulfil_status = 'SHIPPED';
  r = await call(form({ action: 'submitted', pi: PI, t, tapstitch_order: '1000000000000000003' }));
  assert.equal(r.code, 409);
  assert.match(r.body, /already SHIPPED/i);
  assert.equal(pis[PI].metadata.tapstitch_order, '1000000000000000002');
});

test('POST form: bad number → 400, bad token → 403', async () => {
  const t = signToken(PI, 'submitted');
  for (const n of ['abc', '123', '12345678901234567890123456', '']) {
    const r = await call(form({ action: 'submitted', pi: PI, t, tapstitch_order: n }));
    assert.equal(r.code, 400, n);
  }
  assert.equal(pis[PI].metadata.fulfil_status, 'NEW');
  const r = await call(form({ action: 'submitted', pi: PI, t: 'bad', tapstitch_order: '1000000000000000001' }));
  assert.equal(r.code, 403);
});

test('admin actions without secret → 401; unknown action → 400; other methods → 405', async () => {
  for (const action of ['list', 'tracking', 'resend']) {
    const noAuth = await call({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { action, pi: PI, tracking: 'YT0000000001' } });
    assert.equal(noAuth.code, 401);
    const wrong = await call({ method: 'POST', headers: { ...admin, 'x-admin-secret': 'nope' }, body: JSON.stringify({ action }) });
    assert.equal(wrong.code, 401);
  }
  assert.equal(pis[PI].metadata.tracking, undefined);
  assert.equal((await call({ method: 'POST', headers: admin, body: { action: 'bogus' } })).code, 400);
  assert.equal((await call({ method: 'PUT', headers: admin })).code, 405);
});

test('list → paid sessions only with the documented fields', async () => {
  const r = await call({ method: 'POST', headers: admin, body: { action: 'list' } });
  assert.equal(r.code, 200);
  assert.equal(r.body.orders.length, 1);
  assert.deepEqual(r.body.orders[0], { pi: PI, created: 1790000000, order_ref: 'GC-261001-ABCD', size_qty: 'M×2',
    name: 'Test Person', city: 'Shipville', state: 'CA', status: 'NEW', tapstitch_order: '', tracking: '', email: 'buyer@example.com' });
});

test('tracking → one customer mail + shipped_mail_at; second call → no second mail', async () => {
  const body = JSON.stringify({ action: 'tracking', pi: PI, tracking: 'YT0000000000000001', tapstitch_order: '1000000000000000001' });
  let r = await call({ method: 'POST', headers: admin, body });
  assert.equal(r.code, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'buyer@example.com');
  assert.equal(sent[0].replyTo, 'site@example.com');
  assert.match(sent[0].text, /17track\.net\/en#nums=YT0000000000000001/);
  const m = pis[PI].metadata;
  assert.equal(m.fulfil_status, 'SHIPPED');
  assert.equal(m.tapstitch_order, '1000000000000000001');
  assert.ok(m.shipped_mail_at);
  r = await call({ method: 'POST', headers: admin, body });
  assert.equal(r.code, 200);
  assert.equal(sent.length, 1);
});

test('tracking validation + resend', async () => {
  let r = await call({ method: 'POST', headers: admin, body: { action: 'tracking', pi: PI, tracking: 'x y' } });
  assert.equal(r.code, 400);
  r = await call({ method: 'POST', headers: admin, body: { action: 'resend', pi: PI } });
  assert.equal(r.code, 400); // no tracking yet
  await call({ method: 'POST', headers: admin, body: { action: 'tracking', pi: PI, tracking: 'YT0000000000000001' } });
  assert.equal(sent.length, 1);
  r = await call({ method: 'POST', headers: admin, body: { action: 'resend', pi: PI } });
  assert.equal(r.code, 200);
  assert.equal(sent.length, 2);
});

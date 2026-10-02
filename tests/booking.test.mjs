// Gate 4: booking still works through the shared mail lib.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

process.env.GMAIL_USER = 'site@example.com';
process.env.GMAIL_APP_PASSWORD = 'x';
const mail = require('../api/_lib/mail.js');
const sent = [];
mail.setTransport({ sendMail: async m => { sent.push(m); } });
const handler = require('../api/booking.js');

function res() {
  return { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

test('valid booking → 200 and one mail from "GRLSCRY Site"', async () => {
  const r = res();
  await handler({ method: 'POST', body: { name: 'Test', email: 't@example.com', message: 'hi' } }, r);
  assert.equal(r.code, 200);
  assert.equal(sent.length, 1);
  assert.match(sent[0].from, /^"GRLSCRY Site" </);
  assert.equal(sent[0].to, 'site@example.com');
});

test('missing message → 400, no mail', async () => {
  const r = res(); const before = sent.length;
  await handler({ method: 'POST', body: { name: 'Test', email: 't@example.com' } }, r);
  assert.equal(r.code, 400);
  assert.equal(sent.length, before);
});

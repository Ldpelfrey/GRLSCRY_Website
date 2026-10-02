import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseTapstitch, sizeQtyToLines, sameLines } = require('../api/_lib/tapstitch-mail.js');
const { shippingEmail } = require('../api/_lib/ship-mail.js');

function fx(name) {
  const raw = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  const m = /^Subject: (.*)\n\n([\s\S]*)$/.exec(raw);
  return m ? { subject: m[1], body: m[2] } : { subject: '', body: raw };
}

test('confirmed', () => {
  const { subject, body } = fx('tapstitch-confirmed.txt');
  const p = parseTapstitch({ subject, text: body });
  assert.equal(p.kind, 'confirmed');
  assert.equal(p.order, '1000000000000000001');
  assert.deepEqual(p.lines, [{ size: 'XL', qty: 2 }]);
  assert.equal(p.total, '163.44');
});

test('shipped (pipe separators)', () => {
  const { subject, body } = fx('tapstitch-shipped.txt');
  const p = parseTapstitch({ subject, text: body });
  assert.equal(p.kind, 'shipped');
  assert.equal(p.order, '1000000000000000001');
  assert.equal(p.tracking, 'YT0000000000000001');
  assert.deepEqual(p.lines, [{ size: 'M', qty: 1 }]);
});

test('delivered', () => {
  const { subject, body } = fx('tapstitch-delivered.txt');
  const p = parseTapstitch({ subject, text: body });
  assert.equal(p.kind, 'delivered');
  assert.equal(p.tracking, 'GFUS00000000000001');
  assert.deepEqual(p.lines, []);
});

test('HTML input, XXL → 2XL, table cells', () => {
  const html = readFileSync(new URL('./fixtures/tapstitch-shipped.html', import.meta.url), 'utf8');
  const p = parseTapstitch({ subject: 'A shipment from order #1000000000000000001 is on the way', html });
  assert.equal(p.kind, 'shipped');
  assert.equal(p.tracking, 'YT0000000000000001');
  assert.deepEqual(p.lines.sort((a, b) => a.size.localeCompare(b.size)), [{ size: '2XL', qty: 1 }, { size: 'S', qty: 2 }]);
});

test('unknown email → kind null', () => {
  assert.equal(parseTapstitch({ subject: 'Welcome to Tapstitch', text: 'Hello' }).kind, null);
  assert.equal(parseTapstitch({}).kind, null);
});

test('size_qty helpers', () => {
  assert.deepEqual(sizeQtyToLines('M×2'), [{ size: 'M', qty: 2 }]);
  assert.ok(sameLines(sizeQtyToLines('M×1, L×1'), [{ size: 'L', qty: 1 }, { size: 'M', qty: 1 }]));
  assert.ok(!sameLines(sizeQtyToLines('M×2'), [{ size: 'M', qty: 1 }]));
});

test('shipping email: subject, tracking link, no exclamation marks', () => {
  const e = shippingEmail({ order_ref: 'GC-261001-ABCD', size_qty: 'M×1', tracking: 'YT0000000000000001', name: 'Test Person' });
  assert.equal(e.subject, 'Your GRLS CRY tee has shipped (GC-261001-ABCD)');
  assert.match(e.text, /https:\/\/t\.17track\.net\/en#nums=YT0000000000000001/);
  assert.ok(!e.text.includes('!') && !e.subject.includes('!'));
  assert.match(e.text, /^Hi Test,/);
});

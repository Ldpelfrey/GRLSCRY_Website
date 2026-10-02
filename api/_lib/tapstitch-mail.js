// api/_lib/tapstitch-mail.js — pure parser for Tapstitch notification emails
// (sender noreply@notify.tapstitch.com). Accepts text and/or HTML.
//
//   parseTapstitch({subject, text, html}) →
//     { kind: 'confirmed'|'shipped'|'delivered'|null, order, tracking, lines:[{size,qty}], total }
//
// Also exports sizeQtyToLines / sameLines for comparing against the
// PaymentIntent size_qty metadata ("M×2").

const SIZE_MAP = { XXL: '2XL', XXXL: '3XL' };

function normSize(s) {
  const u = String(s || '').toUpperCase();
  return SIZE_MAP[u] || u;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function clean(s) {
  return String(s || '').replace(/[| ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseTapstitch({ subject, text, html } = {}) {
  const subj = clean(subject);
  const body = clean(text && String(text).trim() ? text : stripHtml(html));
  const out = { kind: null, order: null, tracking: null, lines: [], total: null };

  if (/\bconfirmed\b/i.test(subj)) out.kind = 'confirmed';
  else if (/shipment .*on the way/i.test(subj)) out.kind = 'shipped';
  else if (/has been delivered/i.test(subj)) out.kind = 'delivered';
  if (!out.kind) return out;

  const om = /Order number:?\s*#?(\d{10,25})/i.exec(body) || /order\s*#\s*(\d{10,25})/i.exec(subj);
  if (om) out.order = om[1];

  const tm = /Tracking number:?\s*([A-Za-z0-9]{6,40})/i.exec(body);
  if (tm) out.tracking = tm[1];

  const bySize = new Map();
  const re = /\/\s*(XXXL|XXL|3XL|2XL|XL|XS|S|M|L)\s*x\s*(\d+)\b/gi;
  let m;
  while ((m = re.exec(body))) {
    const size = normSize(m[1]);
    bySize.set(size, (bySize.get(size) || 0) + Number(m[2]));
  }
  out.lines = [...bySize].map(([size, qty]) => ({ size, qty }));

  const tre = /(?<![A-Za-z])Total\s*(?:USD)?\s*\$?\s*([\d,]+\.\d{2})/gi;
  let last;
  while ((m = tre.exec(body))) last = m[1];
  if (last) out.total = last.replace(/,/g, '');

  return out;
}

// "M×2" or "M×1, L×1" → [{size, qty}]
function sizeQtyToLines(sizeQty) {
  const bySize = new Map();
  const re = /([A-Za-z0-9]+)\s*[×xX]\s*(\d+)/g;
  let m;
  while ((m = re.exec(String(sizeQty || '')))) {
    const size = normSize(m[1]);
    bySize.set(size, (bySize.get(size) || 0) + Number(m[2]));
  }
  return [...bySize].map(([size, qty]) => ({ size, qty }));
}

function sameLines(a, b) {
  const key = l => l.map(x => `${x.size}:${x.qty}`).sort().join(',');
  return key(a) === key(b);
}

module.exports = { parseTapstitch, sizeQtyToLines, sameLines, normSize };

// node tools/autopast_unit.js [index.html]  — runs autoPast (extracted from the page) at fixed clocks.
// Try several zones: for z in America/Phoenix Pacific/Kiritimati Pacific/Pago_Pago UTC; do TZ=$z node tools/autopast_unit.js; done
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(process.argv[2] || require('path').join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/function autoPast\(events\) \{[\s\S]*?return moved\.length \? moved\.reverse\(\)\.concat\(kept\) : events;\n    \}/)[0];

function run(nowIso, events) {
  const R = Date, NOW = R.parse(nowIso);
  function F(...a) { if (!new.target) return new R(NOW).toString(); return a.length ? new R(...a) : new R(NOW); }
  F.prototype = R.prototype; F.now = () => NOW; F.UTC = R.UTC; F.parse = R.parse;
  const ctx = { Date: F, Object, String, Array };
  vm.runInNewContext(src + '; out = autoPast(input);', Object.assign(ctx, { input: events }));
  return ctx.out;
}
const ev = (date, status = 'live', extra = {}) => Object.assign({ date, venue: date, status, link: 'https://t.example/' + date }, extra);
const st = (nowIso, date, status) => run(nowIso, [ev(date, status)])[0].status;
const AZ = s => s + '-07:00';
let fail = 0;
function expect(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
}

// The flip itself
expect('After12 Sun 11:59 AZ stays upcoming', st(AZ('2026-11-15T11:59'), 'Nov 14'), 'live');
expect('After12 Sun 12:00 AZ is past', st(AZ('2026-11-15T12:00'), 'Nov 14'), 'past');
expect('After12 during the set (Sun 02:00) upcoming', st(AZ('2026-11-15T02:00'), 'Nov 14'), 'live');
expect('Nightshift Nov 22 12:01 past', st(AZ('2026-11-22T12:01'), 'Nov 21'), 'past');
// Reviewers' failing cases: forward year / far bookings must stay upcoming
expect('Aug 15 listed Nov 13 (9 months ahead)', st(AZ('2026-11-13T12:00'), 'Aug 15'), 'live');
expect('Mar 6 listed Nov 13', st(AZ('2026-11-13T12:00'), 'Mar 6'), 'live');
expect('Jan 9 listed Nov 13', st(AZ('2026-11-13T12:00'), 'Jan 9'), 'live');
expect('Jan 10 listed Dec 20', st(AZ('2026-12-20T12:00'), 'Jan 10'), 'live');
expect('Jan 1 on Dec 31 (tomorrow)', st(AZ('2026-12-31T20:00'), 'Jan 1'), 'live');
expect('Sep 10 listed Nov 13 (~10 months ahead)', st(AZ('2026-11-13T12:00'), 'Sep 10'), 'live');
// Backward: stale shows still read as played
expect('Nov 14 still listed Jan 5', st(AZ('2027-01-05T12:00'), 'Nov 14'), 'past');
expect('Dec 31 on Jan 1 13:00', st(AZ('2027-01-01T13:00'), 'Dec 31'), 'past');
expect('Dec 31 on Dec 31 22:00 upcoming', st(AZ('2026-12-31T22:00'), 'Dec 31'), 'live');
expect('Oct 1 still live on Nov 13 (43 days stale)', st(AZ('2026-11-13T12:00'), 'Oct 1'), 'past');
// Formats and statuses
for (const d of ['November 14', 'Nov. 14', 'nov 14', 'Nov 14 ']) expect(`format "${d}" parsed`, st(AZ('2026-11-15T12:01'), d), 'past');
for (const d of ['TBA', 'Nov 14-15', '14 Nov', '', 'Sat 14']) expect(`format "${d}" left alone`, st(AZ('2026-11-15T12:01'), d), 'live');
expect('tbd status flips too', st(AZ('2026-11-15T12:01'), 'Nov 14', 'tbd'), 'past');
expect('hand-set past untouched', st(AZ('2026-11-13T12:00'), 'Dec 25', 'past'), 'past');
// Today: identity, no mutation, link cleared on moved copies
const today = [ev('Nov 14'), ev('Nov 21'), ev('Nov 8', 'past')];
expect('today returns the same array', run(AZ('2026-11-13T12:30'), today) === today, true);
const input = [ev('Nov 14', 'live', { note: 'Doors 11' }), ev('Nov 21'), ev('Nov 8', 'past'), null];
const sun = run(AZ('2026-11-15T12:01'), input);
expect('Sunday order', sun.map(e => e && e.date + ':' + e.status), ['Nov 14:past', 'Nov 21:live', 'Nov 8:past', null]);
expect('moved copy has no link/note', [sun[0].link, sun[0].link_text, sun[0].note], ['', '', '']);
expect('input not mutated', [input[0].status, input[0].link.length > 0], ['live', true]);
const nov22 = run(AZ('2026-11-22T12:01'), input);
expect('Nov 22 played order newest first', nov22.filter(e => e && e.status === 'past').map(e => e.date), ['Nov 21', 'Nov 14', 'Nov 8']);
console.log(`TZ=${process.env.TZ || '(system)'}: ${fail ? fail + ' FAILED' : 'all passed'}`);
process.exit(fail ? 1 : 0);

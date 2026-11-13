const path = require('path'); const Module = require('module');
const ROOT = process.argv[2];
// stub nodemailer so the booking handler can run without sending mail
const sent = []; const origLoad = Module._load;
Module._load = function (req, ...a) { if (req === 'nodemailer') return { createTransport: () => ({ sendMail: async m => { sent.push(m); } }) }; return origLoad.call(this, req, ...a); };
const rate = require(path.join(ROOT, 'api/_rate.js'));
const booking = require(path.join(ROOT, 'api/booking.js'));
const save = require(path.join(ROOT, 'api/save-content.js'));
const mk = () => { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = c => { r.code = c; return r; }; r.json = b => { r.body = b; return r; }; return r; };
const out = []; const ok = (n, c) => { out.push((c ? 'PASS ' : 'FAIL ') + n); if (!c) process.exitCode = 1; };
(async () => {
  // limiter unit
  rate._reset(); let t = 1000;
  ok('limiter allows up to the limit', [1,2,3].every(() => rate.hit('k', 3, 100, t)));
  ok('limiter refuses the next', rate.hit('k', 3, 100, t) === false && rate.blocked('k', 3, 100, t));
  ok('limiter frees after the window', rate.hit('k', 3, 100, t + 101) === true);
  ok('clientIp takes the first forwarded address', rate.clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }) === '1.2.3.4');
  // booking
  rate._reset(); process.env.GMAIL_USER = 'x@example.com'; process.env.GMAIL_APP_PASSWORD = 'p';
  const post = (ip, body) => ({ method: 'POST', headers: { 'x-forwarded-for': ip }, body });
  const good = { name: 'A', email: 'a@b.co', inquiry_type: 'DJ Booking', message: 'hi' };
  const codes = []; for (let i = 0; i < 7; i++) { const r = mk(); await booking(post('9.9.9.9', good), r); codes.push(r.code); }
  ok('booking: 5 sends then 429 for one address ' + codes.join(','), codes.join(',') === '200,200,200,200,200,429,429' && sent.length === 5);
  let r = mk(); await booking(post('8.8.8.8', good), r); ok('booking: another address still sends', r.code === 200);
  r = mk(); await booking(post('7.7.7.7', { name: 'A', email: 'bad', message: 'x' }), r); ok('booking: invalid email is 400 and not counted', r.code === 400);
  r = mk(); await booking(post('6.6.6.6', { ...good, 'bot-field': 'x' }), r); ok('booking: honeypot still 200, nothing sent', r.code === 200 && sent.length === 6);
  r = mk(); await booking(post('5.5.5.5', { ...good, name: 'Evil\r\nBcc: x@y.z' }), r);
  ok('booking: line breaks stripped from header fields', r.code === 200 && !/[\r\n]/.test(sent[sent.length - 1].subject) && !/[\r\n]/.test(sent[sent.length - 1].replyTo));
  rate._reset(); sent.length = 0; let n200 = 0, n429 = 0;
  for (let i = 0; i < 45; i++) { const q = mk(); await booking(post('10.0.0.' + i, good), q); if (q.code === 200) n200++; if (q.code === 429) n429++; }
  ok('booking: 40 an hour in total, then 429 (' + n200 + '/' + n429 + ')', n200 === 40 && n429 === 5);
  // admin save
  rate._reset(); process.env.ADMIN_SECRET = 'right-secret'; delete process.env.GITHUB_TOKEN;
  const auth = (ip, secret) => ({ method: 'POST', headers: { 'x-forwarded-for': ip, 'x-admin-secret': secret }, body: { verify: true } });
  const ac = []; for (let i = 0; i < 9; i++) { const q = mk(); await save(auth('3.3.3.3', 'wrong'), q); ac.push(q.code); }
  ok('admin: 8 wrong passwords are 401, the 9th is 429 ' + ac.join(','), ac.join(',') === '401,401,401,401,401,401,401,401,429');
  r = mk(); await save(auth('3.3.3.3', 'right-secret'), r); ok('admin: a blocked address is refused even with the right password', r.code === 429);
  r = mk(); await save(auth('4.4.4.4', 'right-secret'), r); ok('admin: right password from another address is 200', r.code === 200);
  rate._reset(); for (let i = 0; i < 20; i++) { r = mk(); await save(auth('2.2.2.2', 'right-secret'), r); }
  ok('admin: correct logins are never limited', r.code === 200);
  console.log(out.join('\n'));
})();

// api/booking.js — the booking form's mail sender (replaced Netlify Forms).
//
// Sends the booking inquiry straight to the band's own Gmail over Gmail's SMTP.
// No third-party email service holds or relays the message.
//
// Required env:
//   GMAIL_USER          — the sending Gmail address (GRLSCRYOfficial@gmail.com)
//   GMAIL_APP_PASSWORD  — a Google App Password (16 chars, needs 2-Step
//                         Verification enabled). NOT the account password.
// Optional:
//   BOOKING_TO          — destination; defaults to GMAIL_USER (mails itself)
//
// Fails closed: with no credentials the endpoint returns 500 rather than
// silently accepting inquiries that go nowhere. A booking form that appears
// to work while discarding submissions is worse than one that visibly errors.

const nodemailer = require('nodemailer');

const MAX_FIELD = 5000;
let transport;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  // Honeypot: real people never fill this. Return 200 so bots learn nothing.
  if (body['bot-field']) {
    console.warn('booking: honeypot tripped, discarded');
    return res.status(200).json({ ok: true });
  }

  const name    = str(body.name);
  const email   = str(body.email);
  const type    = str(body.inquiry_type);
  const message = str(body.message);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address does not look valid.' });
  }
  if ([name, email, type, message].some(v => v.length > MAX_FIELD)) {
    return res.status(413).json({ error: 'That message is too long.' });
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error('booking: GMAIL_USER or GMAIL_APP_PASSWORD is not set');
    return res.status(500).json({
      error: 'Booking is temporarily unavailable. Please email us directly.',
    });
  }
  const to = process.env.BOOKING_TO || user;

  try {
    // Reuse the transport across warm invocations.
    transport = transport || nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    await transport.sendMail({
      // From must be the authenticated account or Gmail rewrites/rejects it.
      from: `"GRLSCRY Site" <${user}>`,
      to,
      replyTo: `"${name.replace(/"/g, '')}" <${email}>`,
      subject: `Booking inquiry — ${name}${type ? ` (${type})` : ''}`,
      text:
        `New booking inquiry from grlscry.com\n\n` +
        `Name:    ${name}\n` +
        `Email:   ${email}\n` +
        `Type:    ${type || '(not specified)'}\n\n` +
        `Message:\n${message}\n\n` +
        `— Reply directly to this email to reach them.\n`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('booking: send failed', err && err.message);
    return res.status(502).json({
      error: 'Could not send that just now. Please email us directly.',
    });
  }
};

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

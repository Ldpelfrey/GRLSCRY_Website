// api/booking.js — replaces Netlify Forms, which has no Vercel equivalent.
//
// Accepts the booking form POST, validates it, drops anything that trips the
// honeypot, and emails the inquiry to BOOKING_TO via Resend.
//
// Required env:
//   RESEND_API_KEY  — from resend.com (free tier: 100/day, 3000/month)
//   BOOKING_TO      — destination address (GRLSCRYOfficial@gmail.com)
// Optional:
//   BOOKING_FROM    — defaults to Resend's shared onboarding sender, which
//                     works with no domain verification. Set this to an
//                     address on a verified domain when one exists.
//
// Fails closed: with no RESEND_API_KEY the endpoint returns 500 rather than
// silently accepting inquiries that go nowhere. A booking form that appears
// to work but discards submissions is worse than one that visibly errors.

const MAX_FIELD = 5000;

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

  const key = process.env.RESEND_API_KEY;
  const to  = process.env.BOOKING_TO;
  if (!key || !to) {
    console.error('booking: RESEND_API_KEY or BOOKING_TO is not set');
    return res.status(500).json({
      error: 'Booking is temporarily unavailable. Please email us directly.',
    });
  }
  const from = process.env.BOOKING_FROM || 'GRLSCRY Site <onboarding@resend.dev>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Booking inquiry — ${name}${type ? ` (${type})` : ''}`,
        text:
          `New booking inquiry from grlscry.com\n\n` +
          `Name:    ${name}\n` +
          `Email:   ${email}\n` +
          `Type:    ${type || '(not specified)'}\n\n` +
          `Message:\n${message}\n`,
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('booking: Resend error', r.status, detail.slice(0, 300));
      return res.status(502).json({
        error: 'Could not send that just now. Please email us directly.',
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('booking: unexpected error', err);
    return res.status(500).json({
      error: 'Could not send that just now. Please email us directly.',
    });
  }
};

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

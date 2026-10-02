// api/_lib/mail.js — the one Gmail SMTP transport every function shares.
// Files under api/_lib are not deployed as endpoints (underscore prefix).
//
//   sendMail({ to, subject, text, replyTo?, fromName? }) → Promise<void>
//   mailConfigured() → boolean
//
// Throws on send failure so callers decide whether that is a 5xx.
// Tests replace the transport with setTransport({ sendMail: async () => {} }).

const nodemailer = require('nodemailer');

let transport;

function mailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function setTransport(t) { transport = t; }

async function sendMail({ to, subject, text, replyTo, fromName = 'GRLS CRY' }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!transport) {
    if (!user || !pass) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not set');
    // Reuse the transport across warm invocations.
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
    });
  }
  // From must be the authenticated account or Gmail rewrites/rejects it.
  await transport.sendMail({ from: `"${fromName}" <${user}>`, to, subject, text, replyTo });
}

module.exports = { sendMail, mailConfigured, setTransport };

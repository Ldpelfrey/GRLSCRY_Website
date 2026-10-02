// api/_lib/stripe.js — lazy Stripe client (STRIPE_SECRET_KEY, a restricted key:
// Checkout Sessions Read + Payment Intents Write). Stripe is the order database:
// fulfilment state lives in PaymentIntent metadata, never in git.
//
// PaymentIntent metadata keys (the whole contract between functions):
//   fulfil_status    NEW | SUBMITTED | SHIPPED | DELIVERED
//   order_ref        GC-<yymmdd>-<4 chars>
//   size_qty         e.g. "M×2"
//   tapstitch_order  Tapstitch order number, entered by Luke on "Mark submitted"
//   tracking         tracking number (from the Tapstitch email or pasted in admin)
//   tapstitch_cost   Tapstitch total in USD for this order, from its "confirmed" email
//   shipped_mail_at  ISO time the customer shipping email went out (idempotency)

const Stripe = require('stripe');

let client;

function getStripe() {
  if (client) return client;
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error('STRIPE_SECRET_KEY is not set');
  client = new Stripe(k);
  return client;
}

function setStripe(c) { client = c; }

module.exports = { getStripe, setStripe };

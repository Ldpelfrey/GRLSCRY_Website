# PROMPT: Automate GRLS CRY tee orders (orchestrated build)

Paste this into a fresh Claude Code session opened in
`~/Documents/dj-outreach-automation/GRLSCRY_Website/`. You are the **orchestrator**.
You plan, dispatch, audit, and integrate. Builders write code; you verify artifacts.

---

## 0. Read first (orchestrator, before anything else)

1. `CLAUDE.md` in this repo (the runbook). Pay attention to the Shop section, `.vercelignore`, the env var table, and the CSP in `vercel.json`.
2. Vault master note `Projects/GRLSCRY-Website.md` and `ai-pipeline/Projects/grlscry-website/GRLSCRY-Shop.md` (use the obsidian-vault MCP).
3. `tools/stripe_setup.py`. Payment Links already carry `metadata.grlscry_sku` and `metadata.size`, collect a US shipping address, and the site appends `client_reference_id=TEE-<size>`.
4. `api/booking.js`. Reuse its nodemailer/Gmail transport pattern. Do not add a second mail provider.

## 1. Facts that constrain the design (do not re-litigate)

- **Checkout:** Stripe Payment Links, one per size, $35 + $6 flat shipping, US only, qty 1–5. Keep them exactly as they are. Don't add a cart, a modal, or a size dropdown.
- **Fulfilment:** Tapstitch, product `RU0034` (black Classic Loose Boxy Tee), always US fulfilment. Tapstitch has **no public API**. It only auto-imports orders from Shopify, WooCommerce, or Etsy store integrations.
- **Hosting:** Vercel. `main` is production and **any push deploys**.
- **The repo is PUBLIC.** No customer name, address, email, or order data may ever be written to git, `content.json`, or any file that `api/save-content.js` commits. Stripe is the order database.
- **Cost rule:** use no new paid services. Don't move to Shopify. Vercel Hobby cron (once a day), Stripe metadata, and the existing Gmail app password cover everything below.

## 2. Target pipeline

```
Customer pays on a Payment Link
  └─► Stripe webhook  checkout.session.completed
        └─► api/stripe-webhook.js   (signature-verified, idempotent)
              ├─ writes metadata on the PaymentIntent:
              │    fulfil_status=NEW, order_ref=GC-<yymmdd>-<4 char>
              └─ emails Luke a FULFILMENT CARD (fields in Tapstitch's form order,
                 one copy-paste block, plus a one-click "Mark submitted" link)

Luke enters the order in Tapstitch (~2 min, the ONLY manual step)
  └─► clicks "Mark submitted" → api/orders.js sets fulfil_status=SUBMITTED

Daily Vercel cron  api/cron-fulfilment.js
  ├─ IMAP-reads Luke's Gmail for Tapstitch shipment emails since the last run
  ├─ parses carrier + tracking, matches to an order (name + size + date window)
  ├─ sets fulfil_status=SHIPPED, tracking=<…> on the PaymentIntent
  ├─ emails the customer a shipping notice (plain, on-brand, no exclamations)
  └─ emails Luke a digest: NEW older than 24h, SUBMITTED with no tracking
     after 7 days, unmatched shipment emails, refunds/disputes

/admin "Orders" tab (behind the existing ADMIN_SECRET)
  └─ lists the last 50 paid sessions with status, lets Luke paste tracking by hand
     if the parser misses one, and resend the shipping email
```

What gets automated: order capture, Luke's alert, the formatted entry sheet, status tracking, tracking-number capture, the customer shipping email, stale-order chasing, and a per-order profit line ($35 + $6 − Stripe fee − $16.97 production − Tapstitch shipping). What stays manual: typing the order into Tapstitch. Phase 0 tests whether even that step can go.

## 3. Phase 0: spike (orchestrator, solo, read-only, ~20 min)

Answer these and write them to `ORDERS-SPIKE.md` (gitignored and vercelignored) before dispatching any builder:

1. Log into tapstitch.com/stores, **or ask Luke** for a screenshot of it. Which integrations does the account list, and does any of them accept a generic or custom store?
2. **WooCommerce emulation feasibility.** Tapstitch links a store by calling the WooCommerce REST API (`/wp-json/wc/v3/...`) with a consumer key/secret. Record what it calls during link and order sync, if that's knowable without building anything. **Recommendation default: do NOT build a fake WooCommerce endpoint.** It's undocumented, it breaks silently, and it puts a $709-dispute-sized risk on a silent failure. Report what you find and let Luke decide. The pipeline above doesn't depend on it.
3. Get a real Tapstitch shipment email from Luke's inbox (Gmail MCP `search_threads` for `from:tapstitch`). Record the sender, subject pattern, and where the carrier, tracking number, and recipient name appear. If none exists yet, because the test order is still pending, build the parser against a fixture marked UNVERIFIED and flag it in the final report.
4. Confirm whether the Tapstitch order form wants a single address line or two, the phone requirement, and the size labels. The fulfilment card copies this order exactly.

## 4. Agent orchestration

Follow these rules (from past multi-agent builds):
- **At most 2 builders in parallel, both Sonnet.** You (orchestrator) stay on Opus.
- Each builder prompt is **self-contained and resume-scoped**: list the files it owns, the files it must not touch, its acceptance tests, and say "report changed files + test output only".
- **Audit artifacts, not reports.** After each builder finishes, you read its diff and run its tests yourself. A builder saying "done, all tests pass" is not evidence.
- Builders work in **git worktrees** (`isolation: "worktree"`) on branch `orders-automation`. Nothing touches `main`.

### Builder A: capture + alert (owns: `api/stripe-webhook.js`, `api/_lib/stripe.js`, `api/_lib/mail.js`, `tests/webhook.test.mjs`)
- Raw-body handling (set `bodyParser: false` in the function's config) plus **`Stripe-Signature` verification** with `STRIPE_WEBHOOK_SECRET`. Reject with a 400 on mismatch.
- Use only the `stripe` npm SDK. Add it to `package.json` and add nothing else.
- **Idempotent:** if the PaymentIntent already has `fulfil_status`, return a 200 and send nothing. Stripe retries, so test a double delivery.
- Pull line items, size from `metadata.size`, quantity, shipping name and address, phone, and email from the expanded session.
- Write `fulfil_status`, `order_ref`, and `size_qty` to PaymentIntent metadata.
- Fulfilment card email to `BOOKING_TO`, with the subject `[GC ORDER] <order_ref> · <size> ×<qty> · <city, ST>`. The body is a fixed-order copy-paste block that matches Phase 0 item 4, then the "Mark submitted" link. That link is an HMAC-signed URL (`ORDERS_LINK_SECRET`, expiring in 14 days) that hits `api/orders.js?action=submitted`. It is **not** the admin secret in a query string.
- Move the shared nodemailer transport into `api/_lib/mail.js`, and make `booking.js` import it with no behaviour change.
- Tests use Node's built-in `node:test`, no new test framework. Cover: valid signature → metadata set + 1 email (mail transport stubbed), bad signature → 400, same event twice → 1 email, qty 3 → card says ×3, missing phone → card says "none given".

### Builder B: status + tracking + admin (owns: `api/orders.js`, `api/cron-fulfilment.js`, `api/_lib/tapstitch-mail.js`, the `Orders` tab in `admin/index.html`, `tests/orders.test.mjs`, the `crons` block in `vercel.json`)
- `api/orders.js`:
  - `GET list` returns the last 50 paid sessions with status. Auth is `ADMIN_SECRET`, same scheme as `save-content.js`.
  - `POST tracking` (admin auth) sets tracking + SHIPPED and sends the customer email.
  - `GET submitted` works with the signed link only.
  - **Every route rejects without auth.** Never ship a world-writable endpoint (LIVVIEP lesson).
- `api/cron-fulfilment.js`:
  - Protected by Vercel's `CRON_SECRET` bearer.
  - Reads Gmail over IMAP with the existing `GMAIL_USER`/`GMAIL_APP_PASSWORD`. Use `imapflow` as the one new dependency, and justify it in the report.
  - The parser lives in `api/_lib/tapstitch-mail.js` and is a pure function, so it can be tested against fixtures.
  - Matches on recipient name (normalised) + size + paid within the last 30 days. **Ambiguous or unmatched → no customer email.** It goes into Luke's digest instead. Never guess.
  - Sends the customer shipping email (order_ref, size, carrier, tracking link). Then sends Luke's digest, which is skipped when there's nothing to report.
- Add one `crons` entry to `vercel.json` (daily, 15:00 UTC). **Do not touch the CSP block.** If the admin tab needs a new `connect-src`, stop and report instead of editing it.
- Admin Orders tab: a table with ref, date, size×qty, city/state, status, and tracking. Use the inline "paste tracking" + "resend" actions. Everything that goes into `innerHTML` passes through the existing `esc()`.
- Tests: parser on the Phase 0 fixture(s), match/ambiguous/unmatched, unauth → 401 on every route, an expired or tampered signed link → 403.

### Sequencing
1. Phase 0 (orchestrator).
2. Builder A and Builder B **in parallel**. B stubs `api/_lib/mail.js` against A's interface: `sendMail({to, subject, text})`. Give both builders that signature up front.
3. Orchestrator integrates: merge both worktrees into `orders-automation` and run all tests.
4. **Auditor** (a fresh Sonnet agent with no build context, read-only) gets the diff plus this section's gates and returns PASS/FAIL per gate with evidence (command + output). Fix the FAILs, then re-audit only those gates.

## 5. Gates (all must PASS before asking Luke to deploy)

| # | Gate | How to check |
|---|---|---|
| 1 | No PII can reach git | `grep` every write path; `save-content.js` ALLOWED_KEYS unchanged; `git diff main` has no fixtures with real names (fixtures use fake names). |
| 2 | Every new endpoint rejects unauthenticated calls | curl each route against `vercel dev` with no secret, a wrong secret, and a tampered link. |
| 3 | Webhook verifies signatures and is idempotent | tests + `stripe trigger checkout.session.completed` against a test-mode endpoint, if the Stripe CLI is installed, otherwise a locally signed payload |
| 4 | Booking form unchanged | existing booking test call still returns 200 with the new shared mail lib |
| 5 | CSP + `.vercelignore` unchanged except the cron block | `git diff main -- vercel.json .vercelignore` |
| 6 | Only the deps named here were added | `git diff main -- package.json` |
| 7 | End to end in **Stripe TEST mode** | real test-mode Payment Link purchase (card 4242…) on a **Vercel preview deploy** → fulfilment card arrives → Mark submitted → paste tracking in admin → customer email arrives at a test inbox |
| 8 | Runbook updated | `CLAUDE.md` Shop section + env var table list `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` (restricted: Checkout Sessions read, PaymentIntents write), `ORDERS_LINK_SECRET`, `CRON_SECRET`, and the "only manual step" |

## 6. Stop and ask Luke before (do not proceed on your own)

- Any `git push`. A push to `main` deploys production. Preview deploys come from the branch only.
- Creating the **live-mode** webhook endpoint, or any live-mode Stripe write.
- `vercel env add` for each secret. Luke mints the secrets into a chmod-600 file; never paste them in chat.
- Building the WooCommerce emulation (Phase 0 item 2), even if it looks easy.
- Anything that sends an email to a real customer address.

## 7. Final report (to Luke, short)

- The gate table with PASS/FAIL.
- What is now automatic vs still manual, in one line each.
- Anything UNVERIFIED, especially the tracking parser if no real Tapstitch shipment email existed.
- The exact remaining commands for Luke to approve: env adds, live webhook creation, merge to `main`.
- Then update the vault note `GRLSCRY-Shop.md` (detail) and the `project-grlscry-shop` memory (one line). Do both, not one.

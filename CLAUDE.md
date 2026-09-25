# GRLSCRY_Website

DJ portfolio, booking, and merch site for GRLS CRY (Scottsdale, AZ). Live at
**https://grlscry.com**.

## ⚠️ Current state (2026-09-12) — `vercel-migration` branch, cutover in progress

`grlscry.com` still serves from **Netlify**. DNS is **Netlify DNS** (NS1
nameservers), the registrar is **Namecheap**, and the zone has **no MX or TXT
records**, so moving DNS cannot break any email.

Vercel project `grlscry-site` (linked locally via `.vercel/`), **already connected
to GitHub** — the production branch is `main`, so **any push deploys**. Production
env has `GMAIL_USER`, `BOOKING_TO`, and `ADMIN_SECRET` (**rotated 2026-09-13**,
verified working; the value lives in `~/.config/grlscry/credentials-local.json`,
never in the repo). The current build is live on `grlscry-site.vercel.app`.

**Cutover order. Do not reorder it:**

1. **Vercel env (Production).** Add `GMAIL_APP_PASSWORD` — without it booking
   returns 500. Add `GITHUB_TOKEN` — fine-grained, Contents read/write on this
   repo only. **Do not use the `gh` CLI token**: it has `repo` scope over every
   repo. Luke fills both in `~/.config/grlscry/credentials-local.json`, and they
   get piped into `vercel env add` without being printed. ✅ `ADMIN_SECRET` is done.
2. ✅ GitHub is already connected. Nothing to do.
3. **Deploy production and verify on `grlscry-site.vercel.app`**: a real booking
   email arrives, and one admin publish lands a commit.
4. **Add `grlscry.com` + `www.grlscry.com` to the project**, then at Namecheap set
   nameservers to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. **Keep the Netlify
   site running during propagation** — both hosts then serve a working site.
5. After propagation: `git push origin vercel-migration:main` (a fast-forward of
   `origin/main`), then delete the Netlify site. Only after that, remove
   `netlify/` and `_headers`.

**Branch `cinematic-logo`** (2026-09-24, off `vercel-migration`, pushed to origin as its own branch; V1 approved): jelly-logo H1 over a
looping plate of GRLS CRY's own footage (`images/hero/`, provenance in `images/brand/MANIFEST.md`,
spec in `PROMPT-cinematic-jelly-logo.md`). The letter scatter is gone; the H1 is an image now.
Merge into `vercel-migration` only after Luke approves the look.

Fallback: branch `shop-netlify` is the shop on the Netlify setup, in case the
cutover is abandoned. Local `main` is untouched at `47a73bb`.

## What it is

One hand-written `index.html` (~2,780 lines) with all HTML, CSS, and JS inline.
**No build step, no framework, no npm install, no bundler.** Edit the file, load
it in a browser. Third-party code is CDN `<script>` tags only.

## File layout

| Path | Purpose |
|---|---|
| `index.html` | The entire site. Markup, CSS, JS, structured data. |
| `content.json` | Flat CMS file. Fetched on load; JS injects values by element id. |
| `admin/index.html` | Password-gated panel that edits `content.json` and publishes it. |
| `api/save-content.js` | Vercel function: commits `content.json` to GitHub. |
| `api/booking.js` | Vercel function: sends booking-form mail via nodemailer. |
| `netlify/functions/save-content.js` | The Netlify twin of `save-content`. Still live. |
| `_headers` | Netlify security headers + CSP. **Currently the live one.** |
| `vercel.json` | Vercel headers + CSP. Mirror of `_headers`. |
| `.vercelignore` | What deploys leave out (`CLAUDE.md`, `netlify/`, `_headers`, `README.md`). `.gitignore` does not control deploys. |
| `images/` | Photography, OG cover, tee mockups. |

`_headers` and `vercel.json` carry the same CSP. **Change both together** —
whichever host is live, the other is one push away from being live.

## Content pipeline

1. `admin/index.html` fetches `/content.json`, fills the form (`populateForm`).
2. On save, `collectData()` rebuilds the whole object and POSTs it with an
   `x-admin-secret` header.
3. The function validates the shape against `ALLOWED_KEYS` and commits the file
   to GitHub, which triggers a deploy.
4. `index.html` fetches `/content.json` on load and injects it.

**Adding a content key means touching four places:** `content.json`, the
hydration block at the bottom of `index.html`, `populateForm`/`collectData` in
`admin/index.html`, and `ALLOWED_KEYS` in **both** `save-content.js` files. Miss
the last one and every admin save fails with a 422.

Everything from `content.json` lands in `innerHTML`, so it goes through `esc()`
on the way out. URLs go through `safeUrl()`; asset paths through `safeAsset()`.

## Required environment variables

Set on whichever host is live:

| Var | Used by | Without it |
|---|---|---|
| `ADMIN_SECRET` | `save-content` | Endpoint 500s; admin cannot log in. |
| `GITHUB_TOKEN` | `save-content` | Login works, publishing 500s. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | `api/booking.js` | Booking form errors. |

**`ADMIN_SECRET` is verified NOT set on the live Netlify site** (the function
returns 500 `ADMIN_SECRET not set`). Nothing is set on Vercel yet. `GITHUB_TOKEN`
status is unknown. The admin save path has never been tested end to end.

## Sections

Hero → About → Shows (`#events`) → Sound (`#music`) → Artist → **Shop** →
Book (`#contact`) → Footer.

Note the ids do not match the labels: Shows is `#events`, Sound is `#music`,
Book is `#contact`.

## Shop

One product, one size choice, one button. `#shop`, so `grlscry.com/#shop` works
as an Instagram bio link.

- **Product:** GRLS CRY boxy tee, $35 + $6 shipping, sizes XS–3XL at a flat
  price. Production cost $16.97 (US fulfilment), net ≈ $18.10.
- **Checkout:** Stripe hosted, via `<stripe-buy-button>`. It **redirects** rather
  than opening a modal — deliberate, a modal fights Lenis for scroll lock. Do not
  replace it with an overlay cart.
- **Fulfilment is manual.** Tapstitch has no public API. Orders are typed in by
  hand.
- **One Stripe buy button per size**, all $35, each product named with its size
  ("GRLS CRY Boxy Tee — M"). The size prints on the customer's receipt, and there
  is no second size input to disagree with the page. `content.json` holds
  `stripe_buy_button_ids: {size: id}`. A size with no id shows as "unavailable".
  The button reads its attributes at mount, so it is rebuilt on every size change;
  `client-reference-id` (`TEE-M`) repeats the size as a dashboard cross-check.
  **Never add a Stripe size dropdown on top of this.**
- **Not yet live.** The publishable key and all per-size ids are empty. With no
  key or no ids, the section shows a disabled "Checkout opening soon" button.
  Fill them in the admin panel's Shop card (one input per size).
- **Mockups:** `images/tee-front.jpg` / `tee-back.jpg`, cut out of Luke's own
  `~/Pictures/Merch-Mockup-goodbadgirls.png` using its alpha channel, on 4:5
  `#1A1A1A` cards. ⚠️ The mockup puts the front print on the **left chest**, but
  the product docs say **centered chest**. The photo must match what Tapstitch
  prints.
- `size_chart`, when set to a relative image path or an https URL, shows a
  "Size chart ↗" link under the size buttons. Hidden when empty or sold out.
- `sold_out: true` is the drop mechanic — one toggle in the admin panel swaps the
  button for "SOLD OUT" and hides the size picker.
- Store policies (shipping / refunds / terms / privacy / contact) are a
  collapsible block in the footer. Stripe expects these published before a live
  account sells.

## Motion — the fragile part

GSAP 3.12 + ScrollTrigger, Lenis smooth scroll, SoundCloud Widget API, all from
CDN. ~48 ScrollTriggers. The page has heavy scroll cinematics and a sticky bottom
audio player.

**Inserting a section shifts every trigger below it.** When you add one:

- Call `ScrollTrigger.refresh()` once content and images have settled.
- Give every image an explicit `aspect-ratio` or `width`/`height` so the box is
  reserved before the file decodes. A late reflow silently breaks the triggers
  underneath.
- Keep motion inside the existing `if (!reduceMotion)` gate.
- Reveal-on-scroll uses `class="r"` plus `d1`–`d5` for stagger.

After any structural change, load the page and check: hero letter-scatter
(`.gl-l`), Artist parallax (`.art-bg`), the Shows table, and the sticky player.
A diff cannot tell you these still work.

## Local development

```sh
python3 -m http.server 8899     # then open http://localhost:8899/
```

Static serving is enough for everything except the two serverless functions —
the booking form and admin publishing will fail locally, which is expected.

## Gotchas

- Large image pushes need `git config http.postBuffer 524288000` (already set).
- Stale `.git/index.lock` is common: `rm -f .git/index.lock` and retry.
- Event data is duplicated in three places: the JSON-LD block in `<head>`, the
  hardcoded Shows table, and `content.json`. Keep all three in sync. Never emit a
  past event as upcoming.
- CSP is strict. Any new third-party origin must be added to **both** `_headers`
  and `vercel.json` or it is silently blocked.
- `.r` elements start at `opacity: 0` and are revealed by GSAP. Under
  `prefers-reduced-motion` that JS is skipped, so a CSS rule forces them visible.
  Don't remove it — without it, reduced-motion users see empty sections.

## Do not push without asking.

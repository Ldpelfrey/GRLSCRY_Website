# GRLSCRY_Website

DJ portfolio, booking, and merch site for GRLS CRY (Scottsdale, AZ). Live at
**https://grlscry.com**.

## ⚠️ Current state — read before deploying

**The live site and this repo are not the same thing.**

- `grlscry.com` currently serves from **Netlify** (verified: `server: Netlify`
  in the response headers).
- Local `main` is **2 commits ahead of `origin/main`**, and those two commits
  (`97239ce`, `47a73bb`) **migrate the site from Netlify to Vercel** — they add
  `vercel.json`, `api/*.js`, and `package.json`, and repoint the admin panel and
  the booking form at `/api/…`.
- Those commits have never been deployed. Pushing them to a repo that Netlify
  still builds will publish a Vercel-shaped site to Netlify: `/api/booking` and
  `/api/save-content` do not exist there, so **the booking form and the admin
  panel would both break.**

Decide the host before pushing. Either finish the Vercel cutover (point the
domain at Vercel, set the env vars there) or revert the migration. Do not push
"just the content change" without resolving this.

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
| `images/` | Photography and OG cover. WebP with JPG fallback. |

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

**Neither `ADMIN_SECRET` nor `GITHUB_TOKEN` has been confirmed set.** The admin
save path has never been tested end to end.

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
- **Size reaches fulfilment via `client_reference_id`** (`TEE-M`, `TEE-2XL`, …),
  visible on the payment in the Stripe dashboard. A buy button maps to one price
  and reads its attributes at mount, so the element is destroyed and rebuilt on
  every size change. That is why size selection is required before the button
  appears.
- **Not yet live.** `stripe_buy_button_id` and `stripe_publishable_key` are empty
  in `content.json`; until both are filled the section shows a disabled
  "Checkout opening soon" button. Fill them in the admin panel.
- **Product mockups do not exist yet.** `images/tee-front.jpg` and
  `images/tee-back.jpg` are referenced but absent, so both figures render as
  labelled placeholder boxes. Drop the files in at 4:5 and they appear.
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

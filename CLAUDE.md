# GRLSCRY_Website

DJ portfolio, booking, and merch site for GRLS CRY (Scottsdale, AZ). Live at
**https://grlscry.com**.

## Current state (2026-10-29): LIVE ON VERCEL (cutover 2026-09-25)

`grlscry.com` and `www.grlscry.com` are served by **Vercel** project `grlscry-site`
(linked locally via `.vercel/`). DNS is **Vercel DNS** (`ns1/ns2.vercel-dns.com`, set at
**Namecheap** 2026-09-24; the zone has no MX/TXT records, so no email depends on it).
GitHub is connected: **`main` is production, any push to `main` deploys.**

Production env has all five: `ADMIN_SECRET`, `GITHUB_TOKEN` (fine-grained, this repo
only), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `BOOKING_TO`. Values live in
`~/.config/grlscry/credentials-local.json`, never in the repo, and get piped into
`vercel env add` without being printed.

Verified 2026-09-24/25: test booking returned 200 (inbox arrival is Luke's to confirm);
admin login 200 and bad secret 401; an admin publish committed `c3603be` to `main`
(the only change was the trailing newline of `content.json`); valid HTTPS on both
hostnames.

**Netlify is gone.** Luke deleted the `grlscry` Netlify project on 2026-09-25, and
`netlify/` + `_headers` were removed from the repo the same day. The old
`shop-netlify` branch is history only; there is no Netlify fallback any more.

The 3D jelly-logo hero (V1, approved) shipped with the cutover. Since 2026-09-25 the hero plate **rotates through 4 clips of 7.mov in shuffled order** (two stacked `<video>`s, 1 s crossfade, each clip once per round, no back-to-back repeats; Low Power Mode falls back to swapping clips inside the one tap-unlocked element). The **nav brand is the jelly logo** (`.nl img`, same file as the hero). Its specs are in
`PROMPT-cinematic-jelly-logo.md` and `PROMPT-logo-3d-motion.md` (Tier B, WebGL
lighting, not built). Media provenance is in `images/brand/MANIFEST.md`.

## What it is

One hand-written `index.html` (~3,600 lines) with all HTML, CSS, and JS inline.
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
| `vercel.json` | Security headers + CSP. The only place the CSP lives. |
| `.vercelignore` | What deploys leave out (`CLAUDE.md`, `README.md`, prompts, `tools/`, the logo source PNG). `.gitignore` does not control deploys. |
| `images/` | Photography, OG cover, tee mockups. |

## Content pipeline

1. `admin/index.html` fetches `/content.json`, fills the form (`populateForm`).
2. On save, `collectData()` rebuilds the whole object and POSTs it with an
   `x-admin-secret` header.
3. The function validates the shape against `ALLOWED_KEYS` and commits the file
   to GitHub, which triggers a deploy.
4. `index.html` fetches `/content.json` on load and injects it.

**Adding a content key means touching four places:** `content.json`, the
hydration block at the bottom of `index.html`, `populateForm`/`collectData` in
`admin/index.html`, and `ALLOWED_KEYS` in `api/save-content.js`. Miss
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

All five are set on Vercel Production, and the admin save path was tested end to end
on 2026-09-25.

## Sections

Hero → Shows reel (`#events`, upcoming only) → Links → Sound (`#music`) → Artist with About folded in
(`#artist`) → Played (`#played`) → Photos (`#asm`) → Book (`#contact`) → **Shop** → Footer.

v2 flow, live since 2026-11-12 (Luke picked prototype B):
- **Hero** rests on the jelly logo: one burst of 6 cuts (0.7 s each), then 21 s of logo; first burst about 9 s in.
  `#hero-next` names the first event in `content.json` that is not `past` ("SAT NOV 14 · AFTER12 · PHOENIX, AZ"),
  `#hero-cta` goes to that show's tickets, `#hero-alt` is a text link. No upcoming show: line hidden, Book a Set + Listen.
  The logo takes a soft room tint from the hero video (`--amb` on `#hero`, `.lp-tint`); the nav uses the flat cream mark.
- **Shows reel** = upcoming shows only. The upcoming table is `hidden` (shown again only for the TBA row).
  `#events` holds `min-height: 200vh` until `renderReel` adds `.reel-set`, so the page below does not jump.
- **Played** (`#played`): photo row from `REEL_IMG` ("date|venue" → `images/reel/<key>-{w,t}.webp`, newest three),
  then 6 rows + "Show all N" (`clipPlayed`), then the booking strip. Add a played show's photo by adding its key to `REEL_IMG`.
- **About** has no section of its own: quote, bio 1–2 and the proof row sit in `#artist`; an empty `#about` span
  catches old links. Bio 3–4, stats, chips and the three `//` cards are `hidden` (the admin still edits them; they do not show).
- **Colour rule:** sage = things you press, cream `#f2e3c8` = display headings, pink = the jelly logo only.
- **Sound player** (`.crate`) is styled as hardware in CSS only (shell, LCD readout, keys); the player script is unchanged.
- The ticker (`.status-bar`) rides up with the nav (`.up`).

Added 2026-10-28/29 (all live):
- **Hero cuts** (`#hero-cuts`): after the jelly-logo intro the hero cuts through the brand treatments
  (timing changed 2026-11-12, see the v2 notes above). Ref: recent.design Olivir; Luke picked prototype B
  (`proto/hero.html?v=a|b`, local only, in `.vercelignore`). Torn mark is baked (`images/brand/mark-torn.webp`).
- **Shows reel** (top of `#events`): sticky full-frame panels built from `content.json` events — every
  upcoming show, then past shows listed in `REEL_IMG` ("date|venue" → `images/reel/<key>-{w,t}.webp`).
  `#events` must stay `overflow: clip` (`hidden` breaks the sticky pin). Snap = scrollEnd + `lenis.scrollTo`.
  An upcoming event with a `flyer` path (`images/flyers/…`, editable in admin) shows the flyer as a card on its
  panel; click opens the full image. Past events ignore `flyer`.
- **Artist loop** (`.art-bg` video): rendered by `~/Movies/GRLSCRY-Brand-Frames/montage.py` (+ `mobile`
  for the 9:16 phone cut). 1.4x, no pixel holds.
- **Photos / Assembly** (`#asm`): 19 cards (`images/assembly/`) fly in, click dollies one to centre.

Performance rules learned 2026-10-29 (hero was ~6 fps): no CSS `filter` on anything that animates
unless it sits in its own layer; no `mix-blend-mode` inside the 3D logo; no live SVG turbulence (bake it);
no `filter: blur` tweens on many cards (one backdrop veil instead); no permanent `will-change` on cards
that scale 3x. Measure with a rAF frame-time script before/after, not by eye.

Note the ids do not match the labels: Shows is `#events`, Sound is `#music`,
Book is `#contact`.

## Shop

One product, one size choice, one button. `#shop`, so `grlscry.com/#shop` works
as an Instagram bio link.

- **Product:** GRLS CRY boxy tee, $35 + $6 shipping, sizes XS–3XL at a flat
  price. Production cost $16.97 (US fulfilment), net ≈ $18.10.
- **Checkout:** Stripe hosted, via a **per-size Payment Link** (plain `<a>` to
  `https://buy.stripe.com/...`, same tab). No Stripe script, no publishable key. It
  navigates rather than opening a modal, which is deliberate: a modal fights Lenis for
  scroll lock. Do not replace it with an overlay cart.
- **Fulfilment is manual.** Tapstitch has no public API. Orders are typed in by
  hand.
- **One payment link per size**, all $35, each product named with its size ("GRLS CRY
  Boxy Tee — M"), so the size prints on the receipt. `content.json` holds
  `stripe_payment_links: {size: url}`, and the site appends `?client_reference_id=TEE-M`
  as a dashboard cross-check. Only `https://buy.stripe.com/...` URLs become an href. A
  size with no link shows "unavailable". **Never add a Stripe size dropdown on top of this.**
- **LIVE since 2026-09-25.** Stripe account "GRLSCRY" (renamed; the same account holds
  Sleeper's *test-mode* "Trend Radar" product, while live mode is GRLS CRY only). $6 flat
  shipping ("Made to order", 2–3 weeks), US addresses only, quantity 1–5.
  `tools/stripe_setup.py test|live` (re)creates products, prices, the shipping rate and
  links idempotently, using `STRIPE_{TEST,LIVE}_RESTRICTED_KEY` from the credentials file.
  Stripe account review was still "in progress" on 2026-09-25.
- **Mockups:** 4:5 `#1A1A1A` cards, tee spanning x 57–1143. `tee-back.jpg` is cut out
  of Luke's `~/Pictures/Merch-Mockup-goodbadgirls.png`. **`tee-front.jpg` was replaced
  2026-09-25** with Luke's correct **centred-chest** mockup
  (`~/Pictures/4b243e5689b54b34b544084c0092aae2.png`): cut from its white background,
  and the charcoal fabric darkened to the back's black (RGB ≈ 8), with the print left
  untouched.
- `size_chart`, when set to a relative image path or an https URL, shows a
  "Size chart ↗" link under the size buttons. Hidden when empty or sold out.
- `sold_out: true` is the drop mechanic — one toggle in the admin panel swaps the
  button for "SOLD OUT" and hides the size picker.
- Store policies (shipping / refunds / terms / privacy / contact) are a
  collapsible block in the footer. Stripe expects these published before a live
  account sells.

## Motion — the fragile part

GSAP 3.12 + ScrollTrigger, Lenis smooth scroll, SoundCloud Widget API, all from
CDN. 52 ScrollTriggers. The page has heavy scroll cinematics and a sticky bottom
audio player.

**Inserting a section shifts every trigger below it.** When you add one:

- Call `ScrollTrigger.refresh()` once content and images have settled.
- Give every image an explicit `aspect-ratio` or `width`/`height` so the box is
  reserved before the file decodes. A late reflow silently breaks the triggers
  underneath.
- Keep motion inside the existing `if (!reduceMotion)` gate.
- Reveal-on-scroll uses `class="r"` plus `d1`–`d5` for stagger.

After any structural change, load the page and check: the hero 3D logo (intro,
tilt, scroll exit of the 4 `.lp` pieces), Artist parallax (`.art-bg`), the Shows table, and the sticky player.
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
  past event as upcoming: the JSON-LD block holds upcoming shows only (drop a show from it once it is played).
- Audit tools: `python3 tools/audit_shoot.py <tag>` shoots the page (desk + phone) into `tools/audit-out/<tag>/`
  with metrics; `python3 tools/audit_static.py` checks the static files (JSON-LD, robots, links) and exits 0 when clean.
- Crate player tracks live in two places: `content.json` `tracks` (what the admin panel edits; the page applies it
  through `window.crateSetTracks`) and the built-in `TRACKS` array in the player script (fallback until the fetch
  lands). Keep them identical. Order = SoundCloud plays, most first, as of 2026-11-10 (all 26 public uploads; the list
  scrolls inside the player, `data-lenis-prevent`). Refresh counts with
  `yt-dlp -J --skip-download https://soundcloud.com/grlscry/tracks` (`view_count` per entry).
- CSP is strict (in `vercel.json`). Any new third-party origin must be added there
  or it is silently blocked.
- `.r` elements start at `opacity: 0` and are revealed by GSAP. Under
  `prefers-reduced-motion` that JS is skipped, so a CSS rule forces them visible.
  Don't remove it — without it, reduced-motion users see empty sections.

## Do not push without asking.

# PROMPT: new share image (Open Graph / Twitter card) for grlscry.com

The share image is what shows when grlscry.com is posted, DMed or texted. Replace `images/og-cover.jpg`, a screenshot of the old text hero, with one that matches the live site.

## Design
- **Canvas:** 1200×630, rendered at 2× (2400×1260 JPG), matching the existing `og:image:width/height`.
- **Background:** the hero plate poster (`images/hero/plate-poster.jpg`, GRLS CRY's own live-set footage), darkened with the same scrim and pink glow as the hero.
- **Logo:** the jelly wordmark `images/brand/grlscry-logo-1800.webp`, large, left of centre, with the pink drop-glow. It's the hero. Keep it inside the centre ~80% so crops (iMessage, WhatsApp, IG link stickers) can't cut it.
- **Copy:** site fonts only (IBM Plex Mono; the site's CSS tokens: sage `#D7EFC2`, pink `#FF69B4`, black `#0e0e0e`). Keep text minimal, with nothing that goes stale:
  - top-left label: `● DJ / PRODUCER — SCOTTSDALE, AZ` (sage)
  - under the logo: `Dark · High Energy · Late Night` (pink italic)
  - bottom-left: `GRLSCRY.COM — MUSIC · BOOKING · MERCH` (dim)
- No dates, no event names, no prices.

## Build
1. `tools/og.html`: a static layout at 1200×630 using the real assets, loading the Google Fonts the site uses.
2. `tools/render_og.py`: Playwright screenshot at device scale 2, saved as `images/og-cover-v2.jpg` (q≈86, under ~400 KB). Use a **new filename** so Facebook/iMessage/X caches fetch it fresh.
3. Point `og:image`, `twitter:image` and the JSON-LD `image` at `og-cover-v2.jpg`, and update `og:image:alt` to describe the new image. Leave `og-cover.jpg` in place; it's no longer referenced.
4. `tools/` is already excluded from deploys by `.vercelignore`.

## Verify
- Look at the render at full size, and at the small sizes it's actually seen at: ~600 px wide (link card) and a centre-square crop.
- Local page loads with zero console errors, and the meta tags point at a file that returns 200.
- After deploy: fetch `https://grlscry.com/images/og-cover-v2.jpg` (200, image/jpeg) and check the live HTML's meta tags.
- Commit. Push only when Luke says so.

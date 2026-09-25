# PROMPT: cinematic hero with the jelly logo (GRLS CRY)

Apply skill `cinematic-generated-media-sites` to grlscry.com (the GRLS CRY EPK). Put the new jelly wordmark at the centre of the hero.
Branch `cinematic-logo`, cut from `vercel-migration`. **Do not push.** A push to `main` deploys production, and the cutover in CLAUDE.md is still pending.

## Inputs
- Logo: `images/brand/grlscry-jelly-logo-source.png` (5632×2944 RGBA, already transparent). It's a glossy magenta jelly wordmark on a diagonal, "GRLS / CRY".
- Plate: GRLS CRY's own live-set footage, `~/Pictures/GRLSCRY/Photos-3-001/7.mov` (4K HEVC, 60 fps). Use the uncut stretch **38–48 s** (magenta/purple light, tattooed back at the decks, crowd). Scene-cut scan: no cuts between 37.6 s and 52.1 s.
  The skill ranks the client's own footage above AI generation, so there are no generator credits and no licensing risk.

## Lane (from the skill's Step 1)
**Hybrid:** a pre-rendered video plate sits behind DOM copy, and the logo image is the H1. There's no real-time 3D engine. The "3D" comes from:
1. the logo's own rendered depth
2. a CSS `perspective` tilt that follows the pointer (fine pointers only)
3. a scroll-scrubbed exit that flies the logo toward the camera, replacing the text letter-scatter, which can't apply to an image
4. a specular sheen masked to the logo's alpha

## Steps
1. **Assets:**
   - Logo WebP at 1800w and 900w, plus a 900w PNG fallback. Trim the transparent margins first.
   - Plate: seamless 9 s loop (skill recipe: trim 38+1..48, xfade 1 s tail→head), graded darker, no audio.
     - desktop 1920w H.264 ≤ 3 MB, plus VP9 WebM
     - mobile 960w H.264 ≤ 1.2 MB
     - poster JPG
   - Write the source, timings, and rights into `images/brand/MANIFEST.md`.
2. **Markup:**
   - `<video autoplay muted playsinline loop preload="metadata" poster aria-hidden>` as the first child of `#hero`.
   - The H1 becomes `<picture>` + `<img alt="GRLS CRY">`, with explicit width/height so ScrollTrigger positions don't shift.
   - Keep `.heb`, `.ht`, `.h-ctx`, `.hc`, `.hs`, `.h-ribbon`, and all the ids that `content.json` hydrates.
3. **CSS:**
   - Plate `object-fit: cover`, with a scrim gradient under the copy.
   - Logo sized with `clamp`, plus a pink drop-glow tied to `--pink`.
   - Idle "jelly" squash-breathe animation, and a sheen pseudo-element using `mask-image` of the logo.
   - `@media (prefers-reduced-motion: reduce)`: no video playback (poster only), no breathe, no sheen, no tilt.
4. **JS** (inside the existing `if (!reduceMotion)` gate):
   - Replace the letter-scatter block with the logo fly-through exit on the same `#hero` trigger range.
   - Pointer tilt on `(pointer: fine)` only, via rAF-lerped CSS vars.
   - Pause the video when the hero is offscreen (IntersectionObserver).
   - Serve the mobile source below 768px.
5. **Leave alone:** `vercel.json` and `_headers`. Self-hosted media is already covered by `default-src 'self'`, so no CSP change is needed. `og-cover.jpg`, the footer `.foot-giant`, and the nav text stay as they are.
6. **Verify:**
   - Render with headless Chrome at 1440×900 and 390×844, and with reduced motion on. Look at the screenshots.
   - Scroll the hero exit to mid-point and screenshot it.
   - Confirm no console errors, 48 ScrollTriggers still present, the sticky player/CTA still appears after the hero, and the Artist parallax still works.
   - Record payload sizes and LCP.
7. Commit on `cinematic-logo`. Report. Do not push.

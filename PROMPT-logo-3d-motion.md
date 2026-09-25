# PROMPT: more 3D motion on the hero jelly logo (GRLS CRY)

Continue on branch `cinematic-logo` (commit `ecfc9f7`). **Do not push.** A push to `main` deploys production.
Read first: `PROMPT-cinematic-jelly-logo.md` (what exists), the repo's `CLAUDE.md` "Motion — the fragile part" section, and skill `cinematic-generated-media-sites` (Step 4 budgets, Step 6 verify).

## What exists now
The hero H1 is one image, `images/brand/grlscry-logo-{900,1800}.webp`, nested as `.hero-logo-wrap > .hero-logo > .hero-logo-jelly`. On it:
- jelly squash-breathe (CSS)
- a sheen masked to the alpha (CSS)
- a pointer tilt (`--tx`/`--ty`, fine pointers only)
- a GSAP scroll fly-through on `.hero-logo-wrap` (`#hero` top→bottom, scrub 1.2)

48 ScrollTriggers. Everything is gated on `reduceMotion`.

## Verified fact to build on
The logo's alpha (threshold 128–250) splits into **exactly 4 connected pieces**, at 1800w coordinates (x, y of the top-left of each bounding box):

| Piece | Box origin | Area px |
|---|---|---|
| **GR** | 16, 184 | 202k |
| **LS** | 953, 16 | 170k |
| **CR** | 335, 566 | 188k |
| **Y** | 1207, 459 | 65k |

The letters inside GR, LS, and CR touch through the white rim, so the unit of animation is **4 pieces, not 7 letters**. Don't try to cut the touching letters apart; the rim would tear.

## Goal
Make the logo read as a physical, 3D jelly object in space, not a flat sticker that tilts. Keep it cheap: 60 fps on a mid phone, and no change to anything outside the hero.

## Build: Tier A (required; CSS 3D + GSAP, no new dependencies)
1. **Split the sprite offline** (Python/PIL, script saved to `tools/split_logo.py`).
   - Export the 4 pieces as WebP at 1800w and 900w: `images/brand/logo-piece-{gr,ls,cr,y}-{900,1800}.webp`.
   - Write each piece's box as a % of the full logo to `images/brand/pieces.json`.
   - Position the pieces absolutely inside `.hero-logo` so the assembled logo is pixel-identical to today's. Screenshot-diff it against the current render at rest.
   - Keep the single-image `<img alt="GRLSCRY">` as the accessible name and the no-JS/reduced-motion fallback. The pieces are `aria-hidden`.
2. **Depth.**
   - Give each piece its own `translateZ`: GR 40px, LS 10px, CR 60px, Y 90px. Tune by eye.
   - Set `transform-style: preserve-3d` down the chain, so the existing pointer tilt produces real parallax between the pieces.
3. **Thickness (fake extrusion).**
   - Behind each piece, stack 4 copies at `translateZ(-3px … -12px)` with `filter: brightness(.55) saturate(1.3)`, so tilting reveals a jelly edge.
   - Desktop only (`(pointer: fine) and (min-width: 900px)`). Measure paint cost; drop to 2 layers if frame time exceeds 12 ms.
4. **Intro (once, on load).**
   - Pieces drop in from `z: 400px, y: -120px, rotationX: -35°`, staggered 0.09 s, with a jelly landing: `scaleY .86 → 1.06 → 1` via a GSAP `elastic.out(1, .45)`-style ease.
   - This replaces the current `.hn` fade-up for the logo only.
   - Total ≤ 1.4 s. No layout shift: the box is reserved by the existing width and aspect-ratio.
5. **Idle life.**
   - Each piece floats on its own slow sine: y ±6px, rotationZ ±1.5°, periods 4.1 / 4.7 / 5.3 / 3.9 s so they never sync.
   - When no pointer has moved for 3 s, the whole logo does a slow auto-orbit: rotateY ±7°, 9 s period. Pointer input takes over smoothly (lerp, no snap).
6. **Touch devices.** There's no pointer tilt, and don't use the gyroscope, because iOS needs a permission prompt. Drive the tilt from scroll progress instead: rotateX 0 → 10° across the first 30% of `#hero`.
7. **Scroll exit (upgrade the fly-through).**
   - Keep the single `#hero` trigger range, but split the timeline per piece so they separate in depth as they fly out: Y and CR toward the camera, GR and LS away, each with a little spin.
   - This is the 3D successor to the old letter scatter.
   - **The ScrollTrigger count must stay at 48**: one timeline, not four triggers.
8. **Jelly squash per piece.** Move the breathe animation from the whole logo to each piece, with offset delays, so they wobble independently. The sheen stays on the assembled layer.

## Build: Tier B (optional; do only if Tier A ships clean and Luke asks for more)
WebGL lighting on the 4 pieces with `ogl`, from `cdn.jsdelivr.net`, which is already allowed in `script-src` in both `vercel.json` and `_headers`. If another CDN is used, add it to both files.
- **Normal map.** Precompute it offline from each piece's alpha: distance transform → height → Sobel → `logo-normal-900.webp`.
- **Shader.** A fragment shader with a moving point light that follows the pointer (or the idle orbit), plus subsurface-ish pink glow and a small refraction wobble (noise-displaced UVs, amplitude ≤ 2px).
- **Fallback.** No WebGL2, reduced motion, or Save-Data means Tier A stays as is. The canvas only replaces the pieces' visual layer; the DOM and accessible name are untouched.
- **Budget.** ogl ≤ 30 KB gz. Pause the render loop when the hero is offscreen (reuse the video's IntersectionObserver).

## Rules
- All motion goes inside the existing `if (!reduceMotion)` gate. Reduced motion shows the assembled static logo, with no floats, orbit, intro, or extrusion.
- Transform and opacity only in rAF paths. No `filter` animation per frame, except the existing exit blur on the wrapper.
- Don't touch the video plate, the ribbon, the CTAs, the sticky player, or anything below `#hero`.
- New assets go in `images/brand/MANIFEST.md`.

## Verify (look at every screenshot)
1. Headless Chrome at 1440×900 and 390×844 (mobile emulation), and with reduced motion on:
   - at rest
   - mid-intro (t = 0.5 s)
   - pointer at the top-right corner (desktop)
   - hero scrolled 45%
2. **Pixel diff:** the assembled pieces at rest must match the single image to ≤ 1% differing pixels.
3. **Checks:** ScrollTriggers = 48, no new console errors (the favicon 404 is pre-existing), video still pauses offscreen.
4. **Performance trace:** 5 s of idle + pointer movement on desktop, 5 s of scroll on 4× CPU-throttled mobile. Report long frames (> 16.7 ms) and the hero's added transfer size.
5. Commit on `cinematic-logo` with a message that lists the tuned depth values. Report back with screenshots. Don't push.

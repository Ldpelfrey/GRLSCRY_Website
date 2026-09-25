# Brand + hero media manifest

| File | Source | Rights |
|---|---|---|
| `images/brand/grlscry-jelly-logo-source.png` | GRLS CRY jelly wordmark, supplied by Luke 2026-09-24 (5632×2944 RGBA) | Artist's own mark |
| `images/brand/grlscry-logo-{900,1800}.webp`, `-900.png` | Trimmed (40px pad) + resized from the source | same |
| `images/hero/plate-*` | `~/Pictures/GRLSCRY/Photos-3-001/7.mov` 38–48 s (no cuts 37.6–52.1 s). 24 fps, gblur 1.4, eq brightness −.06 / contrast 1.08 / saturation 1.15, seamless loop = trim 1..10 + 1 s xfade tail→head (9 s) | Artist's own live-set footage. Crowd faces visible: swap the segment if anyone objects |

Budgets: plate-1600.mp4 2.9 MB, plate-1600.webm 2.2 MB, plate-854.mp4 1.1 MB, poster 55 KB.

## 3D pieces (2026-09-24, PROMPT-logo-3d-motion.md Tier A)
| File | Source |
|---|---|
| `images/brand/logo-piece-{gr,ls,cr,y}-{900,1800}.webp` | `tools/split_logo.py`: the 4 alpha-connected parts of `grlscry-logo-{900,1800}.webp`, each on the full logo canvas (same pixel grid as the flat logo), WebP q90 |
| `images/brand/pieces.json` | per-piece centre + bottom as % of the logo (build data; values are inlined in `index.html`) |

Added transfer: 92 KB at 1x (900w pieces), 232 KB at 2x (1800w pieces). The flat logo still loads first as the fallback and accessible name.

## Hero rotation (2026-09-25)
Four clips from `7.mov`, same grade (24 fps, gblur 1.4, eq −.06/1.08/1.15), played in shuffled order with a 1 s crossfade. Only `plate` is a seamless loop; the others are straight cuts.

| Clip | `7.mov` span | Content | 1600 mp4 / webm / 854 mp4 |
|---|---|---|---|
| `plate` | 38–48 s (loop) | tattooed back at the decks, crowd | 2.9 / 2.2 / 1.1 MB |
| `plate-2` | 13.3–22.9 s | tattooed back at the decks, crowd | 2.9 / 2.5 / 1.1 MB |
| `plate-3` | 70.2–79.4 s | masked DJ, blue light | 2.1 / 2.0 / 0.8 MB |
| `plate-4` | 79.4–86.8 s | crowd from behind the decks | 2.0 / 1.6 / 0.8 MB |

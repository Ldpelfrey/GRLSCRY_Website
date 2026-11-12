# GRLSCRY fix pass (audit of 2026-11-12)

Spec for the relay `grlscry-fixes.handoff.md`. Branch `audit-fixes`, in its own worktree. Nothing here
goes live: Luke reviews the before/after screenshots and ships by hand.

Every item is a defect measured on the live site on 2026-11-12. The baseline numbers are in
`tools/audit-out/before/metrics.json` (made by `python3 tools/audit_shoot.py before`). Each item names its
check; a stage is done when its checks hold and nothing else moved.

## Rules for every stage

- Read `CLAUDE.md` first ("Motion, the fragile part" and "Gotchas").
- `index.html` is 3,672 lines. Never read it whole: search for the selector or id, then read 40 lines round it.
- Change only what the item names. No new colours, fonts, sections, libraries or files. No restyling.
- Do not touch: the hero logo (`.lp*`, `.hero-logo*`), hero cuts, the reel's scroll code, `#asm`, the shop
  checkout links, `content.json` values, `api/`, `admin/index.html`.
- Line numbers below are from the baseline and drift as you edit: trust the selector, not the number.
- After your edits run `python3 tools/audit_static.py`. It must exit 0. You cannot run a browser; the relay
  shoots the page after you finish.
- Report per item: the selector you changed, old value, new value, and anything you chose not to do and why.

## Stage `bugs` (index.html)

| ID | Defect | Where | Check |
|---|---|---|---|
| B1 | Nav "Book a Set" turns blank inside the Book section: `.nv a.act { color: var(--sage) !important }` (line 961) paints sage text on the sage `.nb` button. | CSS `.nb` (343), `.nv a.act` (961) | `navCta.color` differs from `navCta.bg` on desk and mob. Hover still inverts. |
| B2 | The closed phone menu `#mm` (line 365) is `opacity:0; pointer-events:none` but its 5 links still take keyboard focus on desktop. | CSS `#mm`, `#mm.open` | `hiddenMenuTabStops` = 0. Keep the fade: `visibility` with a delayed transition. The menu still opens (`.open`). |
| B3 | Two back-to-top buttons show together at the page end: floating `#btt` and the footer's `#btt-inline`. | CSS `.btt` (965), JS near `btt-inline` (2737) | `backToTopVisibleAtEnd` = 1 on desk and mob (the footer one stays). |
| B4 | On phone the fixed `.mob-book-row` bar (line 1591, 48px tall, 16px from the bottom) covers the last footer lines. | CSS `footer`, the 900px media block | `mob.footerTextUnderBarPx` <= 0. Desktop footer unchanged. |
| B5 | On phone the flyer card in a reel panel touches the date tag. | CSS `.rp-flyer` in the 768px block (near 1482) | `mob.flyerGapBelowTagPx` >= 12. `desk.flyerGapBelowTagPx` stays 36. |
| B6 | Shop sizes wrap 6 + 1 at 390px (3XL alone on a second row). | CSS `.shop-sizes` (589) | The mob shop frame shows the 7 sizes in one row or a balanced 4 + 3, each still at least 44px tall. |
| B7 | Some text renders in a browser fallback face (computed families include Arial and Times; the footer address line is one). | Find the declarations whose first family is not `--display` or `--mono`; form controls need `font-family: inherit`. | Report which elements were affected. |

## Stage `meta` (index.html head, robots.txt, sitemap.xml, vercel.json, .vercelignore, CLAUDE.md)

| ID | Defect | Check |
|---|---|---|
| M1 | The JSON-LD block lists 4 played sets as scheduled events (Almost Famous 2026-08-29, Electric Sanctuary 2026-09-19, Halloween After Dark, Just The Afters). Remove those 4 objects; keep After12 and Nightshift. | `static.jsonLdPastEvents` = [] and the block still parses. |
| M2 | `robots.txt` still has `Disallow: /.netlify/` (Netlify was removed 2026-09-25). Remove the line. | `static.robotsHasNetlify` = false. |
| M3 | `sitemap.xml` lastmod is 2026-08-05. Set it to 2026-11-12. | File reads 2026-11-12. |
| M4 | `vercel.json`: `/admin` (clean URL) gets no `X-Robots-Tag` because the rule only matches `/admin/(.*)`. Add a rule for `/admin` with the same two headers. | `vercel.json` parses; rule present. |
| M5 | `vercel.json`: every `/images/*` file is cached for a year as immutable, but flyers are replaced in place. Narrow the images rule so it skips `flyers/` (`/images/((?!flyers/).*)`) and add `/images/flyers/(.*)` with `public, max-age=86400`. | `vercel.json` parses; both rules present. |
| M6 | `admin/config.yaml` (a stale config from the old CMS, with the repo name) is served publicly. Add it to `.vercelignore`. Do not delete the file. | Line present in `.vercelignore`. |
| M7 | `CLAUDE.md` is stale: says ~2,780 lines and ~48 ScrollTriggers (now 3,672 and 52). Update those, say the JSON-LD block holds upcoming shows only, and add two lines on `tools/audit_shoot.py <tag>` and `tools/audit_static.py`. | Facts match the files. |

## Stage `legible` (index.html CSS only)

Size and contrast only. Every label, tile, card and section stays where it is.

| ID | Defect | Check |
|---|---|---|
| L1 | 40% of text characters on desktop and 47% on phone are under 12px (mostly 9 and 10px mono labels, table cells, link subtitles, footer). Raise them. Where an uppercase label grows, cut its `letter-spacing` so its width holds. | `under12Pct` <= 15 on desk and mob. `minFont` >= 10. `docW` = `vw` (no sideways scroll). |
| L2 | 36 text styles are under 4.5:1. Worst real text: `.past-table { opacity: .62 }` (1284), `.foot-section-label`, `.lk-sub`, `#p-meta`, `#p-time`, `.cl-sc-link`, `.cs-sc`, `.cl-d`, `.h-ctx`, the disabled `.btn.bs` "Select a size". Bring each to 4.5:1 or better with a lighter grey from the existing palette. The played list stays quieter than the upcoming rows through weight or size, not opacity. | `lowContrastStyles` <= 10 on desk and mob. |
| L3 | Decorative marks count as failing text: ghost numerals `.sec-n`, `.p-num`, the giant footer wordmark `.foot-giant`, ornament glyphs. Give them `aria-hidden="true"` in the markup (leave their look alone). If `.foot-giant` is the footer's only heading, keep a screen-reader-only heading. | They no longer appear in `worstContrast`. |

## Stage `perf` (index.html script)

| ID | Defect | Check |
|---|---|---|
| P1 | The hidden SoundCloud controller iframe `#sc-ctrl` (near 2972) loads on every visit: 1.52 MB, 15 requests, before anyone presses play. Keep its address in `data-src` and set `src` (then build the widget, code near 3180) when `#music` comes within one screen of the viewport, or on the first press of any play control, whichever is first. A press before the widget is ready must start playback once it is. | `soundcloudRequestsBeforeScroll` <= 1 (the small api script may still load). `playerRows` = 26. `consoleErrors` = []. |
| P2 | Reel flyers (625 KB) load with the page. In `renderReel` (near 3468) give flyer images after the first panel `loading="lazy"`. | Markup has it; `reelPanels` = 5. |
| P3 | The custom cursor loop (near 2412) runs every frame for ever, on touch devices too. Skip the loop and its listeners when `matchMedia('(pointer: coarse)')` matches. | `consoleErrors` = []. |

Do not add `defer` or `async` to the head scripts (the inline scripts need them loaded first). `scrollTriggers` must stay 52.

## Left out on purpose

- The dead "Men's Mental Health" donate link (GoFundMe 404): Luke picks a new address or removes the card.
- Rate limits on `api/booking.js` and `api/save-content.js`: needs a design choice, not a one-line fix.
- CSP clean-up (unused Stripe origins, `unsafe-inline`): low risk today, real risk if done blind.
- Hero, logo, Shows length, type floor, mood-board materials: decisions 1 to 4 in the audit deck, then prototypes.

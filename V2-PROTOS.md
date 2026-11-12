# GRLSCRY v2 prototypes (from the 2026-11-12 audit and Luke's answers)

Two prototype pages in the repo root, local only (both are in `.vercelignore`):

- `v2a.html` = **A, same order.** Today's site with Luke's four calls applied.
- `v2b.html` = **B, new flow.** A, plus a reordered page, one colour system, and the player rebuilt as a device.

`index.html` is the live site: never edit it. `content.json` is live data: never edit it. Luke picks A, B or
neither by looking at them side by side with the live page. Nothing here ships.

## Luke's calls (2026-11-12)

1. Hero rests on the jelly logo and names the next show.
2. Logo: he asked what gives the best quality. This round lights the existing logo in the browser.
3. Shows: full-screen panels for upcoming shows only. The Enclave is out, Electric Sanctuary is in (already live).
4. Type: a full type floor and fewer labels.

## The bar (read before touching anything)

- **Upgrade, never strip.** The site's energy is the jelly logo over club footage, the wide cream show titles,
  sage buttons on near-black, real rooms. A prototype with less energy than the live page has failed.
- **No template tells:** no glow, no gradient text, no new pill buttons, no numbered 01/02/03 cards, no new
  tracked mono labels, no centred-everything layouts, no emoji, no new typefaces, no new colours.
- **Mood board = era and material, never literal:** late-90s/Y2K hardware and film stills (smoked clear
  plastic, LCD glass, physical keys, film grain). No pixel or arcade fonts, no scanline gimmicks, no
  Matrix rain, no neon green, nothing copied from a pin.
- Fonts stay Archivo (display) and IBM Plex Mono. Colours stay the file's own tokens.
- Performance rules in `CLAUDE.md` hold: no CSS `filter` on animating elements outside their own layer,
  no `mix-blend-mode` in the 3D logo, no live SVG turbulence, no blur tweens.
- Hide with the `hidden` attribute rather than deleting markup that the content loader fills by id
  (`el('c-…')`), so nothing throws. Everything from `content.json` still goes through `esc()` / `safeUrl()`.
- Each prototype is ~3,600 lines. Never read one whole: search for the selector, read 40 to 60 lines round it.
- After editing run `python3 tools/audit_static.py v2a.html` (or `v2b.html`) as the whole Bash call. If refused, say so and still
  finish `STATUS: DONE`. You cannot run a browser; the relay shoots the page after you.
- Report per item: selector or function, what changed, what you chose not to do and why.

Baseline numbers (`tools/audit-out/v2-base/metrics.json`): heroLogoShare 0.18 desk / 0.21 phone,
heroBoxedButtons 2, microLabels 105, bodyFont 13.5 desk / 12 phone, `events` section 6,631 px desk /
6,810 px phone, playedRowsVisible 17, scrollTriggers 52.

## Stage `hero` (v2a.html)

| ID | Change | Check |
|---|---|---|
| H1 | The hero rests on the jelly logo over the footage. The five brand cuts (timer near `hero.classList.toggle('cutting'`, now 1.4 s each then 2.8 s of logo) become one short burst: 0.7 s each, then at least 16 s of logo, and the first burst starts no sooner than 9 s after load. | `heroLogoShare` >= 0.75 on desk and phone. |
| H2 | New line `#hero-next` above the hero buttons naming the next show, built from the first event in `content.json` whose status is not `past`: weekday + date, venue, city, e.g. `SAT NOV 14 · AFTER12 · PHOENIX, AZ`. Weekday from the date with the current year. Archivo, cream `#f2e3c8`, clamp(18px, 2vw, 28px), one line on desktop, at most two on phone. Readable over the footage and over every cut. No upcoming show: the line is hidden. Fill it where `renderTix` runs. | `heroNext` holds the line on desk and phone. |
| H3 | One main action. `#hero-cta` stays the sage button and goes straight to that show's ticket link (new tab) when one exists; "Book a Set" beside it becomes a plain underlined text link, no box. No upcoming show: main button "Book a Set" (`#contact`), text link "Listen" (`#music`). | `heroBoxedButtons` = 1. |
| H4 | Phone: the torn-paper cut crops the name to "RLS CRY". Fit the mark inside the phone width. | Phone hero frames show the whole name in every cut. |
| H5 | In the cuts where the mark is small (`.hc-photo .hmark`, `min(22vw, 300px)`), raise it to about `min(46vw, 640px)`. | Hero frames. |

Do not change the logo's 3D pieces, the intro, the scroll exit or the plate videos.

## Stage `shows` (v2a.html)

| ID | Change | Check |
|---|---|---|
| S1 | The reel (`renderReel`) shows upcoming shows only. | `reelPanels` = 2. |
| S2 | Played strip: a row of three cards at the top of `#past-block`, built from `REEL_IMG` and the events data (Sunbar Oct 9, Electric Sanctuary Sep 19, Sunbar Aug 28): the `images/reel/<key>-w.webp` still at 16:9, venue in the display face, date and type beneath, and the event's link when it has one ("Watch Set"). Desktop: three across. Phone: a horizontal scroll-snap row, cards about 78vw wide. No scroll animation beyond the existing `.r` reveal. Every image gets `aspect-ratio` and `loading="lazy"`. | Frames. |
| S3 | The played list shows the 6 most recent rows; a "Show all N" button (`aria-expanded`) reveals the rest, then calls `ScrollTrigger.refresh()`. | `playedRowsVisible` = 6. |
|  | Together | `events` section height <= 3,700 px desk and <= 4,300 px phone. `consoleErrors` = []. |

## Stage `type` (v2a.html)

| ID | Change | Check |
|---|---|---|
| T1 | Body copy (`.t-body`) is 15px on desktop and phone, line-height about 1.75. | `bodyFont` = 15. |
| T2 | Fewer labels. Hide: the ghost numerals (`.sec-n`), the ornament dividers between sections (keep the spacing), the eyebrow label above any section heading (`.ew` before an h2: Links, Origin Story, Live Dates, Streaming Now, Merch, Get In Touch), the 10+ / PHX / ZERO / 3AM tiles, and the boxed `// PHILOSOPHY`, `// TOOLS`, `// INSPIRATION` cards. | `microLabels` <= 52 on desk and phone. |
| T3 | About becomes: the pull quote, the first two bio paragraphs, and one proof row in the display face (three short facts, cream, about 20px): the number of played sets this year counted from the events data ("18 sets in 2026" style), "Support for Flava D", "Sold-out MogFest: Ascension". Bio paragraphs 3 and 4, influences chips and the cards are hidden. | About section is under 700 px tall on desk. |
| T4 | Nothing that is real text drops under 12px; contrast stays at or above 4.5:1. | `under12Pct` = 0, `lowContrastStyles` <= 2. |

## Stage `logo` (v2a.html)

| ID | Change | Check |
|---|---|---|
| G1 | The logo takes its light from the room. Four times a second draw the visible hero video into a 16x9 canvas, average the area behind the logo, ease toward it, and write `--amb` (an `r, g, b` triple) on `#hero`. Use it as a colour wash over each logo piece: a layer above each `.lp-face`, masked by that piece's own image (`mask-image`), filled `rgb(var(--amb))`, opacity about .22. No blend modes, no new filters. Stop sampling when the hero is off screen or the tab is hidden; sample once under reduced motion; if the canvas read throws, keep the default and stop. | `consoleErrors` = []. Hero frames at different seconds show the logo's tint following the footage. |
| G2 | Replace the pink glow under the logo with a contact shadow: in the `.lp-face` rule swap `drop-shadow(0 22px 44px rgba(255,105,180,.30))` for a dark one, about `drop-shadow(0 18px 26px rgba(0,0,0,.55))`. Same number of filters as now. | Frames: no pink halo. |
| G3 | Nav: the jelly logo is unreadable at 96 px. Show the flat mark there in cream, the way `.fr-mark` does it (`images/brand/mark-flat.png` as a mask over `#f2e3c8`), keeping the link, size box and accessible name. No pink drop-shadow. | `navLogo` no longer reports `grlscry-logo-900.webp`. Frames. |

## Stage `flow` (v2b.html, a copy of the finished v2a.html)

The live order answers a fan and a promoter in the wrong order: words before proof, seven screens of shows
before any music, booking last after the shop. B reorders by what a visitor needs next.

| ID | Change | Check |
|---|---|---|
| F1 | Section order: Hero, upcoming reel (the top of `#events`), `#links`, `#music`, `#artist` with the About text folded in under "Built for 3AM." (no separate About heading), a new `<section id="played">` holding the played strip and list moved out of `#events`, `#asm`, `#contact`, `#shop`, footer. Hide the two-row upcoming table (the panels and the tickets strip already say it). Every id the loader fills keeps working. Call `ScrollTrigger.refresh()` after the content lands, as now. | `sections` order: hero, events, links, music, artist, played, asm, contact, shop, footer. `consoleErrors` = []. |
| F2 | Nav order matches: Shows, Sound, About (to `#artist`), Shop, Book a Set. Footer nav too. | Frames. |
| F3 | One colour system. Sage = actions only. Pink = the jelly logo only: remove it from the pull-quote rule, the hero "Dark · High Energy · Late Night" line, card hovers. Cream `#f2e3c8` = all display headings (now white). Purple comes only from footage. | Frames; search shows `--pink` used only for the logo. |

## Stage `device` (v2b.html)

| ID | Change | Check |
|---|---|---|
| D1 | The Sound player reads as a piece of hardware, not a web card. Shell: smoked clear plastic (a dark translucent body, a 1px lit top edge, a soft inner shadow, corner radius about 14px). Readout: one LCD glass panel for the track title, number and time (green-black glass `#0f1a12`, sage text, tabular mono, no glow). Transport: three physical keys with a lit top edge and a pressed state. The track list sits in the body like a tray. Same markup ids and classes the player script uses; restyle, do not rebuild. Still 44px tap targets. | `playerRows` = 26, `consoleErrors` = []. Frames: reads as an object, nothing glows. |

## Stage `audit`

Independent. Compare three shoots: `v2-base` (live), `v2a-final`, `v2b-final`: metrics, every sheet, hero
sheets, and full frames where a tile is too small. Verdict per item (PASS / FAIL / NOT VERIFIABLE) with the
number or frame. Then, for A and for B separately: does it have more or less energy than the live page, and
where; every template tell or literal mood-board quote you can see; anything clipped, wrapped, overlapping or
empty; what Luke must try by hand. You cannot see motion or hear audio: say so.

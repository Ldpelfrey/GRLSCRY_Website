---
name: grlscry-fixes
cwd: .
model: sonnet
max_turns: 60
timeout_s: 2400
bash: [python3 tools/audit_static.py]
stages:
  - id: bugs
    task: |
      Fix items B1 to B7 in AUDIT-FIXES.md, section "Stage bugs". Follow "Rules for every stage" in that
      file exactly. Work only in index.html. Find each selector by searching, then read about 40 lines
      round it; never read the whole file. One item at a time, smallest change that meets its check.
      When done run `python3 tools/audit_static.py` and make it exit 0. Report per item: selector, old
      value, new value, or why you left it.
    reads: [AUDIT-FIXES.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py after-bugs
  - id: meta
    task: |
      Fix items M1 to M7 in AUDIT-FIXES.md, section "Stage meta". Follow "Rules for every stage".
      Files: the JSON-LD block in the head of index.html, plus the config and text files that section
      names (they are in your reads list). Keep every JSON file valid. Delete no files. When done run
      `python3 tools/audit_static.py` and make it exit 0. Report per item what changed.
    reads: [AUDIT-FIXES.md, CLAUDE.md, robots.txt, sitemap.xml, vercel.json, .vercelignore]
  - id: legible
    model: opus
    task: |
      Fix items L1 to L3 in AUDIT-FIXES.md, section "Stage legible". Follow "Rules for every stage".
      CSS in index.html only, plus the aria-hidden attributes L3 names. This is size and contrast, not a
      restyle: every label, tile, card and section stays, and the colours stay in the greys and sage the
      file already uses. First list the font-size declarations under 12px and the grey text colours with
      a search, then change them in groups. Read .relay/*-checks/bugs.txt for the current numbers
      (trustworthy, made by the relay). When done run `python3 tools/audit_static.py` and make it exit 0.
      Report a table: selector, old size or colour, new size or colour.
    reads: [AUDIT-FIXES.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py after-legible
  - id: perf
    model: opus
    task: |
      Fix items P1 to P3 in AUDIT-FIXES.md, section "Stage perf". Follow "Rules for every stage".
      Script in index.html only. P1 is the delicate one: read the whole player script block that builds
      the SoundCloud widget before changing it, keep every existing handler working, and make a play
      press that arrives before the widget is ready start playback once it is. Do not add defer or async
      to the head scripts and do not touch any ScrollTrigger code. When done run
      `python3 tools/audit_static.py` and make it exit 0. Report what you changed and what you could
      not test (you cannot hear audio or run a browser).
    reads: [AUDIT-FIXES.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py after-perf
  - id: audit
    model: fable
    task: |
      Independent audit. You have not seen the builders' reports. Judge the work against AUDIT-FIXES.md
      item by item (B1 to B7, M1 to M7, L1 to L3, P1 to P3) using artifacts only:
      tools/audit-out/before/metrics.json against tools/audit-out/after-perf/metrics.json, the files
      themselves (index.html is 3,700 lines: search it for each item's selector, never read it whole),
      and the contact sheets. Look at every sheet in tools/audit-out/before/ and
      tools/audit-out/after-perf/ (sheet-desk-N.jpg, sheet-mob-N.jpg) with the Read tool, side by side
      by number, and open full frames from the desk/ and mob/ folders where a tile is too small.
      For each item: PASS, FAIL or NOT VERIFIABLE, with the number or the frame that shows it.
      Then list every visible difference between before and after that the spec did not ask for, and
      anything that looks worse: clipped text, labels that now wrap, a section that moved, lost energy.
      Check the protected parts are untouched: hero logo, hero cuts, reel, photos, shop checkout.
      You cannot see motion or hear audio: say so, and name what Luke must try by hand (the phone menu,
      pressing play on a track, the reel scroll). Change no files except your report.
    reads: [AUDIT-FIXES.md, tools/audit-out/before/, tools/audit-out/after-perf/, vercel.json, robots.txt, sitemap.xml, .vercelignore]
---
GRLSCRY site, fix pass from the 2026-11-12 audit. One hand-written index.html, no build step.
This folder is a git worktree on branch `audit-fixes`; the live site is on `main` and is not touched.
Stages edit files here and stop. Luke reads the audit report and the before/after sheets in
tools/audit-out/, tries the hand checks, and decides what goes live himself.

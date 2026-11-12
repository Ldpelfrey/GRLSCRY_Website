---
name: grlscry-fixes-2
cwd: .
model: sonnet
max_turns: 60
timeout_s: 2400
bash: [python3 tools/audit_static.py]
stages:
  - id: legible
    model: opus
    task: |
      Fix items L1 to L3 in AUDIT-FIXES.md, section "Stage legible". Follow "Rules for every stage".
      CSS in index.html only, plus the aria-hidden attributes L3 names. This is size and contrast, not a
      restyle: every label, tile, card and section stays, and the colours stay in the greys and sage the
      file already uses. First list the font-size declarations under 12px and the grey text colours with
      a search, then change them in groups. Current numbers: tools/audit-out/after-meta/metrics.json
      (its "low" lists name the worst styles). When done run `python3 tools/audit_static.py` as the whole
      Bash call, nothing added to it (no pipe, no second command). If that call is refused, do not stop:
      say so in the report and still finish with STATUS: DONE, because the relay runs the checks after
      you. Report a table: selector, old size or colour, new size or colour.
    reads: [AUDIT-FIXES.md, CLAUDE.md, tools/audit-out/after-meta/metrics.json]
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
      `python3 tools/audit_static.py` as the whole Bash call, nothing added to it. If that call is
      refused, do not stop: say so and still finish with STATUS: DONE. Report what you changed and what
      you could not test (you cannot hear audio or run a browser).
    reads: [AUDIT-FIXES.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py after-perf
  - id: audit
    model: fable
    task: |
      Independent audit. You have not seen the builders' reports. Judge the work against AUDIT-FIXES.md
      item by item (B1 to B7, M1 to M7, L1 to L3, P1 to P3) using artifacts only:
      tools/audit-out/before/metrics.json against tools/audit-out/after-perf/metrics.json, the files
      themselves (index.html is 3,600 lines: search it for each item's selector, never read it whole),
      and the contact sheets. Look at every sheet in tools/audit-out/before/ and
      tools/audit-out/after-perf/ (sheet-desk-N.jpg, sheet-mob-N.jpg) with the Read tool, side by side
      by number, and open full frames from the desk/ and mob/ folders where a tile is too small.
      For each item: PASS, FAIL or NOT VERIFIABLE, with the number or the frame that shows it.
      Then list every visible difference between before and after that the spec did not ask for, and
      anything that looks worse: clipped text, labels that now wrap, a section that moved, lost energy.
      Check the protected parts are untouched: hero logo, hero cuts, reel, photos, shop checkout.
      You cannot see motion or hear audio: say so, and name what Luke must try by hand (the phone menu,
      pressing play on a track, the reel scroll). Change no files except your report.
    reads: [AUDIT-FIXES.md, tools/audit-out/before/, tools/audit-out/after-perf/, robots.txt, sitemap.xml, .vercelignore]
---
GRLSCRY site, fix pass from the 2026-11-12 audit, second run. Stages bugs and meta finished in run
20261112-131959-297a and are in the branch history (9541db5); this run does the rest.
One hand-written index.html, no build step. This folder is a git worktree on branch `audit-fixes`;
the live site is on `main` and is not touched. Stages edit files here and stop. Luke reads the audit
report and the before/after sheets in tools/audit-out/, tries the hand checks, and decides what goes
live himself.

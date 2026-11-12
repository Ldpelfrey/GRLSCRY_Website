---
name: grlscry-v2
cwd: .
model: opus
max_turns: 60
timeout_s: 3000
bash: [python3 tools/audit_static.py, python3 tools/audit_static.py v2a.html, python3 tools/audit_static.py v2b.html]
stages:
  - id: hero
    task: |
      Build items H1 to H5 of V2-PROTOS.md (section "Stage hero") in v2a.html only. Read "The bar" in
      that file first and hold to it. Never edit index.html or content.json. Search for each selector
      or function, then read 40 to 60 lines round it; never read the page whole. Smallest change that
      meets each check. When done run `python3 tools/audit_static.py v2a.html` as the whole Bash call; if it is
      refused, say so and still finish with STATUS: DONE. Report per item what changed and what you
      could not test.
    reads: [V2-PROTOS.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py v2a-hero v2a.html
  - id: shows
    task: |
      Build items S1 to S3 of V2-PROTOS.md (section "Stage shows") in v2a.html only. Read "The bar"
      first. Never edit index.html or content.json. The reel code is `renderReel`; the played list is
      filled where `past-block` is used. Read the relay check output from the hero stage for current
      numbers. Search, then read 40 to 60 lines round each spot; never read the page whole. When done
      run `python3 tools/audit_static.py v2a.html` as the whole Bash call; if refused, say so and still finish
      with STATUS: DONE. Report per item what changed and what you could not test.
    reads: [V2-PROTOS.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py v2a-shows v2a.html
  - id: type
    task: |
      Build items T1 to T4 of V2-PROTOS.md (section "Stage type") in v2a.html only. Read "The bar"
      first. Never edit index.html or content.json. Hide with the `hidden` attribute, do not delete
      markup the loader fills. Search, then read 40 to 60 lines round each spot; never read the page
      whole. When done run `python3 tools/audit_static.py v2a.html` as the whole Bash call; if refused, say so
      and still finish with STATUS: DONE. Report per item what changed and what you could not test.
    reads: [V2-PROTOS.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py v2a-type v2a.html
  - id: logo
    task: |
      Build items G1 to G3 of V2-PROTOS.md (section "Stage logo") in v2a.html only. Read "The bar" and
      the performance rules in CLAUDE.md first. Never edit index.html or content.json. Read the `.lp`
      CSS block and the hero video script before changing anything; leave the 3D pieces, intro and
      scroll exit as they are. When done run `python3 tools/audit_static.py v2a.html` as the whole Bash call; if
      refused, say so and still finish with STATUS: DONE. Report per item what changed and what you
      could not test.
    reads: [V2-PROTOS.md, CLAUDE.md, images/brand/MANIFEST.md]
    after:
      - python3 tools/audit_shoot.py v2a-final v2a.html
      - python3 tools/proto_copy.py v2a.html v2b.html
  - id: flow
    task: |
      v2b.html is now a copy of the finished v2a.html. Build items F1 to F3 of V2-PROTOS.md (section
      "Stage flow") in v2b.html only. Read "The bar" first. Never edit index.html, v2a.html or
      content.json. Move whole sections; keep every id the loader and the scroll code use. Read the
      relay check output from the logo stage for the current section list. Search, then read 40 to 60
      lines round each spot; never read the page whole. When done run `python3 tools/audit_static.py v2b.html`
      as the whole Bash call; if refused, say so and still finish with STATUS: DONE. Report the final
      section order, per item what changed, and what you could not test.
    reads: [V2-PROTOS.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py v2b-flow v2b.html
  - id: device
    task: |
      Build item D1 of V2-PROTOS.md (section "Stage device") in v2b.html only. Read "The bar" first:
      era and material, never literal, nothing glows. Never edit index.html, v2a.html or content.json.
      CSS restyle of the Sound player with the same ids and classes; do not touch the player script.
      When done run `python3 tools/audit_static.py v2b.html` as the whole Bash call; if refused, say so and
      still finish with STATUS: DONE. Report what changed and what you could not test.
    reads: [V2-PROTOS.md, CLAUDE.md]
    after:
      - python3 tools/audit_shoot.py v2b-final v2b.html
  - id: audit
    model: fable
    task: |
      Independent audit, section "Stage audit" of V2-PROTOS.md. You have not seen the builders'
      reports. Use artifacts only: tools/audit-out/v2-base/, tools/audit-out/v2a-final/ and
      tools/audit-out/v2b-final/ (metrics.json, sheet-desk-N.jpg, sheet-mob-N.jpg,
      sheet-desk-hero-1.jpg, sheet-mob-hero-1.jpg, and full frames in desk/ and mob/), plus searches
      in v2a.html and v2b.html (never read a page whole). Give a verdict per item H1 to H5, S1 to S3,
      T1 to T4, G1 to G3, F1 to F3, D1 with the number or frame that shows it. Then judge A and B
      each against the live page: more or less energy and where, every template tell or literal
      mood-board quote, anything clipped, wrapped, overlapping or empty. Say which you would show
      Luke and which not. You cannot see motion or hear audio: say so and list what he must try by
      hand. Change no files except your report.
    reads: [V2-PROTOS.md, tools/audit-out/v2-base/, tools/audit-out/v2a-final/, tools/audit-out/v2b-final/]
---
GRLSCRY v2 prototypes. This folder is a git worktree on branch `v2-protos`; the live site is on `main`
and is not touched. v2a.html and v2b.html are prototype copies of the page in the repo root, local only.
Stages edit those two files and stop. Luke compares them with the live page and picks.

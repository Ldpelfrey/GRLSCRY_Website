#!/usr/bin/env python3
"""Static checks a relay stage can run without a browser.

    python3 tools/audit_static.py [page.html]

Checks: every inline <script> in index.html parses (node --check), every JSON-LD
block parses, content.json and vercel.json parse, the events in content.json and
the hardcoded upcoming rows agree, and tag counts for the main sections are sane.
Prints PASS or FAIL per check and exits 1 on any FAIL.
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = re.sub(r'[^A-Za-z0-9_.-]', '', sys.argv[1]) if len(sys.argv) > 1 else 'index.html'   # e.g. v2a.html
html = open(os.path.join(ROOT, PAGE), encoding='utf-8').read()
fails = 0


def check(name, ok, detail=''):
    global fails
    print(('PASS ' if ok else 'FAIL ') + name + ((' :: ' + detail) if detail else ''))
    if not ok: fails += 1


scripts = re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>', html, re.S)
for i, body in enumerate(scripts):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, dir=os.path.join(ROOT, 'tools')) as f:
        f.write(body); path = f.name
    try:
        r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
        check('inline script %d parses (%d chars)' % (i + 1, len(body)), r.returncode == 0, r.stderr.strip().splitlines()[-1] if r.returncode else '')
    except FileNotFoundError:
        check('node available for syntax check', False, 'node not found')
    finally:
        os.unlink(path)

for i, blk in enumerate(re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)):
    try: json.loads(blk); check('JSON-LD block %d parses' % (i + 1), True)
    except Exception as e: check('JSON-LD block %d parses' % (i + 1), False, str(e)[:120])

for name in ('content.json', 'vercel.json'):
    try: data = json.load(open(os.path.join(ROOT, name), encoding='utf-8')); check(name + ' parses', True)
    except Exception as e: data = None; check(name + ' parses', False, str(e)[:120])
    if name == 'content.json' and data:
        up = [e for e in data.get('events', []) if e.get('status') != 'past']
        m = re.search(r'<tbody id="c-events-tbody">(.*?)</tbody>', html, re.S)
        rows = re.findall(r'<td class="en">(.*?)</td>', m.group(1)) if m else []
        check('hardcoded upcoming rows match content.json', rows == [e['venue'] for e in up], 'html=%s json=%s' % (rows, [e['venue'] for e in up]))

ids = re.findall(r'<section[^>]*\bid="([^"]+)"', html)
if PAGE == 'index.html':
    order = ['hero', 'events', 'links', 'music', 'artist', 'played', 'asm', 'contact', 'shop']
    for sid in order:
        check('section #%s present once' % sid, ids.count(sid) == 1)
    check('section order is ' + ', '.join(order), [i for i in ids if i in order] == order, ', '.join(ids))
    check('old /#about links still land (anchor present)', 'id="about"' in html)
else:
    print('section order: ' + ', '.join(ids))
    check('no section id repeated', len(ids) == len(set(ids)))
    for sid in ('hero', 'events', 'music', 'asm', 'shop', 'contact'):
        check('section #%s present once' % sid, ids.count(sid) == 1)
check('style and script tags balanced', html.count('<style') == html.count('</style>') and html.count('<script') == html.count('</script>'))
print('%s lines: %d' % (PAGE, html.count('\n') + 1))
sys.exit(1 if fails else 0)

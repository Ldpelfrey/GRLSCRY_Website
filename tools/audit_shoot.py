#!/usr/bin/env python3
"""Shoot the local site on desktop and phone, and print the audit's measured checks.

    python3 tools/audit_shoot.py <tag>

Serves the repo root on a free local port, captures the page top to bottom at
1440x900 and 390x844 into tools/audit-out/<tag>/, builds contact sheets
(sheet-desk-N.jpg, sheet-mob-N.jpg) and writes metrics.json. The same numbers
are printed, one per line, so a before/after pair can be compared by eye.
Read-only on the site: it never edits a file outside tools/audit-out/.
"""
import datetime, functools, glob, http.server, json, math, os, re, sys, threading

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG = re.sub(r'[^A-Za-z0-9_-]', '', sys.argv[1]) if len(sys.argv) > 1 else 'run'
OUT = os.path.join(ROOT, 'tools', 'audit-out', TAG)

METRICS_JS = r'''() => {
  const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2] };
  const parse = s => (s.match(/[\d.]+/g) || [0, 0, 0]).map(Number);
  const bgOf = e => { while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > .5) return c.slice(0, 3); e = e.parentElement } return [14, 14, 14] };
  const out = { chars: 0, under12: 0, minFont: 999, low: [] };
  const seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while (n = w.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue;
    const e = n.parentElement, cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || e.closest('[aria-hidden="true"]')) continue;
    const fs = parseFloat(cs.fontSize); out.chars += t.length; if (fs < 12) out.under12 += t.length; if (fs < out.minFont) out.minFont = fs;
    const c = parse(cs.color), a = (c[3] === undefined ? 1 : c[3]) * parseFloat(cs.opacity), bg = bgOf(e);
    const fg = c.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const key = e.tagName + '.' + String(e.className).slice(0, 28) + '|' + fs;
    if (cr < 4.5 && !seen.has(key)) { seen.add(key); out.low.push([Math.round(cr * 10) / 10, fs, key.split('|')[0], t.slice(0, 24)]) }
  }
  out.low.sort((a, b) => a[0] - b[0]);
  const cta = document.querySelector('.nv a.nb') || document.querySelector('a.nb');
  if (cta) { const cs = getComputedStyle(cta); out.navCta = { cls: cta.className, color: cs.color, bg: cs.backgroundColor } }
  const mm = document.getElementById('mm');
  out.hiddenMenuTabStops = mm && !mm.classList.contains('open') && getComputedStyle(mm).visibility !== 'hidden' && !mm.inert
    ? [...mm.querySelectorAll('a,button')].filter(a => a.tabIndex >= 0).length : 0;
  out.scrollTriggers = window.ScrollTrigger ? ScrollTrigger.getAll().length : null;
  out.docH = document.documentElement.scrollHeight; out.docW = document.documentElement.scrollWidth; out.vw = innerWidth;
  out.upcomingRows = document.querySelectorAll('#c-events-tbody tr').length;
  out.reelPanels = document.querySelectorAll('#reel .rp').length;
  out.playerRows = document.querySelectorAll('.cl-row').length;
  const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > .05 && r.top < innerHeight && r.bottom > 0 };
  out.backToTopVisibleAtEnd = [...document.querySelectorAll('#btt, #btt-inline')].filter(vis).length;
  const bar = document.querySelector('.mob-book-row'), foot = document.querySelector('footer');
  if (bar && getComputedStyle(bar).display !== 'none' && foot) {
    const top = bar.getBoundingClientRect().top; let worst = -999;
    const fw = document.createTreeWalker(foot, NodeFilter.SHOW_TEXT); let f;
    while (f = fw.nextNode()) { if (!f.textContent.trim()) continue; const p = f.parentElement; if (p.closest('[aria-hidden="true"]')) continue; const r = p.getBoundingClientRect(); if (r.height && r.bottom - top > worst) worst = Math.round(r.bottom - top) }
    out.footerTextUnderBarPx = worst;
  }
  const rp = document.querySelector('#reel .rp.has-flyer');
  if (rp) { const fl = rp.querySelector('.rp-flyer img'), tg = rp.querySelector('.rp-tag'); if (fl && tg) out.flyerGapBelowTagPx = Math.round(fl.getBoundingClientRect().top - tg.getBoundingClientRect().bottom) }
  return out;
}'''


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    handler.log_message = lambda *a, **k: None
    http.server.ThreadingHTTPServer.handle_error = lambda *a, **k: None  # videos aborted mid-stream are not errors
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def sheets(name, cols, rows, w):
    files = sorted(glob.glob(os.path.join(OUT, name, '[0-9]*.jpg'))); per = cols * rows
    for k in range(0, len(files), per):
        ims = [Image.open(f) for f in files[k:k + per]]
        h = int(ims[0].height * w / ims[0].width); pad = 6
        sh = Image.new('RGB', (cols * (w + pad) + pad, rows * (h + pad + 16) + pad), (40, 40, 40)); d = ImageDraw.Draw(sh)
        for i, im in enumerate(ims):
            x = pad + (i % cols) * (w + pad); y = pad + (i // cols) * (h + pad + 16)
            sh.paste(im.resize((w, h)), (x, y + 16)); d.text((x, y + 2), os.path.basename(files[k + i]), fill=(255, 255, 120))
        sh.save(os.path.join(OUT, 'sheet-%s-%d.jpg' % (name, k // per + 1)), quality=72)


def run(p, base, name, vp, mobile):
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    b = p.chromium.launch()
    ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); errs = []; sc = {'n': 0}
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    pg.on('request', lambda r: sc.__setitem__('n', sc['n'] + 1) if ('soundcloud' in r.url or 'sndcdn' in r.url) else None)
    pg.goto(base, wait_until='load'); pg.wait_for_timeout(1200)
    pg.screenshot(path=os.path.join(OUT, name, '000-load-1s.jpg'), type='jpeg', quality=60)
    pg.wait_for_timeout(3500)
    pg.screenshot(path=os.path.join(OUT, name, '001-load-5s.jpg'), type='jpeg', quality=60)
    sc_before_scroll = sc['n']
    H = pg.evaluate('document.documentElement.scrollHeight'); step = int(vp['height'] * .85)
    for i in range(1, math.ceil(H / step) + 1):
        y = min(i * step, H - vp['height'])
        pg.evaluate('window.scrollTo(0,%d)' % y); pg.wait_for_timeout(650)
        pg.screenshot(path=os.path.join(OUT, name, '%03d-y%d.jpg' % (i + 1, y)), type='jpeg', quality=60)
        if y >= H - vp['height']: break
    pg.wait_for_timeout(400)
    m = pg.evaluate(METRICS_JS)
    m['consoleErrors'] = errs[:8]; m['soundcloudRequestsBeforeScroll'] = sc_before_scroll
    m['under12Pct'] = round(100 * m['under12'] / max(1, m['chars']))
    m['lowContrastStyles'] = len(m['low']); m['low'] = m['low'][:12]
    b.close()
    return m


def static_checks():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    today = datetime.date.today().isoformat(); past = []; total = 0
    for blk in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        def walk(o):
            nonlocal total
            if isinstance(o, dict):
                if o.get('@type') == 'MusicEvent':
                    total += 1
                    if str(o.get('startDate', ''))[:10] < today: past.append(o.get('name'))
                for v in o.values(): walk(v)
            elif isinstance(o, list):
                for v in o: walk(v)
        walk(json.loads(blk))
    json.load(open(os.path.join(ROOT, 'content.json'), encoding='utf-8'))
    json.load(open(os.path.join(ROOT, 'vercel.json'), encoding='utf-8'))
    return {'jsonLdEvents': total, 'jsonLdPastEvents': past,
            'gofundmeLinks': html.count('gofundme.com'),
            'robotsHasNetlify': 'netlify' in open(os.path.join(ROOT, 'robots.txt')).read().lower()}


def main():
    os.makedirs(OUT, exist_ok=True)
    srv = serve(); base = 'http://127.0.0.1:%d/' % srv.server_address[1]
    with sync_playwright() as p:
        res = {'desk': run(p, base, 'desk', {'width': 1440, 'height': 900}, False),
               'mob': run(p, base, 'mob', {'width': 390, 'height': 844}, True)}
    srv.shutdown()
    sheets('desk', 2, 3, 760); sheets('mob', 5, 2, 330)
    res['static'] = static_checks()
    json.dump(res, open(os.path.join(OUT, 'metrics.json'), 'w'), indent=1)
    keys = ['consoleErrors', 'docH', 'docW', 'vw', 'under12Pct', 'minFont', 'lowContrastStyles', 'navCta',
            'hiddenMenuTabStops', 'backToTopVisibleAtEnd', 'footerTextUnderBarPx', 'flyerGapBelowTagPx',
            'soundcloudRequestsBeforeScroll', 'scrollTriggers', 'upcomingRows', 'reelPanels', 'playerRows']
    print('AUDIT SHOOT tag=%s -> tools/audit-out/%s/' % (TAG, TAG))
    for dev in ('desk', 'mob'):
        for k in keys:
            if k in res[dev]: print('%s.%s = %s' % (dev, k, json.dumps(res[dev][k])))
        print('%s.worstContrast = %s' % (dev, json.dumps(res[dev]['low'][:6])))
    for k, v in res['static'].items(): print('static.%s = %s' % (k, json.dumps(v)))


if __name__ == '__main__':
    main()

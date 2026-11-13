"""Load the local site under the real CSP at shifted clock times and report what the Shows UI says.

usage: python3 tools/autopast_browser.py [repo] [outdir]
  INJECT=1 adds a "Jan 9" and an "Aug 15" booking; LIVE_URL=https://grlscry.com/ runs it on production.
"""
import json, os, socket, subprocess, sys, time
from datetime import datetime, timezone, timedelta
from playwright.sync_api import sync_playwright

REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(REPO, 'tools', 'audit-out', 'autopast')
os.makedirs(OUT, exist_ok=True)
AZ = timezone(timedelta(hours=-7))
TIMES = [
    ('T1 now Nov13 12:30', datetime(2026, 11, 13, 12, 30, tzinfo=AZ)),
    ('T2 Nov15 11:59', datetime(2026, 11, 15, 11, 59, tzinfo=AZ)),
    ('T3 Nov15 12:01', datetime(2026, 11, 15, 12, 1, tzinfo=AZ)),
    ('T4 Nov22 12:01', datetime(2026, 11, 22, 12, 1, tzinfo=AZ)),
    ('T5 Jan05 2027', datetime(2027, 1, 5, 12, 0, tzinfo=AZ)),
]

FAKE = """(function(){
  var R = Date, OFF = %d - R.now();
  function F(a,b,c,d,e,f,g){
    if (!(this instanceof F)) return new R(R.now()+OFF).toString();
    var n = arguments.length;
    return n === 0 ? new R(R.now()+OFF) : n === 1 ? new R(a) : new R(a, b, c === undefined ? 1 : c, d || 0, e || 0, f || 0, g || 0);
  }
  F.prototype = R.prototype; F.now = function(){ return R.now()+OFF; }; F.UTC = R.UTC; F.parse = R.parse;
  window.Date = F;
})();"""

STATE = """() => {
  const $ = id => document.getElementById(id);
  const vis = e => !!e && !e.hidden && getComputedStyle(e).display !== 'none';
  const txt = e => (e ? e.innerText : '').replace(/\\s+/g, ' ').trim();
  return {
    heroNext: vis($('hero-next')) ? $('hero-next').textContent : '(hidden)',
    cta: [txt($('hero-cta')), $('hero-cta') && $('hero-cta').getAttribute('href')],
    alt: [txt($('hero-alt')), $('hero-alt') && $('hero-alt').getAttribute('href')],
    mobTix: $('mob-tix') ? $('mob-tix').style.display || 'shown' : 'n/a',
    tix: vis($('c-tix')) ? [...document.querySelectorAll('#c-tix .tx-row')].map(txt) : '(strip hidden)',
    reel: [...document.querySelectorAll('#reel-frame > *')].map(p => txt(p).slice(0, 70)),
    upTable: $('c-events-tbody') && $('c-events-tbody').closest('table').hidden ? '(hidden)' : [...document.querySelectorAll('#c-events-tbody tr')].map(txt),
    played: [...document.querySelectorAll('#c-past-tbody tr')].slice(0, 4).map(r => txt(r) + (r.querySelector('a') ? '  [LINK ' + r.querySelector('a').href + ']' : '')),
    playedRows: document.querySelectorAll('#c-past-tbody tr').length,
    more: vis($('past-more')) ? txt($('past-more')) : '(hidden)',
    sets: txt($('ab-sets')),
    strip: [...document.querySelectorAll('#played-strip .ps-v')].map(txt),
  };
}"""


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


if os.environ.get('LIVE_URL'):
    srv, url = subprocess.Popen(['true']), os.environ['LIVE_URL']
else:
    port = free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(REPO, 'tools', 'serve_csp.py'), str(port)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    url = f'http://127.0.0.1:{port}/'
report = {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, t in TIMES:
            for kind, vp, rm in (('desk', {'width': 1440, 'height': 900}, 'no-preference'),
                                 ('phone', {'width': 390, 'height': 844}, 'reduce')):
                ctx = b.new_context(viewport=vp, reduced_motion=rm, device_scale_factor=2 if kind == 'phone' else 1)
                ctx.add_init_script(FAKE % int(t.timestamp() * 1000))
                if os.environ.get('INJECT'):
                    def inject(route):
                        r = route.fetch(); c = r.json()
                        c['events'] = c['events'][:2] + [
                            {'date': 'Jan 9', 'venue': 'NextYearTest', 'location': 'Tempe, AZ', 'type': 'DJ Set', 'status': 'live', 'link': 'https://example.com/jan9'},
                            {'date': 'Aug 15', 'venue': 'FarBookingTest', 'location': 'Tempe, AZ', 'type': 'DJ Set', 'status': 'live', 'link': 'https://example.com/aug15'},
                        ] + c['events'][2:]
                        route.fulfill(response=r, json=c)
                    ctx.route('**/content.json*', inject)
                pg = ctx.new_page()
                errs = []
                pg.on('console', lambda m, errs=errs: m.type == 'error' and errs.append(m.text[:160]))
                pg.on('pageerror', lambda e, errs=errs: errs.append('pageerror: ' + str(e)[:160]))
                with pg.expect_response(lambda r: 'content.json' in r.url, timeout=20000):
                    pg.goto(url, wait_until='domcontentloaded', timeout=30000)
                pg.wait_for_timeout(1500)
                st = pg.evaluate(STATE)
                st['errors'] = errs
                st['clock'] = pg.evaluate('() => new Date().toISOString()')
                report[f'{label} / {kind}'] = st
                if kind == 'phone' and label.startswith(('T1', 'T3', 'T4')):
                    tag = label.split()[0]
                    pg.screenshot(path=os.path.join(OUT, f'{tag}-hero.png'))
                    pg.evaluate("() => document.getElementById('played').scrollIntoView()")
                    pg.wait_for_timeout(800)
                    pg.screenshot(path=os.path.join(OUT, f'{tag}-played.png'))
                ctx.close()
        b.close()
finally:
    srv.terminate()

json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
for k, v in report.items():
    if k.endswith('/ phone'):
        same = {kk: vv for kk, vv in v.items() if kk not in ('clock',)} == {kk: vv for kk, vv in report[k.replace('phone', 'desk')].items() if kk not in ('clock',)}
        print(f'== {k}: ' + ('same as desk' if same else 'DIFFERS from desk') + f"; errors {v['errors']}")
        continue
    print(f'== {k}  (page clock {v["clock"]})')
    for kk in ('heroNext', 'cta', 'alt', 'mobTix', 'tix', 'reel', 'upTable', 'played', 'playedRows', 'more', 'sets', 'strip', 'errors'):
        print(f'  {kk}: {v[kk]}')

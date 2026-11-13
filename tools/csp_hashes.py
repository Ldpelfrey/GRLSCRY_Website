#!/usr/bin/env python3
"""Keep the site's Content-Security-Policy in step with the inline scripts in index.html.

    python3 tools/csp_hashes.py           rewrite the two CSP headers in vercel.json
    python3 tools/csp_hashes.py --check   exit 1 if vercel.json is out of date (changes nothing)

The public pages do not allow inline scripts in general: only the exact inline <script> blocks
in index.html, each named by its sha256 hash. Change one character of an inline script and its
hash changes, and the browser will refuse to run it, so RUN THIS AFTER EVERY EDIT TO A <script>
BLOCK IN index.html (the pre-push hook and tools/audit_static.py both check it).
Inline event handlers (onclick="...") are blocked on the public pages: use addEventListener.
The admin panel keeps 'unsafe-inline' for scripts (it builds its form with inline handlers).
"""
import base64, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_SOURCE = '/((?!admin).*)'
ADMIN_SOURCES = ('/admin', '/admin/(.*)')
SCRIPT_HOSTS = 'https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://w.soundcloud.com'
REST = ("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://*.sndcdn.com; frame-src https://w.soundcloud.com; "
        "connect-src 'self' https://api.soundcloud.com https://w.soundcloud.com; form-action 'self'; "
        "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests")


def inline_hashes():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    bodies = re.findall(r'<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>', html, re.S)
    return ["'sha256-%s'" % base64.b64encode(hashlib.sha256(b.encode('utf-8')).digest()).decode() for b in bodies]


def policies():
    public = "default-src 'self'; script-src 'self' %s %s; %s" % (' '.join(inline_hashes()), SCRIPT_HOSTS, REST)
    admin = "default-src 'self'; script-src 'self' 'unsafe-inline'; %s" % REST
    return public, admin


def main():
    check = '--check' in sys.argv
    path = os.path.join(ROOT, 'vercel.json')
    cfg = json.load(open(path, encoding='utf-8'))
    public, admin = policies()
    want = {PUBLIC_SOURCE: public}
    want.update({s: admin for s in ADMIN_SOURCES})
    found, stale = set(), []
    for rule in cfg['headers']:
        if rule['source'] in want:
            found.add(rule['source'])
            hs = [h for h in rule['headers'] if h['key'] != 'Content-Security-Policy']
            cur = [h['value'] for h in rule['headers'] if h['key'] == 'Content-Security-Policy']
            if cur != [want[rule['source']]]: stale.append(rule['source'])
            rule['headers'] = hs + [{'key': 'Content-Security-Policy', 'value': want[rule['source']]}]
        elif any(h['key'] == 'Content-Security-Policy' for h in rule['headers']):
            stale.append(rule['source'] + ' (unexpected CSP here)')
    missing = [s for s in want if s not in found]
    if check:
        if stale or missing:
            print('CSP OUT OF DATE in vercel.json: %s. Run: python3 tools/csp_hashes.py' % ', '.join(stale + missing))
            sys.exit(1)
        print('CSP matches the %d inline scripts in index.html' % len(inline_hashes()))
        return
    if missing: sys.exit('vercel.json has no header rule for: ' + ', '.join(missing))
    json.dump(cfg, open(path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    open(path, 'a').write('\n')
    print('vercel.json updated: %d inline script hashes' % len(inline_hashes()))


if __name__ == '__main__':
    main()

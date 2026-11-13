#!/usr/bin/env python3
"""Local server that sends the headers from vercel.json, so the CSP can be tested before a deploy.

    python3 tools/serve_csp.py [port]      (default 8896)

Plain `python3 -m http.server` sends no CSP, so a script the policy would block still runs there.
This applies every header rule whose `source` matches the path (later rules win), and serves
/admin as admin/index.html the way cleanUrls does. The /api functions are not available.
"""
import http.server, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RULES = [(re.compile('^' + r['source'] + '$'), r['headers']) for r in json.load(open(os.path.join(ROOT, 'vercel.json')))['headers']]


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        clean = path.split('?')[0].split('#')[0]
        if clean.rstrip('/') == '/admin': path = '/admin/index.html'
        return super().translate_path(path)

    def end_headers(self):
        clean = self.path.split('?')[0].split('#')[0]
        out = {}
        for rx, hs in RULES:
            if rx.match(clean):
                for h in hs: out[h['key']] = h['value']
        out.pop('Strict-Transport-Security', None)   # http on localhost
        for k, v in out.items():
            self.send_header(k, v.replace('; upgrade-insecure-requests', '') if k == 'Content-Security-Policy' else v)
        super().end_headers()

    def log_message(self, *a): pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8896
    http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()

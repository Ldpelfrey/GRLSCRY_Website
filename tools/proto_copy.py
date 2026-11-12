#!/usr/bin/env python3
"""Copy one prototype page to another name in the repo root: python3 tools/proto_copy.py v2a.html v2b.html
Refuses anything but v2*.html names and never overwrites index.html."""
import os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, dst = sys.argv[1], sys.argv[2]
for n in (src, dst):
    if not re.fullmatch(r'v2[a-z0-9-]*\.html', n): sys.exit('refused: ' + n)
shutil.copyfile(os.path.join(ROOT, src), os.path.join(ROOT, dst))
print('copied %s -> %s (%d bytes)' % (src, dst, os.path.getsize(os.path.join(ROOT, dst))))

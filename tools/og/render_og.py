#!/usr/bin/env python3
"""Render the link-preview video (og:video) and its still (og:image) for grlscry.com.

    python3 tools/og/render_og.py <work-dir> <out.mp4> <out.jpg>
    e.g. python3 tools/og/render_og.py /tmp/og images/og-loop-v2.mp4 images/og-cover-v4.jpg

og-anim.html draws each frame (window.__frame(t)) on a transparent page; every frame is shot on its own, so
timing never depends on this Mac's speed. ffmpeg lays the frames over two hero clips (1200x630, 24 fps,
H.264, no sound, faststart). The still is the last frame, composited from the source footage (no video
artifacts), so the picture shown before the video plays matches where it ends. Then update the og:image /
og:video URLs in index.html: always new file names, because /images/ is cached for a year.
"""
import os, socket, subprocess, sys, time
from PIL import Image
from playwright.sync_api import sync_playwright

FPS = 24
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
work, mp4, still = sys.argv[1], sys.argv[2], sys.argv[3]
frames = os.path.join(work, 'frames'); os.makedirs(frames, exist_ok=True)
for f in os.listdir(frames): os.remove(os.path.join(frames, f))
# Footage: A opens (colour-changing light on the decks), B closes (pink light, crowd filming). The cut burst covers the join.
A = (os.path.join(ROOT, 'images/hero/plate-2-1600.mp4'), 0.0, 4.6)
B = (os.path.join(ROOT, 'images/hero/plate-1600.mp4'), 1.2, 3.4)
FIT = 'scale=1200:675:in_color_matrix=bt709,crop=1200:630:0:22,setsar=1'
DENOISE = 'hqdn3d=2:1.5:4:3'   # light: the club footage's grain costs more bits than it shows at preview size

# Served over http, not file://: Chrome refuses CSS mask images from file URLs, and the cuts draw the mark with one.
sock = socket.socket(); sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]; sock.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.0)
try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    pg.goto('http://127.0.0.1:%d/tools/og/og-anim.html' % port, wait_until='load')
    pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(1500)
    assert pg.evaluate("document.fonts.check('800 56px Archivo') && document.fonts.check('500 22px \"IBM Plex Mono\"')"), 'fonts did not load'
    assert pg.evaluate("[...document.images].every(i => i.complete && i.naturalWidth > 0)"), 'an image is missing'
    # The masks must draw: mid-cut, the photo cut's cream mark sits at the centre, the collage mark's photos too.
    for t, what in ((4.85, 'photo cut mark'), (5.35, 'collage cut photos')):
        pg.evaluate('t => window.__frame(t)', t); pg.wait_for_timeout(300)
        shot = os.path.join(work, 'check.png'); pg.screenshot(path=shot)
        im = Image.open(shot).convert('RGB')
        if what.startswith('photo'):
            cream = sum(1 for x in range(420, 780, 6) for y in range(200, 380, 6) if (lambda c: c[0] > 225 and c[1] > 210 and c[2] > 180)(im.getpixel((x, y))))   # mark cream #f2e3c8
            assert cream > 40, '%s did not draw (mask missing)' % what
        else:
            dark = sum(1 for x in range(200, 1000, 8) for y in range(150, 430, 8) if sum(im.getpixel((x, y))) < 450)
            assert dark > 150, '%s did not draw (mask missing)' % what
    length = pg.evaluate('window.__len'); n = round(length * FPS)
    for i in range(n):
        pg.evaluate('t => window.__frame(t)', i / FPS)
        pg.screenshot(path=os.path.join(frames, 'f-%04d.png' % i), omit_background=True)
    pg.evaluate('window.__frame(window.__len)')
    pg.screenshot(path=os.path.join(work, 'still-top.png'), omit_background=True)
    b.close()
finally:
    srv.terminate()

pad = length - A[2] - B[2]
fc = (f'[0:v]fps={FPS},{FIT},{DENOISE},tpad=stop_mode=clone:stop_duration={pad:.3f}[a];'
      f'[1:v]fps={FPS},{FIT},{DENOISE}[b];[a][b]concat=n=2:v=1:a=0,format=rgba[bg];'
      f'[bg][2:v]overlay=0:0:format=rgb:shortest=1,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(A[1]), '-t', str(A[2]), '-i', A[0], '-ss', str(B[1]), '-t', str(B[2]), '-i', B[0],
                '-framerate', str(FPS), '-i', os.path.join(frames, 'f-%04d.png'), '-filter_complex', fc, '-map', '[v]',
                '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', os.environ.get('OG_CRF', '27'), '-g', str(FPS * 2),
                '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                '-an', '-movflags', '+faststart', mp4], check=True)
bg = os.path.join(work, 'still-bg.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '%.4f' % (B[1] + B[2] - 1.0 / FPS), '-i', B[0], '-frames:v', '1',
                '-vf', FIT + ',format=rgb24', bg], check=True)
img = Image.alpha_composite(Image.open(bg).convert('RGBA'), Image.open(os.path.join(work, 'still-top.png')).convert('RGBA'))
img.convert('RGB').save(still, quality=88, optimize=True, progressive=True)
print('%d frames -> %s (%d bytes); still -> %s (%d bytes)' % (n, mp4, os.path.getsize(mp4), still, os.path.getsize(still)))

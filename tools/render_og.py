"""Render tools/og.html to images/og-cover-v2.jpg (2400x1260, the share image).

    python3 tools/render_og.py

Needs the local server (python3 -m http.server 8899, from the repo root) so the
page can load ../images/*. Waits for the web fonts before the screenshot.
"""
import asyncio
import io

from PIL import Image
from playwright.async_api import async_playwright

OUT = 'images/og-cover-v2.jpg'


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=2)
        await pg.goto('http://localhost:8899/tools/og.html', wait_until='networkidle')
        await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(300)
        png = await pg.screenshot(type='png')
        await b.close()
    Image.open(io.BytesIO(png)).convert('RGB').save(OUT, quality=86, optimize=True, progressive=True)
    print('wrote', OUT)


asyncio.run(main())

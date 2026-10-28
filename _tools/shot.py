#!/usr/bin/env python3
"""Screenshot helper for visual QA."""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/shot.png"
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1440
H = int(sys.argv[4]) if len(sys.argv) > 4 else 1000
FULL = (sys.argv[5] if len(sys.argv) > 5 else "0") == "1"
LANG = sys.argv[6] if len(sys.argv) > 6 else ""
SCROLL = int(sys.argv[7]) if len(sys.argv) > 7 else 0

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": W, "height": H}, device_scale_factor=2)
    errors = []
    pg.on("console", lambda m: errors.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    url = URL + (("?lang=" + LANG) if LANG else "")
    pg.goto(url, wait_until="networkidle")
    pg.wait_for_timeout(1200)
    if SCROLL:
        pg.evaluate("window.scrollTo(0, %d)" % SCROLL)
        pg.wait_for_timeout(1400)
    # trigger reveals by scrolling through the page
    pg.evaluate(
        """async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 90));
        }
        window.scrollTo(0, %d);
      }"""
        % SCROLL
    )
    pg.wait_for_timeout(900)
    pg.screenshot(path=OUT, full_page=FULL)
    print("saved", OUT)
    if errors:
        print("--- console ---")
        for e in errors[:20]:
            print(e)
    b.close()

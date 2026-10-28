#!/usr/bin/env python3
"""
Chatora — accessibility sweep.

Runs axe-core (WCAG 2.1 A/AA) against every built English, Arabic and
published locale page, and prints any violation with the selector that caused it.

    python3 _tools/a11y.py                 # whole site
    python3 _tools/a11y.py pricing.html    # one page

Notes
-----
* Needs Playwright + Chromium (`pip install playwright && playwright install chromium`).
* Serves nothing itself: start the local server first (`python3 -m http.server 8000`).
* Reveal animations start at opacity 0, which makes axe report phantom contrast
  failures — so we settle for ~850ms before auditing. Anything found after that
  is real.
"""
import glob
import os
import sys
from collections import Counter

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:8000/")
AXE = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js"
SETTLE_MS = 850


def pages():
    if len(sys.argv) > 1:
        return sys.argv[1:]
    en = sorted(os.path.basename(p) for p in glob.glob("*.html"))
    localized = []
    for lang in ("ar", "es", "fr", "de", "pt"):
        localized.extend(sorted(lang + "/" + os.path.basename(p) for p in glob.glob(lang + "/*.html")))
    return en + localized


def main():
    targets = pages()
    found = Counter()
    where = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()
        for name in targets:
            page.goto(BASE + name, wait_until="networkidle")
            page.wait_for_timeout(SETTLE_MS)
            page.add_script_tag(url=AXE)
            result = page.evaluate("async () => await axe.run(document, {resultTypes:['violations']})")
            for v in result["violations"]:
                found[v["id"]] += len(v["nodes"])
                where.setdefault(v["id"], (name, v["nodes"][0]["target"]))
        browser.close()

    total = sum(found.values())
    print("pages checked: %d | violations: %d" % (len(targets), total))
    for rule, count in found.most_common():
        page_name, target = where[rule]
        print("  %-28s %3d  first seen on %s  %s" % (rule, count, page_name, target))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())

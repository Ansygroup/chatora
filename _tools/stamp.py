#!/usr/bin/env python3
"""Cache-busting stamp for every generated language mirror.

Assets are served from the edge with a long max-age, so a re-upload alone does
not reach returning visitors. This appends ?v=<md5-8> to every CSS/JS reference
in the built HTML, derived from the file's own contents. Idempotent: an existing
?v= is replaced, never doubled.

Run automatically after the English, Arabic and other locale mirrors are built.
"""
import glob
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAT = re.compile(r"(assets/(?:css|js)/[\w./-]+?\.(?:css|js))(\?v=[0-9a-f]+)?")


def hashes():
    out = {}
    for path in glob.glob(os.path.join(ROOT, "assets", "css", "*.css")) + glob.glob(
        os.path.join(ROOT, "assets", "js", "*.js")
    ):
        with open(path, "rb") as fh:
            out["assets/" + os.path.relpath(path, os.path.join(ROOT, "assets")).replace(os.sep, "/")] = (
                hashlib.md5(fh.read()).hexdigest()[:8]
            )
    return out


def run():
    h = hashes()
    files = sorted(glob.glob(os.path.join(ROOT, "*.html")))
    for lang in ("ar", "es", "fr", "de", "pt"):
        files.extend(sorted(glob.glob(os.path.join(ROOT, lang, "*.html"))))
    changed = 0
    for f in files:
        with open(f, encoding="utf-8") as fh:
            src = fh.read()
        new = PAT.sub(lambda m: "%s?v=%s" % (m.group(1), h.get(m.group(1), "0")), src)
        if new != src:
            with open(f, "w", encoding="utf-8") as fh:
                fh.write(new)
            changed += 1
    print("stamp: %d asset versions · %d pages rewritten" % (len(h), changed))
    return changed


if __name__ == "__main__":
    run()

#!/usr/bin/env python3
"""Check generated EN/AR/ES/FR/DE/PT HTML for missing same-site files and anchors.

No network access or third-party dependencies are used. Run after build.py.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
BUILD_SOURCE = (ROOT / "_tools" / "build.py").read_text(encoding="utf-8")
BASE_MATCH = re.search(r'^BASE\s*=\s*[\"\']([^\"\']+)', BUILD_SOURCE, re.MULTILINE)
if not BASE_MATCH:
    raise SystemExit("Could not read BASE from _tools/build.py")
BASE = BASE_MATCH.group(1).rstrip("/")
SITE_HOSTS = {urlparse(BASE).hostname, "www." + (urlparse(BASE).hostname or "")}


class PageRefs(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.refs: list[tuple[str, str]] = []
        self.base_href = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"] or "")
        if tag == "base" and values.get("href"):
            self.base_href = values["href"] or ""
        for attr in ("href", "src", "poster"):
            value = values.get(attr)
            if value:
                self.refs.append((attr, value))
        srcset = values.get("srcset") or ""
        # A data URL can contain commas, so avoid treating its payload as a path.
        if srcset and not srcset.lstrip().lower().startswith("data:"):
            for item in srcset.split(","):
                candidate = item.strip().split()
                if candidate:
                    self.refs.append(("srcset", candidate[0]))


def inside_root(path: Path) -> bool:
    try:
        path.relative_to(ROOT)
        return True
    except ValueError:
        return False


def target_for(url_path: str) -> Path:
    decoded = unquote(url_path)
    target = (ROOT / decoded.lstrip("/")).resolve()
    if decoded.endswith("/"):
        target = target / "index.html"
    return target


def main() -> int:
    pages = sorted(ROOT.glob("*.html"))
    for lang in ("ar", "es", "fr", "de", "pt"):
        pages.extend(sorted((ROOT / lang).glob("*.html")))
    if not pages:
        print("No generated HTML pages found.")
        return 1

    parsed_pages: dict[Path, PageRefs] = {}
    for page in pages:
        parser = PageRefs()
        parser.feed(page.read_text(encoding="utf-8", errors="replace"))
        parsed_pages[page.resolve()] = parser

    missing_files: list[tuple[str, str, str]] = []
    missing_anchors: list[tuple[str, str, str]] = []
    checked = 0
    checked_anchors = 0

    for page, parser in parsed_pages.items():
        relative = page.relative_to(ROOT).as_posix()
        page_url = BASE + "/" + relative
        resolution_base = urljoin(page_url, parser.base_href) if parser.base_href else page_url
        for attr, ref in parser.refs:
            ref = ref.strip()
            if not ref or ref.startswith(("data:", "javascript:", "mailto:", "tel:", "blob:")):
                continue
            resolved = urlparse(urljoin(resolution_base, ref))
            if resolved.scheme not in ("http", "https"):
                continue
            if resolved.hostname and resolved.hostname not in SITE_HOSTS:
                continue
            target = target_for(resolved.path)
            # Avoid treating an outside-root path as a missing local project file.
            if not inside_root(target):
                continue
            checked += 1
            if not target.is_file():
                missing_files.append((relative, attr, ref))
                continue
            if attr == "href" and resolved.fragment:
                checked_anchors += 1
                target_page = parsed_pages.get(target.resolve())
                if target_page and unquote(resolved.fragment) not in target_page.ids:
                    missing_anchors.append((relative, ref, unquote(resolved.fragment)))

    print(
        f"pages={len(pages)} local_refs_checked={checked} "
        f"anchors_checked={checked_anchors} missing_files={len(missing_files)} "
        f"missing_anchors={len(missing_anchors)}"
    )
    for page, attr, ref in missing_files:
        print(f"MISSING FILE  {page} [{attr}] {ref}")
    for page, ref, anchor in missing_anchors:
        print(f"MISSING ANCHOR {page} [href] {ref} -> #{anchor}")
    return 1 if missing_files or missing_anchors else 0


if __name__ == "__main__":
    raise SystemExit(main())

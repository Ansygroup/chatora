#!/usr/bin/env python3
"""
Chatora — Arabic static mirror builder.

The site's language switcher is client-side, which is great for UX but invisible
to Google: an English-only crawl never sees the Arabic copy. This step renders a
real /ar/ copy of every page (static HTML, lang="ar" dir="rtl"), with its own
canonical, meta title/description and localized JSON-LD. build_locales.py later
adds reciprocal hreflang for all six published static languages.

It reuses the exact same dictionary the browser uses (i18n.js + i18n-pages.js),
so the static copy and the interactive copy never drift apart.

Run: python3 _tools/build_ar.py   (build.py calls it automatically)
"""
import importlib.util
import json
import os
import re
import subprocess
from datetime import date
from urllib.parse import urlsplit
from xml.sax.saxutils import escape

from bs4 import BeautifulSoup, NavigableString

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://chatora.ansygroup.com"
BUILD_DATE = date.today().isoformat()
AR_DIR = os.path.join(ROOT, "ar")

# page file -> SEO key slug (seo.<slug>.title / seo.<slug>.desc)
SLUG = {
    "index.html": "home",
    "features.html": "features",
    "pricing.html": "pricing",
    "channels.html": "channels",
    "compare.html": "compare",
    "integrations.html": "integrations",
    "templates.html": "templates",
    "use-cases.html": "usecases",
    "playground.html": "playground",
    "vs-chatfuel.html": "vschatfuel",
    "vs-manychat.html": "vsmanychat",
    "alternatives.html": "alternatives",
    "blog.html": "blog",
    "about.html": "about",
    "legal.html": "legal",
    "contact.html": "contact",
    "404.html": "404",
    "blog-manychat-alternative.html": "a1",
    "blog-instagram-dm-sales.html": "a2",
    "blog-whatsapp-commerce.html": "a3",
    "blog-whatsapp-api-pricing.html": "a6",
    "blog-abandoned-cart-whatsapp.html": "a7",
    "blog-manychat-pricing.html": "a4",
    "blog-instagram-automation-tools.html": "a5",
    "blog-manychat-vs-chatfuel.html": "a8",
    "blog-chatfuel-pricing.html": "a9",
    "login.html": "login",
    "app.html": "app",
}

# Pages that should NOT get an Arabic twin (long-form body still English).
# Empty: all 20 pages are translated. Add a filename here if you ever publish
# a page before its Arabic copy is ready — the EN page then drops its ar
# hreflang, the Arabic hub links straight to the English original, and the
# page stays out of the sitemap's Arabic set.
AR_SKIP = set()

# Keep structured FAQ copy aligned with the actual visible question/answer set.
# Generic site FAQs must not be substituted into article-specific FAQ schemas.
FAQ_TRANSLATION_KEYS = {
    "index.html": [("faq.q%d" % i, "faq.a%d" % i) for i in range(1, 9)],
    "pricing.html": [("faq.q%d" % i, "faq.a%d" % i) for i in range(1, 9)],
    "vs-manychat.html": [("mc.q%d" % i, "mc.a%d" % i) for i in range(1, 6)],
    "blog-abandoned-cart-whatsapp.html": [("a7.b37", "a7.b38"), ("a7.b39", "a7.b40"), ("a7.b41", "a7.b42")],
    "blog-whatsapp-api-pricing.html": [("a6.b47", "a6.b48"), ("a6.b49", "a6.b50"), ("a6.b51", "a6.b52"), ("a6.b53", "a6.b54")],
    "blog-chatfuel-pricing.html": [("a9.b30", "a9.b31"), ("a9.b32", "a9.b33"), ("a9.b34", "a9.b35"), ("a9.b36", "a9.b37")],
    "blog-manychat-vs-chatfuel.html": [("a8.b33", "a8.b34"), ("a8.b35", "a8.b36"), ("a8.b37", "a8.b38"), ("a8.b39", "a8.b40")],
}

BLOCK_TAGS = ("img", "picture", "div", "ul", "ol", "li", "section", "table", "video", "canvas")


def load_ar_dict():
    """Pull the Arabic dictionary straight out of the JS bundles."""
    js = (
        "global.window={};"
        "require('./assets/js/i18n.js');"
        "require('./assets/js/i18n-pages.js');"
        "const ar=Object.assign({},(window.CHATORA_I18N||{}).ar||{},"
        "(window.CHATORA_I18N_PAGES||{}).ar||{});"
        "process.stdout.write(JSON.stringify(ar));"
    )
    out = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def url_for(out, arabic=False):
    tail = "" if out == "index.html" else out
    return (BASE + "/ar/" + tail) if arabic else (BASE + "/" + tail)


LTR_ISLANDS = (".phone", ".hero-visual", ".float", ".badge-float", ".demo-modal")


def pin_ltr(soup):
    """Product screenshots are English UI — keep them left-to-right so the
    bidi algorithm doesn't move punctuation around inside chat bubbles."""
    n = 0
    for sel in LTR_ISLANDS:
        for el in soup.select(sel):
            if not el.get("dir"):
                el["dir"] = "ltr"
                n += 1
    return n


def redirect_skipped_links(soup):
    """Don't send Arabic readers to a page that does not exist in /ar/."""
    n = 0
    for a in soup.find_all("a", href=True):
        h = a["href"].split("#")[0]
        if h in AR_SKIP:
            a["href"] = "../" + a["href"]
            n += 1
    return n


def strip_ar_hreflang(out):
    """An English page with no Arabic twin must not advertise one."""
    path = os.path.join(ROOT, out)
    html = open(path, encoding="utf-8").read()
    new = re.sub(r'\s*<link rel="alternate" hreflang="ar" href="[^"]*">', "", html)
    if new != html:
        open(path, "w", encoding="utf-8").write(new)
        return True
    return False


def prefix_assets(soup):
    """assets/... -> ../assets/... so the copy works one level deep."""
    n = 0
    for tag in soup.find_all(True):
        for attr in ("src", "href", "poster", "data-src"):
            v = tag.get(attr)
            if v and v.startswith("assets/"):
                tag[attr] = "../" + v
                n += 1
    return n


def translate(soup, ar):
    """Bake the Arabic strings into the markup."""
    hits = misses = 0
    for el in soup.select("[data-i18n]"):
        key = el.get("data-i18n")
        val = ar.get(key)
        if val is None:
            misses += 1
            continue
        if el.find(BLOCK_TAGS) is not None:
            continue  # do not replace parents containing layout or media subtrees
        icons = [icon.extract() for icon in el.find_all("svg")]
        el.clear()
        for icon in icons:
            el.append(icon)
        frag = BeautifulSoup(val, "html.parser")   # dictionary values may contain <span>/<strong>
        for child in list(frag.contents):
            el.append(child.extract())
        hits += 1

    for el in soup.select("[data-i18n-ph]"):
        val = ar.get(el.get("data-i18n-ph"))
        if val:
            el["placeholder"] = val

    for el in soup.select("[data-i18n-aria]"):
        val = ar.get(el.get("data-i18n-aria"))
        if val:
            el["aria-label"] = val

    for el in soup.select("[data-i18n-title]"):
        val = ar.get(el.get("data-i18n-title"))
        if val:
            el["title"] = val

    for el in soup.select("[data-i18n-alt]"):
        val = ar.get(el.get("data-i18n-alt"))
        if val:
            el["alt"] = val
    return hits, misses


def set_meta(soup, title, desc, ar_url, en_url):
    if soup.title:
        soup.title.string = title
    for m in soup.find_all("meta"):
        prop = (m.get("property") or m.get("name") or "").lower()
        if prop in ("description", "og:description", "twitter:description"):
            m["content"] = desc
        elif prop in ("og:title", "twitter:title"):
            m["content"] = title
        elif prop == "og:url":
            m["content"] = ar_url
        elif prop == "og:locale":
            m["content"] = "ar_AR"
        elif prop == "og:locale:alternate":
            m["content"] = "en_US"

    for link in soup.find_all("link", rel=True):
        rel = " ".join(link.get("rel") or []).lower()
        hl = link.get("hreflang")
        if "canonical" in rel:
            link["href"] = ar_url
        elif "alternate" in rel and hl:
            if hl == "x-default":
                link["href"] = en_url
            elif hl == "ar":
                link["href"] = ar_url
            else:  # en/es/fr/de/pt keep pointing at the English document
                link["href"] = en_url if hl == "en" else en_url + "?lang=" + hl


def drop_feed_link(soup):
    """The feed is English-only, so /ar/ pages must not advertise it."""
    for el in soup.select('link[type="application/rss+xml"]'):
        el.decompose()


def localise_jsonld(soup, out, ar):
    """Localise structured data, point it at the Arabic URL and tag its language."""
    def arabic_url(value):
        if not isinstance(value, str) or not value.startswith(BASE):
            return value
        parts = urlsplit(value[len(BASE):])
        path = re.sub(r"^(?:ar|es|fr|de|pt)/", "", parts.path.lstrip("/"))
        if not path or path == "index.html":
            target = url_for("index.html", True)
        elif path in SLUG:
            target = url_for(path, True)
        else:
            return value
        if parts.query:
            target += "?" + parts.query
        if parts.fragment:
            target += "#" + parts.fragment
        return target

    def localise_urls(node):
        if isinstance(node, dict):
            for key, value in list(node.items()):
                if node.get("@type") == "Organization" and key in ("url", "@id"):
                    continue  # preserve the brand's canonical root identity
                if key in ("url", "@id", "item", "target") and isinstance(value, str):
                    node[key] = arabic_url(value)
                else:
                    localise_urls(value)
        elif isinstance(node, list):
            for value in node:
                localise_urls(value)

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except Exception:
            continue
        blobs = data if isinstance(data, list) else [data]
        h1 = soup.find("h1")
        h1_text = h1.get_text(" ", strip=True) if h1 else ""
        for b in blobs:
            if isinstance(b, dict) and "@context" in b:
                b["inLanguage"] = "ar"
                # Page metadata and schema must describe the same localized page.
                if b.get("@type") == "WebSite":
                    b["url"] = url_for("index.html", True)
                if b.get("@type") == "SoftwareApplication":
                    meta = soup.find("meta", attrs={"name": "description"})
                    if meta and meta.get("content"):
                        b["description"] = meta["content"]
                if b.get("@type") == "Article" and h1_text:
                    b["headline"] = h1_text
                    if "description" in b:
                        meta = soup.find("meta", attrs={"name": "description"})
                        if meta and meta.get("content"):
                            b["description"] = meta["content"]
                if b.get("@type") == "FAQPage":
                    questions = b.get("mainEntity", [])
                    pairs = FAQ_TRANSLATION_KEYS.get(out)
                    if pairs is None or len(questions) != len(pairs):
                        raise RuntimeError("FAQ JSON-LD mapping is missing or out of sync for " + out)
                    for question, (question_key, answer_key) in zip(questions, pairs):
                        local_name, local_answer = ar.get(question_key), ar.get(answer_key)
                        if not isinstance(question, dict) or not local_name or not local_answer:
                            raise RuntimeError("Missing Arabic FAQ translation: %s / %s" % (question_key, answer_key))
                        question["name"] = BeautifulSoup(local_name, "html.parser").get_text(" ", strip=True)
                        answer = question.setdefault("acceptedAnswer", {"@type": "Answer"})
                        answer["text"] = BeautifulSoup(local_answer, "html.parser").get_text(" ", strip=True)
                if b.get("@type") == "BreadcrumbList":
                    for item in b.get("itemListElement", []):
                        if isinstance(item, dict) and item.get("name") in CRUMB_AR:
                            item["name"] = CRUMB_AR[item["name"]]
                localise_urls(b)
        text = json.dumps(data, ensure_ascii=False, indent=2)
        script.string = NavigableString("\n" + text + "\n")


# Breadcrumb labels: the nav sits outside the i18n dictionary, so the AR mirror
# maps the English words directly. Anything missing stays English on purpose.
CRUMB_AR = {
    "Home": "الرئيسية",
    "Blog": "المدونة",
    "About": "عن شاتورا",
    "Alternatives": "البدائل",
    "Channels": "القنوات",
    "Compare": "المقارنة",
    "Contact": "تواصل معنا",
    "Features": "المزايا",
    "Integrations": "التكاملات",
    "Legal": "الشروط والخصوصية",
    "Flow builder": "باني المحادثات",
    "Pricing": "الأسعار",
    "Templates": "القوالب",
    "Use cases": "حالات الاستخدام",
    "vs Chatfuel": "ضد Chatfuel",
    "Instagram automation tools": "أدوات أتمتة إنستجرام",
    "Instagram DM sales": "بيع عبر رسائل إنستجرام",
    "ManyChat alternative": "بديل ManyChat",
    "ManyChat pricing": "أسعار ManyChat",
    "ManyChat vs Chatfuel": "ManyChat مقابل Chatfuel",
    "ManyChat alternatives in 2026": "بدائل ManyChat في 2026",
    "Chatfuel pricing": "أسعار Chatfuel",
    "Playground": "المحرر التجريبي",
    "vs ManyChat": "مقابل ManyChat",
    "Abandoned-cart messages on WhatsApp": "رسائل السلال المتروكة عبر واتساب",
    "Chatfuel pricing explained": "شرح أسعار Chatfuel",
    "Instagram DM sales guide": "دليل البيع عبر رسائل إنستجرام",
    "Instagram automation tools in 2026": "أدوات أتمتة إنستجرام في 2026",
    "ManyChat pricing explained (2026): current plans, contact limits and billing": "شرح أسعار ManyChat (2026): الخطط وحدود جهات الاتصال والفوترة",
    "ManyChat vs Chatfuel in 2026": "ManyChat مقابل Chatfuel في 2026",
    "WhatsApp API pricing in 2026": "أسعار WhatsApp API في 2026",
    "WhatsApp commerce in MENA": "التجارة عبر واتساب في منطقة الشرق الأوسط وشمال أفريقيا",
    "WhatsApp commerce": "البيع على واتساب",
    "WhatsApp API pricing": "أسعار واتساب API",
    "Abandoned carts": "السلات المتروكة",
}


def localise_crumbs(soup):
    """Translate the breadcrumb trail (aria-label stays English on purpose)."""
    crumb = soup.select_one(".crumb")
    if not crumb:
        return 0
    n = 0
    for el in crumb.find_all(["a", "span"]):
        if el.get("aria-hidden"):
            continue
        label = el.get_text(" ", strip=True)
        if label in CRUMB_AR:
            el.string = CRUMB_AR[label]
            n += 1
    return n


def build_page(out, ar):
    src = os.path.join(ROOT, out)
    html = open(src, encoding="utf-8").read()
    soup = BeautifulSoup(html, "html.parser")

    root = soup.find("html")
    root["lang"] = "ar"
    root["dir"] = "rtl"

    slug = SLUG.get(out, "home")
    title = ar.get("seo.%s.title" % slug) or (soup.title.string if soup.title else "شاتورا")
    desc = ar.get("seo.%s.desc" % slug) or ""

    hits, misses = translate(soup, ar)
    set_meta(soup, title, desc, url_for(out, True), url_for(out, False))
    localise_crumbs(soup)
    drop_feed_link(soup)
    localise_jsonld(soup, out, ar)
    prefix_assets(soup)
    pin_ltr(soup)
    redirect_skipped_links(soup)

    os.makedirs(AR_DIR, exist_ok=True)
    dest = os.path.join(AR_DIR, out)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write(str(soup))  # bs4 keeps the original doctype node
    return hits, misses


def write_sitemap(pages):
    """Write the EN/AR first-pass sitemap; build_locales.py expands it to six languages."""
    ns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    blocks = []

    for page in pages:
        out = page["out"]
        if out == "404.html" or out in ("login.html", "app.html"):
            continue
        en = url_for(out, False)
        ar = url_for(out, True)
        has_ar = out not in AR_SKIP
        prio = "1.0" if out == "index.html" else ("0.9" if out in ("pricing.html", "compare.html", "features.html") else "0.7")

        for loc in ([en, ar] if has_ar else [en]):
            alternates = ['    <xhtml:link rel="alternate" hreflang="en" href="%s"/>' % escape(en)]
            if has_ar:
                alternates.append('    <xhtml:link rel="alternate" hreflang="ar" href="%s"/>' % escape(ar))
            alternates.append('    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % escape(en))
            blocks.append(
                "\n".join(
                    ["  <url>", "    <loc>%s</loc>" % escape(loc)]
                    + alternates
                    + [
                        "    <lastmod>%s</lastmod>" % BUILD_DATE,
                        "    <changefreq>weekly</changefreq>",
                        "    <priority>%s</priority>" % prio,
                        "  </url>",
                    ]
                )
            )

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset %s>\n%s\n</urlset>\n' % (ns, "\n".join(blocks))
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(xml)
    return len(blocks)


def main():
    spec = importlib.util.spec_from_file_location("buildmod", os.path.join(ROOT, "_tools", "build.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    all_pages = mod.PAGES + [
        {"src": a["src"], "out": a["out"], "title": a["title"], "desc": a["desc"]}
        for a in mod.ARTICLES
    ]

    ar = load_ar_dict()
    total_hits = total_misses = 0
    built = 0
    for page in all_pages:
        out = page["out"]
        if not os.path.exists(os.path.join(ROOT, out)):
            continue
        if out in AR_SKIP:
            stale = os.path.join(AR_DIR, out)
            if os.path.exists(stale):
                os.remove(stale)
            strip_ar_hreflang(out)
            print("ar: %-34s skipped (body untranslated) · `hr` link removed" % out)
            continue
        hits, misses = build_page(out, ar)
        total_hits += hits
        total_misses += misses
        built += 1
        flag = "" if misses < 12 else "  ← %d untranslated" % misses
        print("ar: %-34s %3d strings%s" % (out, hits, flag))

    n = write_sitemap(all_pages)
    print("ar: %d pages · %d strings translated · %d fallbacks · sitemap %d urls"
          % (built, total_hits, total_misses, n))

    # asset cache-busting has to happen after BOTH languages are written
    try:
        from stamp import run as stamp_run
    except ImportError:
        import sys
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from stamp import run as stamp_run
    stamp_run()


if __name__ == "__main__":
    main()

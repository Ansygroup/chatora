#!/usr/bin/env python3
"""Build static ES/FR/DE/PT mirrors with localized SEO and six-way hreflang.

The English pages are the source templates. This step applies the same complete
browser dictionaries, writes language-specific title/description/canonical and
JSON-LD, then emits reciprocal hreflang and sitemap entries for every indexable
static locale page. Run by build.py after the Arabic mirror.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit
from xml.sax.saxutils import escape

from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://chatora.ansygroup.com"
LOCALES = ("es", "fr", "de", "pt")
MARKER = ".chatora-generated-locale"

CRUMBS = {
    "es": {
        "Home": "Inicio", "Blog": "Blog", "About": "Acerca de", "Alternatives": "Alternativas",
        "Channels": "Canales", "Chatfuel pricing": "Precios de Chatfuel", "Compare": "Comparar",
        "Contact": "Contacto", "Features": "Funciones", "Flow builder": "Editor de flujos",
        "Instagram DM sales": "Ventas por DM en Instagram", "Instagram automation tools": "Herramientas de automatización de Instagram",
        "Integrations": "Integraciones", "Legal": "Aviso legal", "ManyChat alternative": "Alternativa a ManyChat",
        "ManyChat pricing": "Precios de ManyChat", "ManyChat vs Chatfuel": "ManyChat vs. Chatfuel",
        "ManyChat alternatives in 2026": "Alternativas a ManyChat en 2026",
        "Abandoned-cart messages on WhatsApp": "Mensajes de carrito abandonado por WhatsApp",
        "Chatfuel pricing explained": "Precios de Chatfuel explicados",
        "Instagram DM sales guide": "Guía de ventas por DM en Instagram",
        "Instagram automation tools in 2026": "Herramientas de automatización de Instagram en 2026",
        "ManyChat pricing explained (2026): current plans, contact limits and billing": "Precios de ManyChat en 2026: planes, límites de contactos y facturación",
        "ManyChat vs Chatfuel in 2026": "ManyChat vs. Chatfuel en 2026",
        "WhatsApp API pricing in 2026": "Precios de la API de WhatsApp en 2026",
        "WhatsApp commerce in MENA": "Comercio por WhatsApp en MENA", "Playground": "Zona de pruebas",
        "Pricing": "Precios", "Templates": "Plantillas", "Use cases": "Casos de uso",
        "WhatsApp API pricing": "Precios de la API de WhatsApp", "WhatsApp commerce": "Comercio por WhatsApp",
        "Abandoned carts": "Carritos abandonados", "vs Chatfuel": "vs. Chatfuel", "vs ManyChat": "vs. ManyChat",
    },
    "fr": {
        "Home": "Accueil", "Blog": "Blog", "About": "À propos", "Alternatives": "Alternatives",
        "Channels": "Canaux", "Chatfuel pricing": "Tarifs Chatfuel", "Compare": "Comparer",
        "Contact": "Contact", "Features": "Fonctionnalités", "Flow builder": "Éditeur de parcours",
        "Instagram DM sales": "Ventes par DM Instagram", "Instagram automation tools": "Outils d’automatisation Instagram",
        "Integrations": "Intégrations", "Legal": "Mentions légales", "ManyChat alternative": "Alternative à ManyChat",
        "ManyChat pricing": "Tarifs ManyChat", "ManyChat vs Chatfuel": "ManyChat vs Chatfuel",
        "ManyChat alternatives in 2026": "Alternatives à ManyChat en 2026",
        "Abandoned-cart messages on WhatsApp": "Messages de panier abandonné sur WhatsApp",
        "Chatfuel pricing explained": "Tarifs Chatfuel expliqués",
        "Instagram DM sales guide": "Guide des ventes par DM Instagram",
        "Instagram automation tools in 2026": "Outils d’automatisation Instagram en 2026",
        "ManyChat pricing explained (2026): current plans, contact limits and billing": "Tarifs ManyChat expliqués (2026) : offres, limites de contacts et facturation",
        "ManyChat vs Chatfuel in 2026": "ManyChat vs Chatfuel en 2026",
        "WhatsApp API pricing in 2026": "Tarifs de l’API WhatsApp en 2026",
        "WhatsApp commerce in MENA": "Commerce sur WhatsApp dans la région MENA", "Playground": "Bac à sable",
        "Pricing": "Tarifs", "Templates": "Modèles", "Use cases": "Cas d’usage",
        "WhatsApp API pricing": "Tarifs de l’API WhatsApp", "WhatsApp commerce": "Commerce sur WhatsApp",
        "Abandoned carts": "Paniers abandonnés", "vs Chatfuel": "vs Chatfuel", "vs ManyChat": "vs ManyChat",
    },
    "de": {
        "Home": "Startseite", "Blog": "Blog", "About": "Über uns", "Alternatives": "Alternativen",
        "Channels": "Kanäle", "Chatfuel pricing": "Chatfuel-Preise", "Compare": "Vergleich",
        "Contact": "Kontakt", "Features": "Funktionen", "Flow builder": "Flow-Builder",
        "Instagram DM sales": "Instagram-DM-Verkäufe", "Instagram automation tools": "Instagram-Automatisierungstools",
        "Integrations": "Integrationen", "Legal": "Rechtliches", "ManyChat alternative": "ManyChat-Alternative",
        "ManyChat pricing": "ManyChat-Preise", "ManyChat vs Chatfuel": "ManyChat vs. Chatfuel",
        "ManyChat alternatives in 2026": "ManyChat-Alternativen 2026",
        "Abandoned-cart messages on WhatsApp": "WhatsApp-Nachrichten zu abgebrochenen Warenkörben",
        "Chatfuel pricing explained": "Chatfuel-Preise erklärt",
        "Instagram DM sales guide": "Leitfaden: Verkäufe über Instagram-DMs",
        "Instagram automation tools in 2026": "Instagram-Automatisierungstools 2026",
        "ManyChat pricing explained (2026): current plans, contact limits and billing": "ManyChat-Preise erklärt (2026): Tarife, Kontaktlimits und Abrechnung",
        "ManyChat vs Chatfuel in 2026": "ManyChat vs. Chatfuel 2026",
        "WhatsApp API pricing in 2026": "WhatsApp-API-Preise 2026",
        "WhatsApp commerce in MENA": "WhatsApp-Commerce in der MENA-Region", "Playground": "Flow-Playground",
        "Pricing": "Preise", "Templates": "Vorlagen", "Use cases": "Anwendungsfälle",
        "WhatsApp API pricing": "WhatsApp-API-Preise", "WhatsApp commerce": "WhatsApp-Commerce",
        "Abandoned carts": "Abgebrochene Warenkörbe", "vs Chatfuel": "vs. Chatfuel", "vs ManyChat": "vs. ManyChat",
    },
    "pt": {
        "Home": "Início", "Blog": "Blog", "About": "Sobre", "Alternatives": "Alternativas",
        "Channels": "Canais", "Chatfuel pricing": "Preços do Chatfuel", "Compare": "Comparar",
        "Contact": "Contato", "Features": "Recursos", "Flow builder": "Construtor de fluxos",
        "Instagram DM sales": "Vendas por DM no Instagram", "Instagram automation tools": "Ferramentas de automação do Instagram",
        "Integrations": "Integrações", "Legal": "Jurídico", "ManyChat alternative": "Alternativa ao ManyChat",
        "ManyChat pricing": "Preços do ManyChat", "ManyChat vs Chatfuel": "ManyChat vs. Chatfuel",
        "ManyChat alternatives in 2026": "Alternativas ao ManyChat em 2026",
        "Abandoned-cart messages on WhatsApp": "Mensagens de carrinho abandonado no WhatsApp",
        "Chatfuel pricing explained": "Preços do Chatfuel explicados",
        "Instagram DM sales guide": "Guia de vendas por DM no Instagram",
        "Instagram automation tools in 2026": "Ferramentas de automação do Instagram em 2026",
        "ManyChat pricing explained (2026): current plans, contact limits and billing": "Preços do ManyChat explicados (2026): planos, limites de contatos e cobrança",
        "ManyChat vs Chatfuel in 2026": "ManyChat vs. Chatfuel em 2026",
        "WhatsApp API pricing in 2026": "Preços da API do WhatsApp em 2026",
        "WhatsApp commerce in MENA": "Comércio por WhatsApp na região MENA", "Playground": "Área de testes",
        "Pricing": "Preços", "Templates": "Modelos", "Use cases": "Casos de uso",
        "WhatsApp API pricing": "Preços da API do WhatsApp", "WhatsApp commerce": "Comércio pelo WhatsApp",
        "Abandoned carts": "Carrinhos abandonados", "vs Chatfuel": "vs. Chatfuel", "vs ManyChat": "vs. ManyChat",
    },
}

FAQ_TRANSLATION_KEYS = {
    "index.html": [(f"faq.q{i}", f"faq.a{i}") for i in range(1, 9)],
    "pricing.html": [(f"faq.q{i}", f"faq.a{i}") for i in range(1, 9)],
    "vs-manychat.html": [(f"mc.q{i}", f"mc.a{i}") for i in range(1, 6)],
    "blog-abandoned-cart-whatsapp.html": [("a7.b37", "a7.b38"), ("a7.b39", "a7.b40"), ("a7.b41", "a7.b42")],
    "blog-whatsapp-api-pricing.html": [("a6.b47", "a6.b48"), ("a6.b49", "a6.b50"), ("a6.b51", "a6.b52"), ("a6.b53", "a6.b54")],
    "blog-chatfuel-pricing.html": [("a9.b30", "a9.b31"), ("a9.b32", "a9.b33"), ("a9.b34", "a9.b35"), ("a9.b36", "a9.b37")],
    "blog-manychat-vs-chatfuel.html": [("a8.b33", "a8.b34"), ("a8.b35", "a8.b36"), ("a8.b37", "a8.b38"), ("a8.b39", "a8.b40")],
}


def load_build_modules():
    def load(name: str, path: Path):
        spec = importlib.util.spec_from_file_location(name, path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Cannot load {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    return load("chatora_build", ROOT / "_tools" / "build.py"), load(
        "chatora_build_ar", ROOT / "_tools" / "build_ar.py"
    )


def load_dictionaries() -> dict[str, dict[str, str]]:
    script = r"""
const fs = require('fs');
global.window = {}; global.AR = false;
eval(fs.readFileSync('assets/js/i18n.js', 'utf8'));
eval(fs.readFileSync('assets/js/i18n-pages.js', 'utf8'));
const I = window.CHATORA_I18N || {}, P = window.CHATORA_I18N_PAGES || {}, out = {};
for (const l of ['es','fr','de','pt']) out[l] = Object.assign({}, I[l] || {}, P[l] || {});
process.stdout.write(JSON.stringify(out));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Could not parse locale dictionaries: " + result.stderr.strip())
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Locale dictionary helper returned invalid JSON") from exc


def published_codes() -> list[str]:
    manifest = (ROOT / "assets/js/langs.js").read_text(encoding="utf-8")
    match = re.search(r"CHATORA_AVAILABLE_LANGS\s*=\s*(\[[^;]+\])", manifest)
    if not match:
        raise RuntimeError("Could not read generated language manifest")
    codes = json.loads(match.group(1))
    return [code for code in ("en", "ar", "es", "fr", "de", "pt") if code in codes]


def all_pages(build):
    return build.PAGES + [
        {
            "src": a["src"], "out": a["out"], "title": a["title"], "desc": a["desc"],
            "title_key": "", "active": "BLOG", "jsonld_path": a["jsonld"],
        }
        for a in build.ARTICLES
    ]


def localized_url(lang: str, out: str) -> str:
    tail = "" if out == "index.html" else out
    if lang == "en":
        return BASE + "/" + tail
    return BASE + "/" + lang + "/" + tail


def page_key_text(soup: BeautifulSoup, key: str | None) -> str:
    if not key:
        return ""
    element = soup.select_one(f'[data-i18n="{key}"]')
    return element.get_text(" ", strip=True) if element else ""


def plain(value: str) -> str:
    return BeautifulSoup(value or "", "html.parser").get_text(" ", strip=True).replace("\xa0", " ")


def trim_description(value: str, limit: int = 160) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= limit:
        return value
    chunk = value[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:—–-")
    return (chunk or value[: limit - 1].rstrip()) + "…"


def translated_meta(page: dict, soup: BeautifulSoup, locale: dict, slug: str, indexable: bool):
    title_key = page.get("title_key") or f"seo.{slug}.title"
    title = plain(locale.get(title_key, ""))
    if not title:
        h1 = soup.find("h1")
        title = h1.get_text(" ", strip=True) if h1 else ""
        if title and "chatora" not in title.lower():
            title += " | Chatora"
    if not title:
        raise RuntimeError(f"No localized SEO title for {page['out']}")

    desc_key = f"seo.{slug}.desc"
    description = plain(locale.get(desc_key, ""))
    if not description:
        lead = soup.select_one(".article-head .lede, .hero-lede, .lede")
        if lead:
            description = lead.get_text(" ", strip=True)
    if not description:
        for paragraph in soup.select("main p[data-i18n]"):
            content = paragraph.get_text(" ", strip=True)
            if len(content) >= 40:
                description = content
                break
    if not description and indexable:
        raise RuntimeError(f"No localized SEO description/lead for {page['out']}")
    if not description:
        description = title
    return title, trim_description(description)


def translate_markup(soup: BeautifulSoup, locale: dict, lang: str, out: str):
    missing = []
    # Snapshot first, matching the client translator's innerHTML replacement order.
    for element in soup.select("[data-i18n]"):
        key = element.get("data-i18n")
        if key not in locale:
            missing.append(key)
            continue
        fragment = BeautifulSoup(str(locale[key]), "html.parser")
        icons = [icon.extract() for icon in element.find_all("svg")]
        element.clear()
        for icon in icons:
            element.append(icon)
        for child in list(fragment.contents):
            element.append(child.extract())

    for attr, target in (("data-i18n-ph", "placeholder"), ("data-i18n-aria", "aria-label"), ("data-i18n-title", "title"), ("data-i18n-alt", "alt")):
        for element in soup.select(f"[{attr}]"):
            key = element.get(attr)
            if key not in locale:
                missing.append(key)
                continue
            element[target] = locale[key]

    if missing:
        raise RuntimeError(f"{lang}/{out}: missing {len(missing)} translation keys: {', '.join(sorted(set(missing))[:12])}")


def localize_breadcrumbs(soup: BeautifulSoup, lang: str):
    labels = CRUMBS[lang]
    crumb = soup.select_one(".crumb")
    if not crumb:
        return
    for element in crumb.find_all(["a", "span"]):
        if element.get("aria-hidden"):
            continue
        value = element.get_text(" ", strip=True)
        if value in labels:
            element.string = labels[value]


def prefix_assets(soup: BeautifulSoup):
    for element in soup.find_all(True):
        for attr in ("src", "href", "poster", "data-src"):
            value = element.get(attr)
            if isinstance(value, str) and value.startswith("assets/"):
                element[attr] = "../" + value
        srcset = element.get("srcset")
        if isinstance(srcset, str) and srcset.strip() and not srcset.lstrip().lower().startswith("data:"):
            candidates = []
            for candidate in srcset.split(","):
                parts = candidate.strip().split()
                if parts and parts[0].startswith("assets/"):
                    parts[0] = "../" + parts[0]
                candidates.append(" ".join(parts))
            element["srcset"] = ", ".join(candidates)


def localize_internal_links(soup: BeautifulSoup, lang: str, page_names: set[str]):
    """Keep first-party page navigation inside the selected static language route."""
    for element in soup.find_all(href=True):
        value = element.get("href")
        if not isinstance(value, str) or not value or value.startswith(("#", "?", "//")):
            continue
        parts = urlsplit(value)
        if parts.scheme and parts.netloc.lower() != "chatora.ansygroup.com":
            continue
        if parts.netloc and parts.netloc.lower() != "chatora.ansygroup.com":
            continue
        path = parts.path
        if not path or path.startswith(("/assets/", "assets/")):
            continue
        path = path.lstrip("/")
        path = re.sub(r"^(?:\\./)+", "", path)
        if path.startswith(("ar/", "es/", "fr/", "de/", "pt/")):
            continue
        if path == "" or path == "index.html":
            target = f"/{lang}/"
        elif path in page_names:
            target = f"/{lang}/{path}"
        else:
            continue
        element["href"] = target + (("?" + parts.query) if parts.query else "") + (("#" + parts.fragment) if parts.fragment else "")


def url_for_schema(value, lang: str, page_names: set[str]):
    if not isinstance(value, str) or not value.startswith(BASE):
        return value
    suffix = value[len(BASE):]
    parts = urlsplit(suffix)
    path = parts.path.lstrip("/")
    path = re.sub(r"^(?:ar|es|fr|de|pt)/", "", path)
    if not path or path == "index.html":
        target = localized_url(lang, "index.html")
    elif path in page_names:
        target = localized_url(lang, path)
    else:
        return value
    if parts.query:
        target += "?" + parts.query
    if parts.fragment:
        target += "#" + parts.fragment
    return target


def localize_jsonld(soup: BeautifulSoup, locale: dict, lang: str, out: str, page_names: set[str], title: str, desc: str):
    def localize_urls(node):
        if isinstance(node, dict):
            for key, value in list(node.items()):
                if node.get("@type") == "Organization" and key in ("url", "@id"):
                    continue  # the organization identity keeps its canonical root URL
                if key in ("url", "@id", "item", "target") and isinstance(value, str):
                    node[key] = url_for_schema(value, lang, page_names)
                else:
                    localize_urls(value)
        elif isinstance(node, list):
            for value in node:
                localize_urls(value)

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Invalid JSON-LD in {out}: {exc}") from exc
        blobs = data if isinstance(data, list) else [data]
        h1 = soup.find("h1")
        headline = h1.get_text(" ", strip=True) if h1 else title
        for blob in blobs:
            if not isinstance(blob, dict) or "@context" not in blob:
                continue
            blob["inLanguage"] = lang
            kind = blob.get("@type")
            if kind == "WebSite":
                blob["url"] = localized_url(lang, "index.html")
                action = blob.get("potentialAction")
                if isinstance(action, dict) and isinstance(action.get("target"), str):
                    action["target"] = url_for_schema(action["target"], lang, page_names)
            elif kind == "SoftwareApplication":
                blob["description"] = desc
            elif kind == "Article":
                blob["headline"] = headline
                if "description" in blob:
                    blob["description"] = desc
            elif kind == "BreadcrumbList":
                for item in blob.get("itemListElement", []):
                    if not isinstance(item, dict):
                        continue
                    item["name"] = CRUMBS[lang].get(item.get("name"), item.get("name"))
                    if isinstance(item.get("item"), str):
                        item["item"] = url_for_schema(item["item"], lang, page_names)
            elif kind == "FAQPage":
                questions = blob.get("mainEntity", [])
                pairs = FAQ_TRANSLATION_KEYS.get(out)
                if pairs is None or len(questions) != len(pairs):
                    raise RuntimeError(f"FAQ JSON-LD mapping is missing or out of sync for {out}")
                for question, (question_key, answer_key) in zip(questions, pairs):
                    name, answer = locale.get(question_key), locale.get(answer_key)
                    if not isinstance(question, dict) or not name or not answer:
                        raise RuntimeError(f"Missing translated FAQ data ({question_key}/{answer_key}) for {lang}/{out}")
                    question["name"] = plain(name)
                    accepted = question.setdefault("acceptedAnswer", {"@type": "Answer"})
                    accepted["text"] = plain(answer)
            # Recurse to localize nested mainEntityOfPage.@id and SearchAction URLs.
            localize_urls(blob)

        script.string = NavigableString("\n" + json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def set_meta(soup: BeautifulSoup, lang: str, out: str, title: str, desc: str):
    canonical = localized_url(lang, out)
    if soup.title:
        soup.title.string = title
    for meta in soup.find_all("meta"):
        prop = (meta.get("property") or meta.get("name") or "").lower()
        if prop in ("description", "og:description", "twitter:description"):
            meta["content"] = desc
        elif prop in ("og:title", "twitter:title"):
            meta["content"] = title
        elif prop == "og:url":
            meta["content"] = canonical

    canonical_link = soup.find("link", rel=lambda rel: rel and "canonical" in rel)
    if canonical_link:
        canonical_link["href"] = canonical

    # The RSS feed is English-only; do not advertise it from a translated page.
    for feed in soup.select('link[type="application/rss+xml"]'):
        feed.decompose()


def add_hreflang(soup: BeautifulSoup, out: str, codes: list[str], indexable: bool):
    for link in list(soup.find_all("link", rel=True)):
        rel = {item.lower() for item in (link.get("rel") or [])}
        if "alternate" in rel and link.get("hreflang"):
            link.decompose()
    if not indexable:
        return
    head = soup.head
    canonical = soup.find("link", rel=lambda rel: rel and "canonical" in rel)
    if not head or not canonical:
        raise RuntimeError("Cannot add hreflang without <head> and canonical link")
    tags = [("x-default", "en")] + [(code, code) for code in codes if code != "en"]
    for hreflang, code in tags:
        link = soup.new_tag("link", rel="alternate", hreflang=hreflang, href=localized_url(code, out))
        canonical.insert_after(link)
        canonical = link


def write_sitemap(pages, codes: list[str], build_date: str):
    xmlns = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    blocks = []
    for page in pages:
        out = page["out"]
        if out == "404.html" or page.get("noindex"):
            continue
        priority = "1.0" if out == "index.html" else ("0.9" if out in ("pricing.html", "compare.html", "features.html") else "0.7")
        alternates = []
        for code in codes:
            alternates.append('    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (escape(code), escape(localized_url(code, out))))
        alternates.append('    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % escape(localized_url("en", out)))
        for code in codes:
            loc = localized_url(code, out)
            blocks.append("\n".join([
                "  <url>", "    <loc>%s</loc>" % escape(loc), *alternates,
                "    <lastmod>%s</lastmod>" % build_date,
                "    <changefreq>weekly</changefreq>", "    <priority>%s</priority>" % priority,
                "  </url>",
            ]))
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset %s>\n%s\n</urlset>\n' % (xmlns, "\n".join(blocks))
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
    return len(blocks)


def clean_unpublished_locale(lang: str, pages):
    directory = ROOT / lang
    marker = directory / MARKER
    if not marker.exists():
        return
    for page in pages:
        target = directory / page["out"]
        if target.exists():
            target.unlink()
    marker.unlink(missing_ok=True)
    try:
        directory.rmdir()
    except OSError:
        pass  # keep any unrelated files the owner may have added


def build():
    build, arabic = load_build_modules()
    pages = all_pages(build)
    page_names = {page["out"] for page in pages}
    codes = published_codes()
    if not {"en", "ar"}.issubset(codes):
        raise RuntimeError("English and Arabic must remain available in the language manifest")
    dictionaries = load_dictionaries()
    built = {lang: 0 for lang in LOCALES}
    translated = {lang: 0 for lang in LOCALES}

    for lang in LOCALES:
        if lang not in codes:
            clean_unpublished_locale(lang, pages)
            continue
        locale = dictionaries.get(lang)
        if not locale:
            raise RuntimeError(f"Published locale {lang} has no dictionary")
        directory = ROOT / lang
        marker = directory / MARKER
        if directory.exists() and not marker.exists() and any(directory.iterdir()):
            raise RuntimeError(f"Refusing to overwrite non-generated locale directory: {directory}")
        directory.mkdir(parents=True, exist_ok=True)

        for page in pages:
            out = page["out"]
            source_path = ROOT / out
            if not source_path.exists():
                raise RuntimeError(f"Missing English source page: {source_path}")
            soup = BeautifulSoup(source_path.read_text(encoding="utf-8"), "html.parser")
            root = soup.find("html")
            if root is None:
                raise RuntimeError(f"No <html> element in {source_path}")
            root["lang"] = lang
            root["dir"] = "ltr"
            translate_markup(soup, locale, lang, out)
            localize_breadcrumbs(soup, lang)

            slug = arabic.SLUG.get(out, "")
            title, desc = translated_meta(page, soup, locale, slug, not page.get("noindex") and out != "404.html")
            set_meta(soup, lang, out, title, desc)
            localize_jsonld(soup, locale, lang, out, page_names, title, desc)
            localize_internal_links(soup, lang, page_names)
            prefix_assets(soup)
            indexable = not page.get("noindex") and out != "404.html"
            add_hreflang(soup, out, codes, indexable)

            dest = directory / out
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(str(soup), encoding="utf-8")
            built[lang] += 1
        marker.write_text("Generated by _tools/build_locales.py\n", encoding="utf-8")

    # Now that every mirror exists, give EN, AR and each published locale the
    # same reciprocal hreflang set. The Arabic builder emits the first pass.
    for page in pages:
        out = page["out"]
        indexable = not page.get("noindex") and out != "404.html"
        for lang in codes:
            path = ROOT / out if lang == "en" else ROOT / lang / out
            if not path.exists():
                if indexable:
                    raise RuntimeError(f"Published hreflang target missing: {path}")
                continue
            soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
            add_hreflang(soup, out, codes, indexable)
            path.write_text(str(soup), encoding="utf-8")

    count = write_sitemap(pages, codes, build.BUILD_DATE)
    # Stamping after all locale copies are generated keeps deep-path assets fresh.
    sys.path.insert(0, str(ROOT / "_tools"))
    from stamp import run as stamp_run
    stamped = stamp_run()

    for lang in LOCALES:
        if lang in codes:
            print(f"{lang}: {built[lang]} static pages · translated markup verified")
    print(f"locales: sitemap {count} urls · final asset stamp touched {stamped} pages")
    return count


if __name__ == "__main__":
    build()

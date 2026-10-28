#!/usr/bin/env python3
"""Tiny static-site builder for Chatora: stitches partials into pages."""
import json
import os
import re
from datetime import date
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://chatora.ansygroup.com"
BUILD_DATE = date.today().isoformat()

PAGES = [
    {
        "src": "index.html",
        "out": "index.html",
        "title": "Chatora — AI Chat Marketing for Instagram, WhatsApp & TikTok | Preview",
        "desc": "Chatora is an AI chat-marketing platform preview for Instagram, WhatsApp, TikTok and Messenger workflows. Explore editable flow drafts, templates and contact tools; live channel connections, AI replies and paid plans are not available yet.",
        "title_key": "seo.home.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Chatora",
                "url": BASE,
                "logo": BASE + "/assets/img/logo.svg",
            },
            {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "Chatora",
                "url": BASE,
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": BASE + "/blog.html?q={search_term_string}",
                    "query-input": "required name=search_term_string",
                },
            },
            {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "Chatora",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "Bilingual AI chat-marketing product preview with editable messaging-flow drafts and contact tools. Live channel connections, outbound messages and AI replies are not available yet.",
            },
        ],
    },
    {
        "src": "features.html",
        "out": "features.html",
        "title": "Features — AI chat marketing, visual flows & inbox | Chatora",
        "desc": "Explore Chatora’s AI chat-marketing feature set and current preview: editable flow drafts, templates, contact CSV tools and audience preview. AI replies and live channel messaging are not available yet.",
        "title_key": "seo.features.title",
        "active": "FEATURES",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Features", "item": BASE + "/features.html"},
                ],
            }
        ],
    },
    {
        "src": "pricing.html",
        "out": "pricing.html",
        "title": "Chatora pricing — plans and current availability | Chatora",
        "desc": "Chatora has not published paid subscription prices or enabled checkout. Compare pages show dated third-party pricing snapshots only; they are not Chatora prices. Provider messaging fees may be separate.",
        "title_key": "seo.pricing.title",
        "active": "PRICING",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Pricing", "item": BASE + "/pricing.html"},
                ],
            },
        ],
    },
    {
        "src": "channels.html",
        "out": "channels.html",
        "title": "Channels — Instagram, WhatsApp, TikTok & more | Chatora",
        "desc": "Explore Chatora’s planned Instagram, WhatsApp, TikTok, Messenger and other messaging workflows. These channels are not connected in the current preview; workspace channel labels are labels, not integrations.",
        "title_key": "seo.channels.title",
        "active": "CHANNELS",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Channels", "item": BASE + "/channels.html"},
                ],
            }
        ],
    },
    {
        "src": "compare.html",
        "out": "compare.html",
        "title": "Chatora vs ManyChat (October 2026) — features & published pricing",
        "desc": "A dated comparison of ManyChat’s published plans and Chatora’s current preview. Chatora has no live channel integrations or published subscription price, so no savings claim is made.",
        "title_key": "seo.compare.title",
        "active": "COMPARE",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Compare", "item": BASE + "/compare.html"},
                ],
            }
        ],
    },
    {
        "src": "integrations.html",
        "out": "integrations.html",
        "title": "Integrations — messaging, commerce & CRM | Chatora",
        "desc": "Explore planned messaging, commerce and CRM integrations for Chatora. Native channel and third-party connectors are not available in the current preview; contact and template CSV workflows are supported.",
        "title_key": "seo.integrations.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Integrations", "item": BASE + "/integrations.html"},
                ],
            }
        ],
    },
    {
        "src": "templates.html",
        "out": "templates.html",
        "title": "45 messaging flow templates for Instagram, WhatsApp & TikTok | Chatora",
        "desc": "Browse 45 editable messaging-flow starter drafts for Instagram, WhatsApp and TikTok. These examples are not production-tested or connected to live channels; choosing one creates a draft, not a sent message.",
        "title_key": "seo.templates.title",
        "active": "TEMPLATES",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Templates", "item": BASE + "/templates.html"},
                ],
            }
        ],
    },
    {
        "src": "use-cases.html",
        "out": "use-cases.html",
        "title": "Use cases — e-commerce, creators, agencies & clinics | Chatora",
        "desc": "Illustrative workflow ideas for shops, creators, agencies, and clinics. They are not customer case studies, measured outcomes, or live channel automations.",
        "title_key": "seo.usecases.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Use cases", "item": BASE + "/use-cases.html"},
                ],
            }
        ],
    },
    {
        "src": "playground.html",
        "out": "playground.html",
        "title": "Flow builder playground — build a chat flow in your browser | Chatora",
        "desc": "Try a browser-based flow simulation. It does not connect to messaging providers, use customer data, or send messages.",
        "title_key": "seo.playground.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Playground", "item": BASE + "/playground.html"},
                ],
            }
        ],
    },
    {
        "src": "vs-chatfuel.html",
        "out": "vs-chatfuel.html",
        "title": "Chatora vs Chatfuel (October 2026) — features & published pricing",
        "desc": "A source-dated overview of Chatfuel’s published plan and Chatora’s current preview. Chatora has no live channel integrations or published pricing, so there is no cost-savings claim.",
        "title_key": "seo.vschatfuel.title",
        "active": "COMPARE",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Compare", "item": BASE + "/compare.html"},
                    {"@type": "ListItem", "position": 3, "name": "vs Chatfuel", "item": BASE + "/vs-chatfuel.html"},
                ],
            }
        ],
    },
    {
        "src": "login.html",
        "out": "login.html",
        "title": "Log in · Chatora",
        "desc": "Sign in to your Chatora workspace.",
        "title_key": "",
        "active": None,
        "noindex": True,
        "jsonld": [],
    },
    {
        "src": "app.html",
        "out": "app.html",
        "title": "Your workspace · Chatora",
        "desc": "Chatora workspace dashboard.",
        "title_key": "",
        "active": None,
        "noindex": True,
        "jsonld": [],
    },
    {
        "src": "vs-manychat.html",
        "out": "vs-manychat.html",
        "title": "Chatora vs ManyChat (2026): published prices and WhatsApp fees",
        "desc": "An October 2026 comparison of ManyChat’s public US plan prices and Egypt WhatsApp rates, alongside Chatora’s current preview. Chatora has no published price or live channel integrations; prices and provider fees vary by region and usage.",
        "title_key": "seo.vsmanychat.title",
        "active": "COMPARE",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Compare", "item": BASE + "/compare.html"},
                    {"@type": "ListItem", "position": 3, "name": "vs ManyChat", "item": BASE + "/vs-manychat.html"},
                ],
            },
            {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": "Is Chatora cheaper than ManyChat?",
                     "acceptedAnswer": {"@type": "Answer", "text": "Chatora has no published subscription price, so no savings calculation is available. The page compares dated ManyChat public prices with Chatora's current product preview."}},
                    {"@type": "Question", "name": "What does ManyChat cost in the United States?",
                     "acceptedAnswer": {"@type": "Answer", "text": "The public pricing page checked in October 2026 lists Free at 25 active contacts, Essential at $14/month, Pro at $29/month, and Business at $69/month when billed annually. Confirm current regional pricing, limits, and taxes with ManyChat."}},
                    {"@type": "Question", "name": "Can I migrate my ManyChat flows to Chatora?",
                     "acceptedAnswer": {"@type": "Answer", "text": "A migration tool is not available in the current Chatora preview. Its template gallery contains editable starter drafts that can be reviewed manually."}},
                    {"@type": "Question", "name": "Does Chatora use the official WhatsApp API?",
                     "acceptedAnswer": {"@type": "Answer", "text": "No WhatsApp provider is connected in the current preview. Any future integration will require selecting a provider and configuring credentials."}},
                    {"@type": "Question", "name": "Does Chatora support Arabic?",
                     "acceptedAnswer": {"@type": "Answer", "text": "The product website and workspace preview support Arabic and English interfaces. Live AI replies and messaging integrations are not available yet."}}
                ]
            },
        ],
    },
    {
        "src": "alternatives.html",
        "out": "alternatives.html",
        "title": "ManyChat alternatives in 2026: compare by use case | Chatora",
        "desc": "Compare five established ManyChat alternatives by use case and dated public pricing. Chatora is a product preview without live messaging or a published subscription price.",
        "title_key": "seo.alternatives.title",
        "active": "COMPARE",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Alternatives", "item": BASE + "/alternatives.html"},
                ],
            }
        ],
    },
    {
        "src": "blog.html",
        "out": "blog.html",
        "title": "Chat marketing guides, pricing & playbooks | Chatora",
        "desc": "Educational guides with clearly labeled examples and dated links to vendor or platform pricing. Chatora has no live messaging integrations or customer performance data yet.",
        "title_key": "seo.blog.title",
        "active": "BLOG",
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Blog", "item": BASE + "/blog.html"},
                ],
            }
        ],
    },
    {
        "src": "contact.html",
        "out": "contact.html",
        "title": "Contact — talk to a human | Chatora",
        "desc": "Contact Chatora with product questions, feedback or partnership enquiries. Response times and migration support are not guaranteed.",
        "title_key": "seo.contact.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "ContactPage",
                "name": "Contact Chatora",
                "url": BASE + "/contact.html",
                "inLanguage": "en",
                "mainEntity": {
                    "@type": "Organization",
                    "name": "Chatora",
                    "url": BASE,
                    "email": "hello@chatora.ansygroup.com",
                    "contactPoint": {
                        "@type": "ContactPoint",
                        "contactType": "customer support",
                        "email": "hello@chatora.ansygroup.com",
                        "availableLanguage": ["English", "Arabic"],
                    },
                },
            },
        ],
    },
    {
        "src": "about.html",
        "out": "about.html",
        "title": "About Chatora — the team rebuilding chat marketing",
        "desc": "Learn about Chatora’s approach to chat marketing and messaging workflows. The product is currently a preview; live channel connections, message sending and AI replies are not available yet.",
        "title_key": "seo.about.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "AboutPage",
                "name": "About Chatora",
                "url": BASE + "/about.html",
            }
        ],
    },
    {
        "src": "legal.html",
        "out": "legal.html",
        "title": "Privacy, Terms & Data Processing | Chatora",
        "desc": "How Chatora handles your data, the terms of service, and our data processing addendum.",
        "title_key": "seo.legal.title",
        "active": None,
        "jsonld": [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
                    {"@type": "ListItem", "position": 2, "name": "Legal", "item": BASE + "/legal.html"},
                ],
            }
        ],
    },
    {
        "src": "_404.html",
        "out": "404.html",
        "title": "Page not found | Chatora",
        "desc": "That page took a different route. Let’s get you back to building conversations that sell.",
        "title_key": "seo.404.title",
        "active": None,
        "jsonld": [],
    },
]

ARTICLES = [
    {
        "src": "blog-manychat-alternative.html",
        "out": "blog-manychat-alternative.html",
        "title": "ManyChat alternatives in 2026: plans and trade-offs | Chatora",
        "desc": "A dated comparison of ManyChat’s published plans and questions to ask before switching. Chatora is a product preview without a published subscription price or live channel messaging.",
        "jsonld": "/blog-manychat-alternative.jsonld",
    },
    {
        "src": "blog-instagram-dm-sales.html",
        "out": "blog-instagram-dm-sales.html",
        "title": "How to turn Instagram DMs into a sales channel (2026 playbook) | Chatora",
        "desc": "A practical checklist for planning opt-in Instagram workflows. Examples are illustrative; no response-time benchmark or Chatora customer outcome is claimed.",
        "jsonld": "/blog-instagram-dm-sales.jsonld",
    },
    {
        "src": "blog-whatsapp-commerce.html",
        "out": "blog-whatsapp-commerce.html",
        "title": "WhatsApp commerce in MENA: the 2026 playbook | Chatora",
        "desc": "A neutral guide to consent, official provider access, templates, and Meta message charges. No channel integration or conversion result is claimed for Chatora.",
        "jsonld": "/blog-whatsapp-commerce.jsonld",
    },
    {
        "src": "blog-manychat-pricing.html",
        "out": "blog-manychat-pricing.html",
        "title": "ManyChat pricing explained (2026): published tiers and what to verify | Chatora",
        "desc": "A dated summary of ManyChat’s public plan page. Your country, billing interval, taxes, and usage can change the final amount; confirm details before purchase.",
        "jsonld": "/blog-manychat-pricing.jsonld",
    },
    {
        "src": "blog-abandoned-cart-whatsapp.html",
        "out": "blog-abandoned-cart-whatsapp.html",
        "title": "WhatsApp abandoned-cart messages: copy and fee scenarios | Chatora",
        "desc": "Illustrative cart-reminder copy and Meta fee scenarios. Message category, consent, provider charges and customer results depend on current rules and account data.",
        "jsonld": "/blog-abandoned-cart-whatsapp.jsonld",
    },
    {
        "src": "blog-whatsapp-api-pricing.html",
        "out": "blog-whatsapp-api-pricing.html",
        "title": "WhatsApp API pricing in Egypt (2026): Meta rates and assumptions | Chatora",
        "desc": "Meta’s published Egypt rates effective 1 October 2026, with worked examples labeled as estimates. Provider charges, taxes, and eligibility may differ.",
        "jsonld": "/blog-whatsapp-api-pricing.jsonld",
    },
    {
        "src": "blog-chatfuel-pricing.html",
        "out": "blog-chatfuel-pricing.html",
        "title": "Chatfuel pricing explained (2026): plans and AI credits | Chatora",
        "desc": "A dated overview of Chatfuel’s published subscription prices, monthly credits and wallet billing model. Costs vary with usage; verify current account terms and Meta message fees before estimating a total.",
        "jsonld": "/blog-chatfuel-pricing.jsonld",
    },
    {
        "src": "blog-manychat-vs-chatfuel.html",
        "out": "blog-manychat-vs-chatfuel.html",
        "title": "ManyChat vs Chatfuel (2026): published pricing models | Chatora",
        "desc": "A dated comparison of ManyChat contact-tier prices, Chatfuel subscriptions, credits and wallet usage, and Egypt WhatsApp fee references. Chatora has no published price or live channels, so no all-in total is claimed.",
        "jsonld": "/blog-manychat-vs-chatfuel.jsonld",
    },
    {
        "src": "blog-instagram-automation-tools.html",
        "out": "blog-instagram-automation-tools.html",
        "title": "Instagram automation tools in 2026: what to verify | Chatora",
        "desc": "A dated buyer checklist for official API access, comment and DM workflows, rate limits and plan terms. No Chatora performance benchmark or load test is claimed.",
        "jsonld": "/blog-instagram-automation-tools.jsonld",
    },

]



FAQ_INDEX = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {"@type": "Question", "name": "Is Chatora cheaper than ManyChat?",
         "acceptedAnswer": {"@type": "Answer", "text": "Chatora has not published subscription pricing, so a savings claim cannot be calculated. ManyChat’s public US plan prices are shown with a check date on the comparison page; confirm regional price, billing and taxes with ManyChat."}},
        {"@type": "Question", "name": "Will automating my Instagram get my account banned?",
         "acceptedAnswer": {"@type": "Answer", "text": "Chatora does not automate Instagram in the current preview. No channel provider is connected. Any future integration must use an approved provider and follow the platform’s current policies; no account-safety guarantee is made."}},
        {"@type": "Question", "name": "Do I need to know how to code?",
         "acceptedAnswer": {"@type": "Answer", "text": "No coding is needed to explore the current draft editor, CSV tools or local flow simulation. AI-generated flows, a public API and webhooks are not available in this preview."}},
        {"@type": "Question", "name": "What counts as an \"active contact\"?",
         "acceptedAnswer": {"@type": "Answer", "text": "Chatora has not published contact-based plan limits or billing rules. The preview has no subscription billing; see the pricing page for current availability."}},
        {"@type": "Question", "name": "Does the AI speak Arabic?",
         "acceptedAnswer": {"@type": "Answer", "text": "The website and workspace interface are available in Arabic and English. Live AI replies are not available in the current preview."}},
        {"@type": "Question", "name": "Can I migrate my ManyChat flows?",
         "acceptedAnswer": {"@type": "Answer", "text": "A ManyChat migration tool or assisted migration service is not available. You can review and manually adapt the editable starter drafts in the gallery."}},
        {"@type": "Question", "name": "Is there a free plan?",
         "acceptedAnswer": {"@type": "Answer", "text": "Chatora has not announced free or paid subscription plans. Billing and checkout are not enabled in the current product preview; this is not a published free subscription."}},
        {"@type": "Question", "name": "How fast is support?",
         "acceptedAnswer": {"@type": "Answer", "text": "Contact Chatora through the contact page for questions. Response times, 24/7 availability and dedicated support are not guaranteed."}}
    ]
}

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


FEEDLINK = '<link rel="alternate" type="application/rss+xml" title="Chatora blog — new playbooks" href="%s/rss.xml">' % BASE


def write_rss():
    """rss.xml straight from the article list that builds the pages.

    Google ignores RSS for ranking, but feed readers and AI crawlers
    (ChatGPT, Perplexity) do pick it up — and it costs one file at build time.
    """
    from datetime import datetime, timezone
    from email.utils import format_datetime

    items = []
    for a in ARTICLES:
        jl_path = os.path.join(ROOT, a["jsonld"].lstrip("/"))
        published = "2026-10-20"
        if os.path.exists(jl_path):
            try:
                data = json.load(open(jl_path, encoding="utf-8"))
                for b in (data if isinstance(data, list) else [data]):
                    if isinstance(b, dict) and b.get("datePublished"):
                        published = b["datePublished"][:10]
                        break
            except Exception:
                pass
        dt = datetime.strptime(published, "%Y-%m-%d").replace(hour=9, tzinfo=timezone.utc)
        link = BASE + "/" + a["out"]
        items.append((dt, a["title"].split(" | ")[0].strip(), link, a["desc"]))

    items.sort(key=lambda x: x[0], reverse=True)

    body = []
    for dt, title, link, desc in items:
        body.append(
            "    <item>\n"
            "      <title>%s</title>\n"
            "      <link>%s</link>\n"
            '      <guid isPermaLink="true">%s</guid>\n'
            "      <pubDate>%s</pubDate>\n"
            "      <description>%s</description>\n"
            "    </item>" % (escape(title), escape(link), escape(link), format_datetime(dt), escape(desc))
        )

    last = format_datetime(items[0][0]) if items else format_datetime(datetime.now(timezone.utc))
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        "    <title>Chatora blog — conversation marketing playbooks</title>\n"
        "    <link>%s/blog.html</link>\n"
        "    <description>Honest, dated playbooks for selling in Instagram DMs, WhatsApp and Telegram: pricing maths, migration notes and the flows that convert.</description>\n"
        "    <language>en</language>\n"
        "    <lastBuildDate>%s</lastBuildDate>\n"
        '    <atom:link href="%s/rss.xml" rel="self" type="application/rss+xml"/>\n'
        "%s\n"
        "  </channel>\n"
        "</rss>\n"
    ) % (BASE, last, BASE, "\n".join(body))

    open(os.path.join(ROOT, "rss.xml"), "w", encoding="utf-8").write(xml)
    return len(items)


LANG_META = {
    "en": ("English", "English"),
    "ar": ("Arabic", "العربية"),
    "es": ("Spanish", "Español"),
    "fr": ("French", "Français"),
    "de": ("German", "Deutsch"),
    "pt": ("Portuguese", "Português"),
}
PUBLISH_THRESHOLD = 0.98


def language_coverage(pages_html):
    """Which languages are actually finished?

    A language may only be offered in the switcher (and get an /xx/ mirror)
    when ≥98% of the keys the site actually uses are translated. Anything less
    is a half-English page wearing a foreign flag, which is worse than not
    offering the language at all — so unfinished dictionaries stay in the file,
    ready to be finished, and are simply not published.
    """
    used = set()
    for html in pages_html:
        used.update(re.findall(r'data-i18n="([^"]+)"', html))
        used.update(re.findall(r'data-i18n-ph="([^"]+)"', html))
        used.update(re.findall(r'data-i18n-aria="([^"]+)"', html))
        used.update(re.findall(r'data-i18n-title="([^"]+)"', html))
        used.update(re.findall(r'data-i18n-alt="([^"]+)"', html))
        used.update(re.findall(r'data-title-key="([^"]+)"', html))
    used = {k for k in used if k and "{{" not in k}

    dicts = {}
    for fname in ("i18n.js", "i18n-pages.js"):
        path = os.path.join(ROOT, "assets", "js", fname)
        if not os.path.exists(path):
            continue
        raw = open(path, encoding="utf-8").read()
        for lang in LANG_META:
            for m in re.finditer(r'"([a-z0-9_.]+)"\s*:', raw):
                pass  # keys are counted from the parsed object below
    # parse the dictionaries with node — the JS objects are the source of truth
    import subprocess
    import sys as _sys

    script = (
        "const fs=require('fs');global.window={};global.AR=false;"
        "eval(fs.readFileSync('assets/js/i18n.js','utf8'));"
        "eval(fs.readFileSync('assets/js/i18n-pages.js','utf8'));"
        "const I=window.CHATORA_I18N||{},P=window.CHATORA_I18N_PAGES||{},o={};"
        "for(const l of new Set([...Object.keys(I),...Object.keys(P)]))"
        "{o[l]=Object.assign({},I[l]||{},P[l]||{})}"
        "const a=fs.readFileSync('assets/js/app.js','utf8'),endMarker='}[AR ? \\\"ar\\\" : \\\"en\\\"];',"
        "s=a.indexOf('  const T = '),e=a.indexOf(endMarker,s);"
        "if(s<0||e<=s)throw new Error('Cannot locate dynamic dashboard translations in app.js');"
        "eval(a.slice(s,e+endMarker.length).replace('const T =','window.__CHATORA_APP_T ='));"
        "if(!window.__CHATORA_APP_T)throw new Error('Cannot parse dashboard translation keys');"
        "o.__dynamicAppKeys=Object.keys(window.__CHATORA_APP_T).map(k=>'app.'+k);"
        "process.stdout.write(JSON.stringify(o))"
    )
    out = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError("Cannot parse translation dictionaries or app.js keys: " + out.stderr.strip())
    try:
        parsed = json.loads(out.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Translation coverage helper returned invalid JSON") from exc
    dynamic_app_keys = parsed.pop("__dynamicAppKeys", [])
    # app.js renders these strings dynamically, outside data-i18n attributes.
    # Count them so a locale cannot be published while its dashboard is English.
    used.update(dynamic_app_keys)
    dicts = parsed

    report = {}
    for code in LANG_META:
        if code == "en":
            report[code] = {"total": len(used), "done": len(used), "pct": 100.0, "publish": True}
            continue
        have = dicts.get(code, {})
        done = sum(1 for k in used if have.get(k))
        pct = (done / len(used) * 100) if used else 0.0
        report[code] = {
            "total": len(used),
            "done": done,
            "pct": round(pct, 1),
            "publish": pct >= PUBLISH_THRESHOLD * 100,
            "missing": sorted(k for k in used if not have.get(k))[:8],
        }
    return report


def write_lang_manifest(report):
    """The browser and the footer select read the same list the build produced."""
    codes = [c for c in LANG_META if report[c]["publish"]]
    js = "/* generated by _tools/build.py — languages that are fully translated */\n"
    js += "window.CHATORA_AVAILABLE_LANGS = %s;\n" % json.dumps(codes)
    open(os.path.join(ROOT, "assets", "js", "langs.js"), "w", encoding="utf-8").write(js)

    options = []
    for code in codes:
        options.append('<option value="%s">%s</option>' % (code, LANG_META[code][1]))
    return codes, "\n".join("          " + o for o in options)


def main():
    partials_dir = os.path.join(ROOT, "_partials")
    pages_dir = os.path.join(ROOT, "_pages")
    head_tpl = read(os.path.join(partials_dir, "head.html"))
    header_tpl = read(os.path.join(partials_dir, "header.html"))
    footer_tpl = read(os.path.join(partials_dir, "footer.html"))
    cta_tpl = read(os.path.join(partials_dir, "cta.html"))

    all_pages = PAGES + [
        {
            "src": a["src"],
            "out": a["out"],
            "title": a["title"],
            "desc": a["desc"],
            "title_key": "",
            "active": "BLOG",
            "jsonld_path": a["jsonld"],
        }
        for a in ARTICLES
    ]

    sources = []
    for f in sorted(os.listdir(partials_dir)):
        if f.endswith(".html"):
            sources.append(open(os.path.join(partials_dir, f), encoding="utf-8").read())
    for page in all_pages:
        src_path = os.path.join(pages_dir, page["src"])
        if os.path.exists(src_path):
            sources.append(open(src_path, encoding="utf-8").read())
    coverage = language_coverage(sources)
    codes, lang_options = write_lang_manifest(coverage)
    print("languages published:", ", ".join(codes))
    for code in LANG_META:
        c = coverage[code]
        print("  %-3s %5.1f%%%s" % (code, c["pct"], "" if c["publish"] else "  (hidden - dictionary incomplete)"))
        if c["pct"] < 100 and c.get("missing"):
            print("      missing:", ", ".join(c["missing"]))

    rendered = []
    for page in all_pages:
        src = os.path.join(pages_dir, page["src"])
        if not os.path.exists(src):
            print("skip (missing):", page["src"])
            continue
        body = read(src)
        # pages hold only the <main> body; wrap them with shared chrome
        if "{{HEAD}}" not in body:
            body = "{{HEAD}}\n{{HEADER}}\n" + body + "\n{{FOOTER}}"

        slug = "" if page["out"] == "index.html" else page["out"]
        canonical = BASE + "/" + slug

        flags = {k: "" for k in ("FEATURES", "CHANNELS", "PRICING", "COMPARE", "BLOG", "TEMPLATES", "USECASES")}
        if page.get("active"):
            flags[page["active"]] = 'class="is-active" aria-current="page"'

        header = header_tpl
        for key, val in flags.items():
            header = header.replace("{{ACTIVE_%s}}" % key, val)

        # JSON-LD
        if "jsonld_path" in page:
            jl = json.load(open(os.path.join(ROOT, page["jsonld_path"].lstrip("/")), encoding="utf-8"))
        else:
            jl = page["jsonld"]
            if page["out"] == "index.html":
                jl = list(jl) + [FAQ_INDEX]
            if page["out"] == "pricing.html":
                jl = list(jl) + [FAQ_INDEX]
        if isinstance(jl, list):
            jsonld = "\n".join(
                '<script type="application/ld+json">%s</script>' % json.dumps(item, ensure_ascii=False)
                for item in jl
            )
        else:
            jsonld = '<script type="application/ld+json">%s</script>' % json.dumps(jl, ensure_ascii=False)

        head = (
            head_tpl.replace("{{TITLE}}", page["title"])
            .replace("{{DESC}}", page["desc"])
            .replace("{{CANONICAL}}", canonical)
            .replace("{{TITLE_KEY}}", page["title_key"])
            .replace("{{HREFLANG_EN}}", BASE + "/" + ("" if page["out"] == "index.html" else page["out"]))
            .replace("{{HREFLANG_AR}}", BASE + "/ar/" + ("" if page["out"] == "index.html" else page["out"]))
            .replace("{{OGTYPE}}", "article" if "src" in page and page["src"].startswith("blog-") else "website")
            .replace("{{JSONLD}}", jsonld)
            .replace("{{BASE}}", BASE)
            .replace("{{FEEDLINK}}", "" if page.get("noindex") else FEEDLINK)
        )
        if page.get("noindex"):
            head = head.replace('<meta name="robots" content="index,follow,max-image-preview:large">',
                                '<meta name="robots" content="noindex,nofollow">')

        html = body.replace("{{HEAD}}", head)
        html = html.replace("{{HEADER}}", header)
        html = html.replace("{{FOOTER}}", footer_tpl)
        html = html.replace("{{CTA}}", cta_tpl)
        html = html.replace("{{BASE}}", BASE)
        html = html.replace("{{LANG_OPTIONS}}", lang_options)

        out_path = os.path.join(ROOT, page["out"])
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        rendered.append(html)
        print("built:", page["out"])

    # feed + sitemap
    write_rss()
    urls = []
    for page in all_pages:
        if page["out"] == "404.html" or page.get("noindex"):
            continue
        loc = BASE + "/" + ("" if page["out"] == "index.html" else page["out"])
        prio = "1.0" if page["out"] == "index.html" else ("0.9" if page["out"] in ("pricing.html", "compare.html", "features.html") else "0.7")
        urls.append(
            "  <url><loc>%s</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>%s</priority></url>"
            % (loc, BUILD_DATE, prio)
        )
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(sitemap)
    print("built: sitemap.xml")

    # Build the Arabic mirror first; the remaining complete locale mirrors then
    # add reciprocal hreflang across all available static language paths.
    ar_builder = os.path.join(ROOT, "_tools", "build_ar.py")
    ar_ok = False
    if os.path.exists(ar_builder):
        try:
            import subprocess
            import sys

            subprocess.run([sys.executable, ar_builder], check=True)
            ar_ok = True
        except Exception as exc:  # keep the English build diagnosable if Arabic fails
            print("warn: Arabic mirror skipped —", exc)

    locale_builder = os.path.join(ROOT, "_tools", "build_locales.py")
    if ar_ok and os.path.exists(locale_builder):
        try:
            import subprocess
            import sys

            subprocess.run([sys.executable, locale_builder], check=True)
        except Exception as exc:
            print("warn: additional locale mirrors skipped —", exc)
            raise


if __name__ == "__main__":
    main()

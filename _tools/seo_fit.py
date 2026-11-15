#!/usr/bin/env python3
"""Keep <title> and meta descriptions inside what search results display.

Titles are shortened by dropping parts in a fixed order, never by cutting a
word in half: the brand suffix first, then a "(2026 …)" style parenthesis,
then the subtitle after a colon or dash, and only then whole trailing words.
Descriptions are cut at a word boundary and end with an ellipsis.
"""
import re

TITLE_LIMIT = 65
DESC_LIMIT = 160
_BRAND = re.compile(r"\s*(?:\||·)\s*(?:Chatora|شاتورا)\s*$")
_PAREN = re.compile(r"\s*\([^()]*\)")
_SPLIT = re.compile(r"\s*(?:\s[:：]|[:：]|\s[—–|])\s+")
_TRAIL = " ,;:—–-·|"
_CLAUSE = re.compile(r",\s|\s(?:and|y|e|et|und|و)\s|\s&\s|\s[—–]\s")


_DANGLING = {
    "a", "an", "and", "the", "of", "for", "to", "in", "on", "with", "or", "&", "vs", "vs.",
    "y", "e", "o", "u", "de", "del", "la", "el", "los", "las", "en", "con", "para", "por", "que", "un", "una",
    "et", "ou", "le", "les", "des", "du", "au", "aux", "à", "pour", "avec", "sur", "une",
    "und", "oder", "der", "die", "das", "den", "dem", "für", "mit", "zu", "im", "bei", "von", "ein", "eine", "was", "wann",
    "do", "da", "dos", "das", "em", "no", "na", "com", "ao", "os", "as", "um", "uma", "quando",
    "و", "في", "من", "على", "إلى", "أو", "مع", "عن",
}


def _trim_words(text, limit):
    if len(text) <= limit:
        return text
    words = text[: limit + 1].rsplit(" ", 1)[0].split(" ")
    while len(words) > 1 and (words[-1].lower().strip(_TRAIL + "(") in _DANGLING or not words[-1].strip(_TRAIL + "(")):
        words.pop()
    return " ".join(words).rstrip(_TRAIL + "(")


def fit_title(value, limit=TITLE_LIMIT):
    title = re.sub(r"\s+", " ", value or "").strip()
    if len(title) <= limit:
        return title
    brand = _BRAND.search(title)
    short = _BRAND.sub("", title).strip()
    if len(short) > limit:
        short = _PAREN.sub("", short).strip()
    if len(short) > limit:
        # Keep as much of the subtitle as fits; fall back to the part before
        # the colon/dash only when almost nothing of the subtitle survives.
        head = _SPLIT.split(short, 1)[0].strip()
        trimmed = _trim_words(short, limit)
        if len(head) >= 20 and len(head) <= limit:
            # The subtitle was cut mid-clause: step back to the last complete
            # clause (comma or conjunction), or drop the subtitle altogether.
            cuts = [m.start() for m in _CLAUSE.finditer(trimmed) if m.start() >= len(head) + 8]
            trimmed = trimmed[: cuts[-1]].rstrip(_TRAIL) if cuts else head
        short = trimmed
    if brand and len(short) + len(brand.group(0).rstrip()) <= limit:
        short += brand.group(0).rstrip()
    return short or title[:limit]


def fit_description(value, limit=DESC_LIMIT):
    text = re.sub(r"\s+", " ", value or "").strip()
    if len(text) <= limit:
        return text
    chunk = text[: limit - 1].rsplit(" ", 1)[0].rstrip(_TRAIL + ".")
    return (chunk or text[: limit - 1].rstrip()) + "…"

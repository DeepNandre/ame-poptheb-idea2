"""Map a free-text address to a canonical building slug.

The building store is slug-named (tower-42, 22-bishopsgate, ...). A user adds a building
by address, so we fuzzy-match the address against existing slugs (de-slugified back to
words) and reuse the slug on a strong hit; otherwise we mint a new slug from the address.
rapidfuzz token_set_ratio handles the extra tokens a real address carries (postcode,
"London") that the slug omits.
"""

import re

from rapidfuzz import fuzz

import store

MATCH_THRESHOLD = 80  # token_set_ratio ≥ this → treat as the same building


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return re.sub(r"-{2,}", "-", text).strip("-") or "building"


def _deslug(slug: str) -> str:
    return slug.replace("-", " ")


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _coverage(address: str, slug: str) -> float:
    """How much of the building name (slug) appears in the address, 0..100.

    The address carries extra tokens (street, postcode, "London") that the slug omits,
    which deflates token_set_ratio. Coverage instead asks the directional question that
    matters — "are the building-name tokens present in this address?" — so
    'Tower 42, 25 Old Broad Street, London EC2N 1HQ' still resolves to tower-42.
    """
    at = set(_tokens(address))
    st = _tokens(_deslug(slug))
    if not st:
        return 0.0
    hits = 0
    for t in st:
        if t in at:
            hits += 1
        elif len(t) >= 4 and any(
            len(a) >= 4 and (a.startswith(t) or t.startswith(a)) for a in at
        ):
            hits += 1
    return 100.0 * hits / len(st)


def match_or_create(address: str) -> dict:
    """Return {slug, created, score, matched_existing}.

    created=True means a brand-new slug was minted (no existing building matched).
    """
    address = (address or "").strip()
    if not address:
        raise ValueError("empty address")

    best_slug, best_score = None, 0.0
    for slug in store.list_slugs():
        score = max(
            fuzz.token_set_ratio(address.lower(), _deslug(slug)),
            _coverage(address, slug),
        )
        if score > best_score:
            best_slug, best_score = slug, score

    if best_slug and best_score >= MATCH_THRESHOLD:
        return {
            "slug": best_slug,
            "created": False,
            "score": round(best_score, 1),
            "matched_existing": True,
        }

    return {
        "slug": slugify(address),
        "created": True,
        "score": round(best_score, 1),
        "matched_existing": False,
    }

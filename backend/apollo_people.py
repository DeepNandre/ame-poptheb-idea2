"""Apollo-native company roster — server-side, no browser.

Apollo's People Search API (`mixed_people/api_search`) is FREE on the Professional
plan and returns a company's full roster, but names/emails are masked there (you get
id + first name + obfuscated last + title). The People Enrichment API
(`people/bulk_match`) unmasks a person by their Apollo id — full name, work email,
LinkedIn URL, phone — at 1 credit each.

So this module: search (free) → rank by title → reveal the top `max_reveal` by id
(budgeted, high-value first) → emit live. Unrevealed people stay a count only.

NOTE the endpoint: it's `mixed_people/api_search`, NOT `mixed_people/search` — the
latter is the gated internal/UI endpoint and 403s even on paid API keys.
"""

from __future__ import annotations

import os

import httpx

API = "https://api.apollo.io/v1"
SEARCH_PEOPLE = f"{API}/mixed_people/api_search"
SEARCH_COMPANIES = f"{API}/mixed_companies/search"
BULK_MATCH = f"{API}/people/bulk_match"

PER_PAGE = 100  # api_search max page size
BATCH = 10  # bulk_match max ids per call


def _headers() -> dict:
    return {
        "x-api-key": os.environ.get("APOLLO_API_KEY", ""),
        "Content-Type": "application/json",
    }


def _is_high_value(title: str | None, hv: list[str]) -> bool:
    if not title:
        return False
    t = title.lower()
    return any(h.lower() in t for h in hv)


async def _resolve_org(client, domain: str) -> str | None:
    r = await client.post(
        SEARCH_COMPANIES,
        json={"q_organization_domains": domain, "per_page": 1},
        headers=_headers(),
    )
    r.raise_for_status()
    orgs = r.json().get("organizations") or r.json().get("accounts") or []
    if not orgs:
        return None
    return orgs[0].get("id") or orgs[0].get("organization_id")


async def _search_roster(
    client, org_id: str, locations: list[str] | None, max_people: int
) -> list[dict]:
    """Paginate api_search. Pagination metadata is empty on this plan, so we loop
    until a short/empty page or max_people. Returns masked candidates with ids."""
    out: list[dict] = []
    page = 1
    while len(out) < max_people:
        payload: dict = {
            "organization_ids": [org_id],
            "page": page,
            "per_page": PER_PAGE,
        }
        if locations:
            payload["person_locations"] = locations
        r = await client.post(SEARCH_PEOPLE, json=payload, headers=_headers())
        r.raise_for_status()
        batch = r.json().get("people") or []
        if not batch:
            break
        for p in batch:
            out.append(
                {
                    "id": p.get("id"),
                    "first_name": p.get("first_name") or "",
                    "title": p.get("title"),
                    "has_email": bool(p.get("has_email")),
                    "has_phone": p.get("has_direct_phone") == "Yes",
                }
            )
        if len(batch) < PER_PAGE:
            break
        page += 1
    return out[:max_people]


def _full_name(m: dict) -> str | None:
    """bulk_match returns `name`, but fall back to first+last so a revealed
    (paid-for) person always carries a name."""
    name = (m.get("name") or "").strip()
    if name:
        return name
    parts = [m.get("first_name"), m.get("last_name")]
    composed = " ".join(p for p in parts if p).strip()
    return composed or None


async def _reveal(client, ids: list[str]) -> tuple[list[dict], int]:
    """bulk_match by id → full records. Returns (records, credits_consumed).

    Credits are spent here, so we keep only matches that actually carry a name,
    and we always surface the LinkedIn URL. Phone reveal is intentionally NOT
    requested — it's deferred to an in-app feature (would cost extra credits)."""
    revealed: list[dict] = []
    credits = 0
    for start in range(0, len(ids), BATCH):
        chunk = ids[start : start + BATCH]
        r = await client.post(
            BULK_MATCH,
            json={
                "details": [{"id": i} for i in chunk],
                "reveal_personal_emails": False,
                # reveal_phone_number deferred — phone is a future in-app feature.
            },
            headers=_headers(),
        )
        r.raise_for_status()
        j = r.json()
        credits += j.get("credits_consumed", 0) or 0
        for m in j.get("matches") or []:
            if not m:
                continue
            name = _full_name(m)
            if not name:
                continue  # paid reveal returned nothing usable; skip
            revealed.append(
                {
                    "name": name,
                    "role": m.get("title"),
                    "email": m.get("email"),
                    "email_verified": m.get("email_status") == "verified",
                    "linkedin_url": m.get("linkedin_url"),
                    "phone": None,  # deferred in-app feature
                    "sources": ["apollo"],
                }
            )
    return revealed, credits


def _emitter(on_update):
    def emit(rec, enriched):
        if not on_update:
            return
        try:
            on_update(rec, enriched)
        except Exception:
            pass

    return emit


async def _roster_for_org(
    client,
    org_id: str,
    locations: list[str] | None,
    max_people: int,
    max_reveal: int,
    high_value_titles: list[str],
    emit,
) -> tuple[list[dict], int, int]:
    """Search (free) → rank → reveal the top max_reveal (1 credit each). Returns
    (people, total_discovered, credits)."""
    candidates = await _search_roster(client, org_id, locations, max_people)
    total = len(candidates)

    # Rank: high-value titles first, then people who have an email on file.
    candidates.sort(
        key=lambda c: (
            not _is_high_value(c["title"], high_value_titles),
            not c["has_email"],
        )
    )
    to_reveal = [c["id"] for c in candidates[:max_reveal] if c.get("id")]
    revealed, credits = await _reveal(client, to_reveal)

    people = []
    for rec in revealed:
        rec["high_value"] = _is_high_value(rec.get("role"), high_value_titles)
        people.append(rec)
        emit(rec, True)
    return people, total, credits


async def company_roster(
    domain: str,
    location: str = "",
    max_people: int = 500,
    max_reveal: int = 60,
    high_value_titles: list[str] | None = None,
    on_update=None,
) -> dict:
    """Full Apollo roster pull, keyed on a DOMAIN. Returns {people, total_discovered,
    revealed, credits, coverage_note}. people are revealed (named) records; high-value
    titles are revealed first within the max_reveal credit budget."""
    high_value_titles = high_value_titles or []
    locations = [location] if location else None
    emit = _emitter(on_update)

    async with httpx.AsyncClient(timeout=30.0) as client:
        org_id = await _resolve_org(client, domain)
        if not org_id:
            return {
                "people": [],
                "total_discovered": 0,
                "revealed": 0,
                "credits": 0,
                "coverage_note": f"No Apollo org found for {domain}",
            }
        people, total, credits = await _roster_for_org(
            client, org_id, locations, max_people, max_reveal, high_value_titles, emit
        )

    with_li = sum(1 for p in people if p.get("linkedin_url"))
    scope = f" @ {location}" if location else ""
    note = (
        f"Apollo roster{scope}: discovered {total}, revealed {len(people)} "
        f"({credits} credits, {with_li}/{len(people)} with LinkedIn)"
    )
    if len(people) < total:
        note += f" — {total - len(people)} more available, raise --reveal"
    return {
        "people": people,
        "total_discovered": total,
        "revealed": len(people),
        "credits": credits,
        "coverage_note": note,
    }


async def match_person(
    name: str,
    organization_name: str = "",
    domain: str = "",
    reveal_email: bool = True,
) -> dict | None:
    """Single-person enrichment via Apollo's people/match — name (+ where they work) in,
    LinkedIn URL + work email out. Spends 1 credit when it reveals an email. Returns None
    if Apollo can't match the person. Phone is intentionally not requested (deferred to a
    future in-app feature, would cost extra credits)."""
    payload: dict = {"name": name.strip(), "reveal_personal_emails": reveal_email}
    if organization_name:
        payload["organization_name"] = organization_name
    if domain:
        payload["domain"] = domain

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{API}/people/match", json=payload, headers=_headers())
        r.raise_for_status()
        p = r.json().get("person") or {}

    # Apollo's people/match is inconsistent for non-matches: sometimes null, sometimes a
    # hollow stub that echoes the queried name with an id but no contactable data. This
    # endpoint exists to surface a LinkedIn profile + email, so a match carrying neither is
    # not a useful hit — report it as no match.
    if not p or not (p.get("linkedin_url") or p.get("email")):
        return None
    org = p.get("organization") or {}
    return {
        "name": p.get("name") or _full_name(p) or name,
        "title": p.get("title"),
        "email": p.get("email"),
        "email_verified": p.get("email_status") == "verified",
        "linkedin_url": p.get("linkedin_url"),
        "organization": org.get("name") or organization_name or None,
        "organization_domain": org.get("primary_domain") or domain or None,
        "phone": None,  # deferred in-app feature
        "sources": ["apollo"],
    }

#!/usr/bin/env python3
"""Building finder — an address or postcode in, the companies in that building out.

Reverse-address occupancy, free/low-cost, UK-first. Three data sources, joined on the
building's postcode:

  postcodes.io  (free, no key) — validates the postcode and geocodes it to lat/lon +
                admin geography. Used to confirm the postcode and anchor the search.

  Companies House advanced-search  (free dev key) — the workhorse. Lists every company
                whose REGISTERED OFFICE sits at the postcode. Note: registered office is
                a legal address, not always the trading desk — a spinout can register
                at the landlord's address while sitting elsewhere, and a firm can trade
                in the building while registered at its accountant's. Treat as a strong
                lead, not proof of physical presence.

  FHRS  (Food Standards Agency, free, no key) — physically-present food businesses
                (cafes, canteens, restaurants) at the postcode. These ARE trading at the
                address, so they cross-check the Companies House registered-office list.

On top of the raw occupant list this also infers the PRIME TARGET — the entity that
owns/manages the building. Spinout incubators and managed offices leave a fingerprint:
dozens of tenants registered "C/O <agent>" at the same address. The dominant C/O entity,
plus any active on-site company whose name carries a management/estates/ventures token,
is surfaced as the likely building manager. Ownership (freeholder) needs HM Land Registry
CCOD/OCOD, which has no keyless API — flagged as a follow-up, not resolved here.

Companies print live as they resolve; the result is cached to building_index.json.

    python building.py search "M13 9NT"
    python building.py search "46 Grafton Street, Manchester M13 9NT"
    python building.py search "M13 9NT" --active-only --no-fhrs
    python building.py search "M13 9NT" --find arcube        # does a named co. appear?
    python building.py list                                  # all cached searches
    python building.py show m13-9nt                           # reprint cached result

Needs COMPANIES_HOUSE_API_KEY in backend/.env (or the project-root .env). Get a free key at
developer.company-information.service.gov.uk — no company incorporation required.
Authorised security testing only.
"""

import argparse
import json
import os
import pathlib
import re
import sys

import httpx

# enricher_bridge loads the project envs (and the tool .env) as a side effect of
# import, so COMPANIES_HOUSE_API_KEY lands in os.environ. Fall back to a direct dotenv
# load if the bridge (which pulls in the organizer-enricher tool) isn't importable.
try:
    import enricher_bridge  # noqa: F401  (imported for its .env side effect)
except Exception:
    try:
        from dotenv import load_dotenv

        _here = pathlib.Path(__file__).resolve().parent
        load_dotenv(_here / ".env")  # backend/.env
        load_dotenv(_here.parent / ".env")  # project-root .env (cwd)
    except ImportError:
        pass

INDEX_FILE = pathlib.Path(__file__).parent / "building_index.json"

POSTCODES_IO = "https://api.postcodes.io/postcodes"
CH_ADVANCED = "https://api.company-information.service.gov.uk/advanced-search/companies"
CH_SEARCH = "https://api.company-information.service.gov.uk/search/companies"
CH_OFFICERS = "https://api.company-information.service.gov.uk/company/{number}/officers"
FHRS_API = "https://api.ratings.food.gov.uk/Establishments"

CH_PAGE = 100  # advanced-search max page size
CH_MAX = 500  # safety cap on total companies pulled per search

# A UK postcode embedded anywhere in a free-text address.
POSTCODE_RE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", re.I)

# Tokens that mark a company as a likely landlord/manager/holding vehicle rather than a
# tenant. Matched as case-insensitive substrings against the company name.
MANAGER_TOKENS = [
    "management",
    "estates",
    "estate",
    "properties",
    "property",
    "innovation",
    "ventures",
    "holdings",
    "developments",
    "regeneration",
    "facilit",  # facility / facilities
    "incubat",  # incubator
    "science park",
    "real estate",
    "asset",
    "investments",
]


# ── helpers ───────────────────────────────────────────────────────────────────────
def _ch_key() -> str:
    key = (os.environ.get("COMPANIES_HOUSE_API_KEY") or "").strip().strip("\"'")
    if not key or key.upper().startswith("YOUR"):
        print(
            "[!] COMPANIES_HOUSE_API_KEY missing or placeholder. Get a free key at "
            "developer.company-information.service.gov.uk and put it in "
            "backend/.env (or the project-root .env)",
            file=sys.stderr,
        )
        sys.exit(2)
    return key


def extract_postcode(text: str) -> str | None:
    m = POSTCODE_RE.search(text or "")
    if not m:
        return None
    pc = re.sub(r"\s+", "", m.group(1)).upper()
    return f"{pc[:-3]} {pc[-3:]}"  # normalise to "OUTCODE INCODE"


def slug_for(postcode: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", postcode.lower()).strip("-")


def _addr_line(c: dict) -> str:
    a = c.get("registered_office_address") or {}
    parts = [a.get("address_line_1"), a.get("locality"), a.get("postal_code")]
    return ", ".join(p for p in parts if p)


def _care_of(c: dict) -> str | None:
    """Pull the entity a company is registered care-of, e.g. 'C/O UMIF Core Tech…' →
    'UMIF'. This is the fingerprint of a managed/incubator address."""
    line = (c.get("registered_office_address") or {}).get("address_line_1") or ""
    m = re.match(r"\s*c[/\\. ]*o[/\\. ]+\s*([A-Za-z0-9&'. -]+)", line, re.I)
    if not m:
        return None
    # First few tokens after C/O are the agent name; drop trailing address words.
    tok = m.group(1).strip()
    tok = re.split(
        r"\b(\d|ltd|limited|core|technology|facility|house|street|road)\b", tok, 1, re.I
    )[0]
    tok = tok.strip(" ,.-")
    return tok or None


def _is_manager_name(name: str) -> bool:
    n = (name or "").lower()
    return any(tok in n for tok in MANAGER_TOKENS)


# ── data sources ────────────────────────────────────────────────────────────────
def geocode_postcode(client: httpx.Client, postcode: str) -> dict | None:
    try:
        r = client.get(f"{POSTCODES_IO}/{postcode.replace(' ', '')}", timeout=15)
        if r.status_code != 200:
            return None
        res = r.json().get("result") or {}
        return {
            "postcode": res.get("postcode"),
            "lat": res.get("latitude"),
            "lon": res.get("longitude"),
            "admin_district": res.get("admin_district"),
            "ward": res.get("admin_ward"),
        }
    except Exception:
        return None


def companies_at(client: httpx.Client, key: str, postcode: str) -> list[dict]:
    """Every company whose registered office is at the postcode, via advanced-search.
    Paginates on start_index until the hit count is exhausted or CH_MAX is reached."""
    out: list[dict] = []
    start = 0
    while len(out) < CH_MAX:
        r = client.get(
            CH_ADVANCED,
            params={"location": postcode, "size": CH_PAGE, "start_index": start},
            auth=(key, ""),
            timeout=30,
        )
        r.raise_for_status()
        body = r.json()
        items = body.get("items") or []
        if not items:
            break
        for c in items:
            out.append(
                {
                    "number": c.get("company_number"),
                    "name": c.get("company_name"),
                    "status": c.get("company_status"),
                    "type": c.get("company_type"),
                    "incorporated": c.get("date_of_creation"),
                    "sic": c.get("sic_codes") or [],
                    "address": _addr_line(c),
                    "care_of": _care_of(c),
                }
            )
        start += CH_PAGE
        if start >= (body.get("hits") or 0):
            break
    return out[:CH_MAX]


def _officer_name(raw: str) -> str:
    """Companies House gives officer names as 'SURNAME, Forenames[, Title]'. Normalise to
    a natural 'Forenames Surname', dropping any trailing honorific so it's enrichable."""
    parts = [p.strip() for p in (raw or "").split(",") if p.strip()]
    if not parts:
        return raw or ""
    surname = parts[0].title()
    forenames = parts[1] if len(parts) > 1 else ""
    name = f"{forenames} {surname}".strip()
    return re.sub(r"\s+", " ", name)


def officers_at(
    client: httpx.Client, key: str, number: str, current_only: bool = True
) -> list[dict]:
    """Current directors/officers of a company, by company number. These are real named
    humans legally tied to the company — the roster for a building's micro-tenants, which
    Apollo doesn't index but Companies House does."""
    try:
        r = client.get(
            CH_OFFICERS.format(number=number),
            params={"items_per_page": 35},
            auth=(key, ""),
            timeout=20,
        )
        if r.status_code != 200:
            return []
        out = []
        for o in r.json().get("items") or []:
            if current_only and o.get("resigned_on"):
                continue
            raw = o.get("name") or ""
            out.append(
                {
                    "name": _officer_name(raw),
                    "raw_name": raw,
                    "role": o.get("officer_role"),
                    "appointed": o.get("appointed_on"),
                    "occupation": o.get("occupation"),
                    "nationality": o.get("nationality"),
                }
            )
        return out
    except Exception:
        return []


def fhrs_at(client: httpx.Client, postcode: str) -> list[dict]:
    """Physically-present food businesses at the postcode (trading-name truth)."""
    try:
        r = client.get(
            FHRS_API,
            params={"address": postcode, "pageSize": 50},
            headers={"x-api-version": "2", "accept": "application/json"},
            timeout=20,
        )
        if r.status_code != 200:
            return []
        ests = r.json().get("establishments") or []
        return [
            {
                "name": e.get("BusinessName"),
                "type": e.get("BusinessType"),
                "address": ", ".join(
                    p
                    for p in [
                        e.get("AddressLine1"),
                        e.get("AddressLine2"),
                        e.get("PostCode"),
                    ]
                    if p
                ),
            }
            for e in ests
        ]
    except Exception:
        return []


# ── prime-target inference ─────────────────────────────────────────────────────
def infer_manager(companies: list[dict]) -> dict:
    """Surface the likely building manager/owner from occupancy patterns."""
    # 1. Dominant care-of agent (managed/incubator fingerprint).
    co_counts: dict[str, int] = {}
    for c in companies:
        if c.get("care_of"):
            co_counts[c["care_of"]] = co_counts.get(c["care_of"], 0) + 1
    dominant_care_of = sorted(co_counts.items(), key=lambda kv: -kv[1])

    # 2. Active on-site companies whose name reads like a landlord/manager.
    manager_named = [
        c
        for c in companies
        if c.get("status") == "active" and _is_manager_name(c.get("name", ""))
    ]

    return {
        "care_of_agents": [{"agent": a, "tenants": n} for a, n in dominant_care_of[:5]],
        "manager_named_companies": [
            {"name": c["name"], "number": c["number"]} for c in manager_named[:10]
        ],
    }


# ── orchestration ───────────────────────────────────────────────────────────────
def search_building(
    query: str,
    active_only: bool = False,
    use_fhrs: bool = True,
    find: str = "",
) -> dict:
    postcode = extract_postcode(query)
    if not postcode:
        print(
            f"[!] No UK postcode found in {query!r}. Pass a postcode (e.g. 'M13 9NT') "
            "or an address that contains one — Companies House reverse-lookup is keyed "
            "on postcode.",
            file=sys.stderr,
        )
        sys.exit(1)

    key = _ch_key()
    with httpx.Client() as client:
        geo = geocode_postcode(client, postcode)
        if geo and geo.get("postcode"):
            postcode = geo["postcode"]  # use the canonical form
            print(
                f"[geo] {postcode} → {geo.get('admin_district')}, "
                f"{geo.get('ward')} ({geo.get('lat')}, {geo.get('lon')})"
            )
        else:
            print(
                f"[geo] postcodes.io could not validate {postcode!r} — searching anyway"
            )

        companies = companies_at(client, key, postcode)
        if active_only:
            companies = [c for c in companies if c.get("status") == "active"]

        print(f"[ch] {len(companies)} companies registered at {postcode}")
        for c in companies:
            flag = " ★" if _is_manager_name(c.get("name", "")) else ""
            print(
                f"    {c['number']} | {c['name']} | {c['status']}"
                f" | {c['address']}{flag}"
            )

        fhrs = fhrs_at(client, postcode) if use_fhrs else []
        if fhrs:
            print(f"[fhrs] {len(fhrs)} food businesses physically at {postcode}")
            for e in fhrs:
                print(f"    {e['name']} ({e['type']}) | {e['address']}")

    manager = infer_manager(companies)

    result = {
        "query": query,
        "postcode": postcode,
        "geo": geo,
        "companies": companies,
        "fhrs": fhrs,
        "prime_target": manager,
        "owner_note": (
            "Freeholder/owner not resolved — HM Land Registry CCOD/OCOD has no keyless "
            "API. Pivot any manager_named_company's registration number through "
            "Companies House PSCs/officers to reach named humans, or buy the title "
            "register (£3, pay-as-you-go) for the registered proprietor."
        ),
    }

    if find:
        result["find"] = find_company(find, companies)
    return result


def find_company(needle: str, companies: list[dict]) -> dict:
    """Does a named company appear in this building's registered occupants?"""
    n = needle.lower()
    hits = [c for c in companies if n in (c.get("name") or "").lower()]
    return {"needle": needle, "found": bool(hits), "matches": hits}


def find_company_anywhere(name: str) -> list[dict]:
    """CH name search (not address-bound) — where IS this company registered? Useful
    when --find returns nothing in-building and you want its real address."""
    key = _ch_key()
    with httpx.Client() as client:
        r = client.get(
            CH_SEARCH,
            params={"q": name, "items_per_page": 10},
            auth=(key, ""),
            timeout=20,
        )
        r.raise_for_status()
        return [
            {
                "number": i.get("company_number"),
                "name": i.get("title"),
                "status": i.get("company_status"),
                "address": i.get("address_snippet"),
            }
            for i in (r.json().get("items") or [])
        ]


# ── cache + display ──────────────────────────────────────────────────────────────
def load_index() -> dict:
    if INDEX_FILE.exists():
        try:
            return json.loads(INDEX_FILE.read_text())
        except Exception:
            return {}
    return {}


def save_to_index(slug: str, result: dict) -> None:
    idx = load_index()
    idx[slug] = result
    INDEX_FILE.write_text(json.dumps(idx, indent=2))


def print_summary(result: dict) -> None:
    pt = result.get("prime_target", {})
    print("\n── PRIME TARGET (building manager/owner candidates) ──")
    if pt.get("care_of_agents"):
        print("  Dominant care-of agents (managed-address fingerprint):")
        for a in pt["care_of_agents"]:
            print(f"    {a['agent']}  ({a['tenants']} tenants registered C/O it)")
    if pt.get("manager_named_companies"):
        print("  Active on-site companies named like a landlord/manager (★):")
        for c in pt["manager_named_companies"]:
            print(f"    {c['number']} | {c['name']}")
    if not pt.get("care_of_agents") and not pt.get("manager_named_companies"):
        print("  No clear manager fingerprint — likely single-occupier or direct lets.")
    print(f"\n  Owner: {result['owner_note']}")
    if "find" in result:
        f = result["find"]
        if f["found"]:
            print(f"\n[✓] '{f['needle']}' IS registered here:")
            for c in f["matches"]:
                print(f"    {c['number']} | {c['name']} | {c['address']}")
        else:
            print(f"\n[✗] '{f['needle']}' NOT among registered occupants here.")


# ── CLI ───────────────────────────────────────────────────────────────────────────
def main() -> None:
    p = argparse.ArgumentParser(description="Find the companies in a UK building.")
    sub = p.add_subparsers(dest="cmd")

    s = sub.add_parser("search", help="search a building by address/postcode")
    s.add_argument("query", help="postcode or address containing one")
    s.add_argument(
        "--active-only", action="store_true", help="drop dissolved companies"
    )
    s.add_argument(
        "--no-fhrs", action="store_true", help="skip the FHRS food-business pass"
    )
    s.add_argument(
        "--find", default="", help="check if a named company is registered here"
    )
    s.add_argument("--slug", help="cache key (defaults to the postcode)")

    w = sub.add_parser(
        "whereis", help="CH name search — where is a company registered?"
    )
    w.add_argument("name", help="company name to locate")

    sub.add_parser("list", help="list cached searches")

    sh = sub.add_parser("show", help="reprint a cached search")
    sh.add_argument("slug", help="cache key (e.g. m13-9nt)")

    args = p.parse_args()

    if args.cmd == "search":
        result = search_building(
            args.query,
            active_only=args.active_only,
            use_fhrs=not args.no_fhrs,
            find=args.find,
        )
        slug = args.slug or slug_for(result["postcode"])
        save_to_index(slug, result)
        print_summary(result)
        print(f"\n[+] Cached as '{slug}'. Reprint with: python building.py show {slug}")

    elif args.cmd == "whereis":
        for c in find_company_anywhere(args.name):
            print(f"{c['number']} | {c['name']} | {c['status']} | {c['address']}")

    elif args.cmd == "list":
        for slug, r in load_index().items():
            n = len(r.get("companies", []))
            print(
                f"{slug:20} {r.get('postcode', '?'):10} {n} companies | {r.get('query', '')}"
            )

    elif args.cmd == "show":
        r = load_index().get(args.slug)
        if not r:
            print(f"No cached search '{args.slug}'", file=sys.stderr)
            sys.exit(1)
        print(f"{r['postcode']} — {len(r.get('companies', []))} companies")
        for c in r.get("companies", []):
            print(f"    {c['number']} | {c['name']} | {c['status']} | {c['address']}")
        print_summary(r)

    else:
        p.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

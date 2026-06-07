#!/usr/bin/env python3
"""People finder — company URL in, the office roster out.

Two discovery sources, selected with --source (default: apollo):

  apollo   (default) — server-side, no browser. Apollo's People SEARCH API
            (mixed_people/api_search, FREE on the Professional plan) pulls the full
            roster scoped to an office via --location; People ENRICHMENT then unmasks
            the top --reveal people by id (1 credit each, high-value titles first)
            into full name + work email + LinkedIn + phone.

  linkedin  — scrapes the company's LinkedIn People tab via your own already-logged-in
            Chrome over CDP (no fake account, no stored creds), then enriches via
            Apollo bulk_match + Hunter pattern + Companies House. Use when Apollo
            coverage is thin. Crosses LinkedIn's ToS — use your own/throwaway session.

People print live as they resolve; the roster is cached to people_index.json.

    python people.py monzo.com --location "London, United Kingdom" --reveal 60
    python people.py monzo.com --reveal 0          # discover roster size only, 0 credits
    python people.py monzo.com --source linkedin --slug monzo-bank
    python people.py list                          # all cached rosters
    python people.py show monzo.com                # reprint cached roster

linkedin SETUP — start your real Chrome with a debug port first (quit Chrome first):
    google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/google-chrome"
and be logged into LinkedIn in that window. (chromium / chromium-browser on Debian.)

Apollo's discovery endpoint is mixed_people/api_search — NOT mixed_people/search,
which 403s even on paid keys. Authorised security testing only.
"""

import argparse
import asyncio
import json
import pathlib
import sys
import urllib.parse

import apollo_people
from enricher_bridge import filter_current_staff, find_employees, scrape_people

INDEX_FILE = pathlib.Path(__file__).parent / "people_index.json"
CDP_DEFAULT = "http://localhost:9222"
MAX_EXPANDS = 12  # "Show more results" clicks on the People tab

# Titles worth flagging (and worth spending the limited Apollo reveal budget on
# first). Matched as case-insensitive substrings, so keep tokens long enough not to
# false-positive (e.g. "IT" would match "recruITing"; "Head of"/"Office Manager"
# are spelled out instead of bare "Head"/"Office").
HIGH_VALUE_TITLES = [
    "CEO",
    "CTO",
    "COO",
    "CFO",
    "Founder",
    "President",
    "VP ",
    "Chief",
    "Director",
    "Head of",
    "Manager",
    "Facilities",
    "Security",
    "Office Manager",
    "Receptionist",
]


def normalise_domain(raw: str) -> str:
    """Accept a full URL or a bare domain; return the registrable host."""
    raw = raw.strip()
    if "://" not in raw:
        raw = "//" + raw
    host = urllib.parse.urlparse(raw).hostname or ""
    return host.lower().removeprefix("www.")


def slug_from(domain: str) -> str:
    """Best-effort LinkedIn company slug guess from a domain label. Often wrong —
    pass --slug explicitly (the bit in linkedin.com/company/<slug>/)."""
    return domain.split(".")[0]


# --- Apollo-native discovery (server-side, no browser) -----------------------
async def discover_apollo(
    domain: str,
    company: str,
    location: str,
    max_people: int,
    max_reveal: int,
) -> dict:
    print(
        f"[*] Apollo: searching the roster for {domain}"
        f"{(' @ ' + location) if location else ''} (free) …",
        flush=True,
    )

    def on_update(rec, enriched):
        bits = " — ".join(b for b in [rec.get("role"), rec.get("email")] if b)
        mark = "★" if rec.get("high_value") else "✓"
        print(f"  {mark} {rec.get('name', ''):24}  {bits}", flush=True)

    res = await apollo_people.company_roster(
        domain,
        location=location,
        max_people=max_people,
        max_reveal=max_reveal,
        high_value_titles=HIGH_VALUE_TITLES,
        on_update=on_update,
    )
    print(
        f"[+] Discovered {res['total_discovered']}, revealed {res['revealed']} "
        f"({res['credits']} credits)",
        flush=True,
    )
    return {
        "domain": domain,
        "company": company,
        "slug": "",
        "location": location,
        "people": res["people"],
        "coverage_note": res["coverage_note"],
    }


# --- LinkedIn-scrape discovery + enrichment ----------------------------------
async def discover(
    domain: str,
    slug: str,
    company: str,
    location: str,
    cdp: str,
    expands: int,
    enrich: bool,
) -> dict:
    print(
        f"[*] Connecting to Chrome ({cdp}) and scraping "
        f"linkedin.com/company/{slug}/people/ …",
        flush=True,
    )
    scraped = await scrape_people(slug, cdp, expands)
    if company:
        scraped = filter_current_staff(scraped, company)
    print(f"[+] Scraped {len(scraped)} people from the People tab", flush=True)
    if not scraped:
        return {
            "domain": domain,
            "company": company,
            "slug": slug,
            "location": location,
            "people": [],
            "coverage_note": "LinkedIn scrape returned 0 (check Chrome/login/slug)",
        }

    seed = [
        {
            "full_name": p.get("name", ""),
            "job_title": p.get("headline"),
            "linkedin_url": p.get("profile"),
        }
        for p in scraped
    ]

    if not enrich:
        people = [
            {
                "name": p["full_name"],
                "role": p["job_title"],
                "email": None,
                "email_verified": False,
                "linkedin_url": p["linkedin_url"],
                "sources": ["linkedin"],
                "high_value": False,
            }
            for p in seed
            if p["full_name"]
        ]
        for p in people:
            print(f"  · {p['name']:24}  {p['role'] or ''}", flush=True)
        return {
            "domain": domain,
            "company": company,
            "slug": slug,
            "location": location,
            "people": people,
            "coverage_note": f"LinkedIn scrape: {len(people)} (enrichment skipped)",
        }

    print(
        "[*] Enriching via Apollo bulk_match + Hunter pattern + Companies House …",
        flush=True,
    )

    printed: set[str] = set()

    def on_update(rec, enriched):
        key = " ".join((rec.full_name or "").lower().split())
        if not key:
            return
        mark = "✓" if enriched else "·"
        bits = " — ".join(b for b in [rec.job_title, rec.email] if b)
        line = f"  {mark} {rec.full_name:24}  {bits}"
        # Only reprint on a real upgrade (first sight, or enrichment added detail).
        sig = f"{key}|{enriched}|{rec.email}"
        if sig in printed:
            return
        printed.add(sig)
        print(line, flush=True)

    result = await find_employees(
        company_name=company or slug_from(domain),
        domain=domain,
        high_value_titles=HIGH_VALUE_TITLES,
        on_update=on_update,
        office_location=location,
        seed_people=seed,
    )

    people = [
        {
            "name": r.full_name,
            "role": r.job_title,
            "email": r.email,
            "email_verified": r.email_verified,
            "phone": r.phone,
            "linkedin_url": r.linkedin_url,
            "sources": r.sources,
            "high_value": r.high_value,
        }
        for r in result.employees
    ]
    return {
        "domain": domain,
        "company": company,
        "slug": slug,
        "location": location,
        "people": people,
        "coverage_note": result.coverage_note,
    }


# --- index -------------------------------------------------------------------
def load_index() -> dict:
    if INDEX_FILE.exists():
        return json.loads(INDEX_FILE.read_text())
    return {}


def save_to_index(building_id: str, result: dict):
    index = load_index()
    index[building_id] = result
    INDEX_FILE.write_text(json.dumps(index, indent=2))


def print_people(result: dict):
    people = result.get("people", [])
    if not people:
        print("\nNo people revealed.")
        if result.get("coverage_note"):
            print(f"[i] {result['coverage_note']}")
        return
    scope = f" @ {result['location']}" if result.get("location") else ""
    print(
        f"\n{len(people)} people for {result['domain']}"
        f"{(' (' + result['company'] + ')') if result.get('company') else ''}{scope}:\n"
    )
    header = f"{'★':<2}{'NAME':<26} {'ROLE':<30} {'EMAIL':<30} LINKEDIN"
    print(header)
    print("-" * len(header))
    # High-value first, then by name.
    for p in sorted(people, key=lambda x: (not x.get("high_value"), x["name"].lower())):
        star = "★" if p.get("high_value") else " "
        email = p.get("email") or "-"
        if p.get("email") and not p.get("email_verified"):
            email += " (?)"  # pattern-guessed, unverified
        li = p.get("linkedin_url") or "-"
        print(f"{star:<2}{p['name']:<26} {(p.get('role') or '-'):<30} {email:<30} {li}")
    if result.get("coverage_note"):
        print(f"\n[i] {result['coverage_note']}")


# --- cli ---------------------------------------------------------------------
def cmd_list():
    index = load_index()
    if not index:
        print(
            "No rosters cached yet. Run: python people.py <company-url> --slug <slug>"
        )
        return
    print(f"{'BUILDING':<20} {'DOMAIN':<24} PEOPLE")
    print("-" * 52)
    for bid, r in index.items():
        print(f"{bid:<20} {r.get('domain', ''):<24} {len(r.get('people', []))}")


def cmd_show(building_id: str):
    index = load_index()
    r = index.get(building_id)
    if not r:
        print(
            f"No cached roster '{building_id}'. Run: python people.py list",
            file=sys.stderr,
        )
        sys.exit(1)
    print_people(r)


def main():
    argv = sys.argv[1:]
    if argv and argv[0] == "list":
        cmd_list()
        return
    if argv and argv[0] == "show":
        if len(argv) < 2:
            print("usage: python people.py show <building_id>", file=sys.stderr)
            sys.exit(1)
        cmd_show(argv[1])
        return

    p = argparse.ArgumentParser(
        description="People finder — LinkedIn roster + enrichment for a company.",
        usage="people.py <company-url> --slug <linkedin-slug> [opts] | list | show <id>",
    )
    p.add_argument("target", nargs="?", help="company URL or domain")
    p.add_argument(
        "--source",
        choices=["apollo", "linkedin"],
        default="apollo",
        help="discovery source (default: apollo — server-side, no browser)",
    )
    p.add_argument(
        "--reveal",
        type=int,
        default=60,
        help="apollo: max people to unmask (1 credit each, high-value first)",
    )
    p.add_argument(
        "--max-people",
        type=int,
        default=500,
        help="apollo: max roster size to discover (free)",
    )
    p.add_argument(
        "--slug", help="linkedin: company slug (linkedin.com/company/<slug>/)"
    )
    p.add_argument("--company", default="", help="company name (filters current staff)")
    p.add_argument(
        "--location", default="", help='office, e.g. "London, United Kingdom"'
    )
    p.add_argument("--id", help="building id to cache under (defaults to the domain)")
    p.add_argument("--cdp", default=CDP_DEFAULT, help="linkedin: Chrome CDP endpoint")
    p.add_argument(
        "--expands", type=int, default=MAX_EXPANDS, help="linkedin: 'Show more' clicks"
    )
    p.add_argument(
        "--no-enrich",
        action="store_true",
        help="linkedin: scrape only, skip enrichment",
    )
    args = p.parse_args()

    if not args.target:
        p.print_help()
        sys.exit(1)

    domain = normalise_domain(args.target)
    if not domain:
        print(f"Could not parse a domain from {args.target!r}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.source == "apollo":
            result = asyncio.run(
                discover_apollo(
                    domain, args.company, args.location, args.max_people, args.reveal
                )
            )
        else:
            slug = args.slug or slug_from(domain)
            if not args.slug:
                print(
                    f"[i] No --slug given; guessing '{slug}' from the domain. If the "
                    f"People tab is empty, pass the real slug from "
                    f"linkedin.com/company/<slug>/.",
                    file=sys.stderr,
                )
            result = asyncio.run(
                discover(
                    domain,
                    slug,
                    args.company,
                    args.location,
                    args.cdp,
                    args.expands,
                    enrich=not args.no_enrich,
                )
            )
    except SystemExit:
        raise  # scrape_people already printed a helpful CDP/login message
    except Exception as e:
        print(f"[!] People discovery failed: {e}", file=sys.stderr)
        sys.exit(1)

    building_id = (args.id or domain).strip().lower()
    save_to_index(building_id, result)
    print_people(result)
    print(
        f"\n[+] Cached as '{building_id}'. Reprint with: python people.py show {building_id}"
    )


if __name__ == "__main__":
    main()

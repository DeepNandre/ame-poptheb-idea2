"""People worker — the named humans behind a building's occupant companies.

Reads occupants.json (from the occupancy worker), takes the active companies, and for each
one builds a roster two ways, then merges them:

  1. Companies House officers/directors — real people legally tied to the company. Always
     included; this is the guaranteed floor even when Apollo has nothing.
  2. The full Apollo employee roster for the company (search → reveal), keyed on the
     Companies House name. No location filter — every employee Apollo indexes is pulled.

Merge is by name: a Companies House director who also shows up in Apollo gets enriched with
LinkedIn + work email; Apollo-only employees are added as new people. So the output answers
"who works at the companies in this building" — names + role + company from Companies House,
plus the wider employee roster + LinkedIn + email from Apollo.

Blocking worker (Starlette threadpool). Companies House calls are sync; the Apollo roster
pulls are async and run concurrently (bounded) under asyncio.run inside the worker thread.
"""

import asyncio
import json
import re

import httpx

import apollo_people
import building
import store

COMPANY_CONCURRENCY = 5  # cap concurrent Apollo roster pulls (one per company)

# Titles surfaced (and revealed) first within each company's reveal budget.
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
]


# Honorifics PSC names carry but officer names don't — stripped so the same human matches
# across both ('Mr Shichuang Xie' PSC == 'Shichuang Xie' director).
_TITLE_RE = re.compile(r"^(mr|mrs|ms|miss|dr|prof|sir|dame|lord|lady)\.?\s+", re.I)


def _norm(name: str) -> str:
    """Loose key for matching a name across Companies House officers, PSCs, and Apollo —
    lowercased, whitespace-collapsed, leading honorific dropped."""
    n = re.sub(r"\s+", " ", (name or "").strip().lower())
    return _TITLE_RE.sub("", n).strip()


def _collect_records(companies: list[dict], max_companies: int):
    """Active companies → (active_companies, officers_by_co, pscs_by_co) via Companies House.

    Officers are pulled with the full history (resigned included) and PSCs (beneficial
    owners) are pulled too, so the roster is everyone the public record ties to each
    company, not just sitting directors."""
    key = building._ch_key()
    active = [c for c in companies if c.get("status") == "active"][:max_companies]
    officers_by_co: dict[str, list[dict]] = {}
    pscs_by_co: dict[str, list[dict]] = {}
    with httpx.Client() as client:
        for c in active:
            num = c["number"]
            officers_by_co[num] = building.officers_at(
                client, key, num, current_only=False
            )
            pscs_by_co[num] = building.pscs_at(client, key, num)
    return active, officers_by_co, pscs_by_co


def _base_record(company: dict, officer: dict) -> dict:
    return {
        "name": officer["name"],
        "role": officer.get("role"),
        "company": company["name"],
        "company_number": company["number"],
        "appointed": officer.get("appointed"),
        "resigned": officer.get("resigned"),
        "active_officer": not officer.get("resigned"),
        "is_psc": False,
        "email": None,
        "email_verified": False,
        "linkedin_url": None,
        "sources": ["companies_house"],
    }


def _merge_pscs(
    company: dict, pscs: list[dict], by_name: dict[str, dict], order: list[str]
) -> None:
    """Fold PSCs into the roster: a PSC who is also an officer is flagged in place; a
    PSC-only beneficial owner is added as a new person."""
    for psc in pscs:
        key = _norm(psc.get("name", ""))
        if not key:
            continue
        if key in by_name:
            rec = by_name[key]
            rec["is_psc"] = True
            rec["natures_of_control"] = psc.get("natures_of_control") or []
        else:
            by_name[key] = {
                "name": psc["name"],
                "role": psc.get("role") or "person with significant control",
                "company": company["name"],
                "company_number": company["number"],
                "appointed": psc.get("appointed"),
                "resigned": None,
                "active_officer": False,
                "is_psc": True,
                "natures_of_control": psc.get("natures_of_control") or [],
                "email": None,
                "email_verified": False,
                "linkedin_url": None,
                "sources": ["companies_house"],
            }
            order.append(key)


async def _people_for_company(
    company: dict,
    officers: list[dict],
    pscs: list[dict],
    enrich: bool,
    max_reveal: int,
) -> list[dict]:
    """Companies House officers (full history) + PSCs + the full Apollo roster for one
    company, merged by name."""
    by_name: dict[str, dict] = {}
    order: list[str] = []
    for o in officers:
        rec = _base_record(company, o)
        key = _norm(rec["name"])
        if key in by_name:
            # Same human with multiple appointment records (e.g. resigned then re-appointed)
            # — keep one person, preferring the active appointment and earliest appointed.
            prev = by_name[key]
            if rec["active_officer"] and not prev["active_officer"]:
                rec["appointed"] = prev["appointed"] or rec["appointed"]
                by_name[key] = rec
            continue
        by_name[key] = rec
        order.append(key)

    _merge_pscs(company, pscs, by_name, order)

    if not enrich:
        return [by_name[k] for k in order]

    try:
        roster = await apollo_people.company_roster_by_name(
            company["name"],
            max_reveal=max_reveal,
            high_value_titles=HIGH_VALUE_TITLES,
        )
    except Exception:
        roster = None

    for ap in (roster or {}).get("people", []):
        key = _norm(ap.get("name", ""))
        if not key:
            continue
        if (
            key in by_name
        ):  # a Companies House director Apollo also knows — enrich in place
            rec = by_name[key]
            rec["email"] = ap.get("email") or rec["email"]
            rec["email_verified"] = ap.get("email_verified") or rec["email_verified"]
            rec["linkedin_url"] = ap.get("linkedin_url") or rec["linkedin_url"]
            if ap.get("role"):
                rec["apollo_title"] = ap.get("role")
            if "apollo" not in rec["sources"]:
                rec["sources"].append("apollo")
        else:  # an employee not on the Companies House register — add them
            by_name[key] = {
                "name": ap.get("name"),
                "role": ap.get("role"),
                "company": company["name"],
                "company_number": company["number"],
                "appointed": None,
                "email": ap.get("email"),
                "email_verified": ap.get("email_verified", False),
                "linkedin_url": ap.get("linkedin_url"),
                "sources": ["apollo"],
            }
            order.append(key)

    return [by_name[k] for k in order]


async def _build_people(
    active: list[dict],
    officers_by_co: dict[str, list[dict]],
    pscs_by_co: dict[str, list[dict]],
    enrich: bool,
    max_reveal: int,
) -> list[dict]:
    sem = asyncio.Semaphore(COMPANY_CONCURRENCY)

    async def one(company: dict) -> list[dict]:
        async with sem:
            return await _people_for_company(
                company,
                officers_by_co.get(company["number"], []),
                pscs_by_co.get(company["number"], []),
                enrich,
                max_reveal,
            )

    per_company = await asyncio.gather(*(one(c) for c in active))
    return [p for group in per_company for p in group]


def run_people(
    slug: str,
    max_companies: int = 25,
    enrich: bool = True,
    max_reveal: int = 25,
    **_ignored,
) -> None:
    bdir = store.building_dir(slug)
    occ_file = bdir / "occupants.json"
    store.set_job(
        slug,
        "people",
        status="running",
        started_at=store.now(),
        error=None,
        finished_at=None,
    )

    if not occ_file.exists():
        store.set_job(
            slug,
            "people",
            status="failed",
            error="no occupants.json — run POST /occupants first",
            finished_at=store.now(),
        )
        return

    try:
        occ = json.loads(occ_file.read_text())
        active, officers_by_co, pscs_by_co = _collect_records(
            occ.get("companies", []), max_companies
        )
        people = asyncio.run(
            _build_people(active, officers_by_co, pscs_by_co, enrich, max_reveal)
        )
    except (Exception, SystemExit) as e:
        store.set_job(
            slug,
            "people",
            status="failed",
            error=f"{type(e).__name__}: {e}",
            finished_at=store.now(),
        )
        return

    # Per-company rollup so the caller can see coverage at a glance.
    by_company: dict[str, dict] = {}
    for c in active:
        by_company[c["number"]] = {
            "company": c["name"],
            "number": c["number"],
            "people": 0,
            "enriched": 0,
        }
    for p in people:
        bc = by_company.get(p["company_number"])
        if bc:
            bc["people"] += 1
            if "apollo" in p.get("sources", []) and p.get("linkedin_url"):
                bc["enriched"] += 1

    enriched_total = sum(1 for p in people if p.get("linkedin_url"))
    payload = {
        "building": slug,
        "people": people,
        "by_company": list(by_company.values()),
        "enriched": enriched_total,
    }
    (bdir / "people.json").write_text(json.dumps(payload, indent=2))
    store.set_job(
        slug,
        "people",
        status="complete",
        finished_at=store.now(),
        people_count=len(people),
        companies_processed=len(active),
        enriched=enriched_total,
    )

"""People worker — the named humans behind a building's occupant companies.

Reads occupants.json (from the occupancy worker), takes the active companies, and pulls
each company's current officers/directors from Companies House (real people legally tied
to the company — the roster for a building's micro-tenants, which Apollo doesn't index but
Companies House does). Each person is then enriched through Apollo's people/match for a
LinkedIn profile + work email, and tagged with the company they work at. Aggregated into
people.json; the router serves it on GET.

So the output answers "who is in this building and where do they work": names + role +
company from Companies House, LinkedIn + email from Apollo.

Blocking worker (Starlette threadpool). Companies House calls are sync; Apollo enrich is
async and runs concurrently (bounded) under asyncio.run inside the worker thread.
"""

import asyncio
import json

import httpx

import apollo_people
import building
import store

ENRICH_CONCURRENCY = 10  # cap concurrent Apollo people/match calls


def _collect_officers(companies: list[dict], max_companies: int):
    """Active companies → their current officers, via Companies House."""
    key = building._ch_key()
    active = [c for c in companies if c.get("status") == "active"][:max_companies]
    rows: list[tuple[dict, dict]] = []
    with httpx.Client() as client:
        for c in active:
            for o in building.officers_at(client, key, c["number"]):
                rows.append((c, o))
    return active, rows


async def _enrich_rows(rows: list[tuple[dict, dict]], enrich: bool) -> list[dict]:
    sem = asyncio.Semaphore(ENRICH_CONCURRENCY)

    async def one(company: dict, officer: dict) -> dict:
        rec = {
            "name": officer["name"],
            "role": officer.get("role"),
            "company": company["name"],
            "company_number": company["number"],
            "appointed": officer.get("appointed"),
            "email": None,
            "email_verified": False,
            "linkedin_url": None,
            "sources": ["companies_house"],
        }
        if enrich and officer.get("name"):
            async with sem:
                try:
                    m = await apollo_people.match_person(
                        officer["name"], organization_name=company["name"]
                    )
                except Exception:
                    m = None
            if m:
                rec["email"] = m.get("email")
                rec["email_verified"] = m.get("email_verified", False)
                rec["linkedin_url"] = m.get("linkedin_url")
                if m.get("title"):
                    rec["apollo_title"] = m.get("title")
                rec["sources"] = ["companies_house", "apollo"]
        return rec

    return await asyncio.gather(*(one(c, o) for c, o in rows))


def run_people(
    slug: str,
    max_companies: int = 25,
    enrich: bool = True,
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
        active, rows = _collect_officers(occ.get("companies", []), max_companies)
        people = asyncio.run(_enrich_rows(rows, enrich))
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

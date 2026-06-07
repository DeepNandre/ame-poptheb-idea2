"""Occupancy worker — reverse-address company lookup for a building.

Runs building.py's Companies House + FHRS reverse-address search as a background job,
keyed on the postcode derived from the address the building was added with. Writes
occupants.json into the building dir; the router serves it on GET and the people worker
reads it as its input.

Blocking — runs inside a FastAPI BackgroundTask (Starlette threadpool). The postcode and
Companies House key are validated synchronously in the router before this is scheduled,
so a missing key / unparseable postcode is a 422 to the caller, not a stuck job here.
"""

import json

import building
import store


def run_occupants(slug: str, query: str, active_only: bool = True) -> None:
    bdir = store.building_dir(slug)
    bdir.mkdir(parents=True, exist_ok=True)
    store.set_job(
        slug,
        "occupants",
        status="running",
        started_at=store.now(),
        error=None,
        finished_at=None,
    )

    try:
        result = building.search_building(query, active_only=active_only, use_fhrs=True)
    except SystemExit as e:
        # building.search_building exits on no-postcode / no-key; the router guards both,
        # so this only fires on an edge we didn't pre-validate.
        store.set_job(
            slug,
            "occupants",
            status="failed",
            error=f"occupancy search aborted ({e})",
            finished_at=store.now(),
        )
        return
    except Exception as e:
        store.set_job(
            slug,
            "occupants",
            status="failed",
            error=f"{type(e).__name__}: {e}",
            finished_at=store.now(),
        )
        return

    (bdir / "occupants.json").write_text(json.dumps(result, indent=2))
    store.set_job(
        slug,
        "occupants",
        status="complete",
        finished_at=store.now(),
        postcode=result.get("postcode"),
        company_count=len(result.get("companies", [])),
    )

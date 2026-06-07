"""A1 — Schematic Ingestion & 3D Mapping worker.

Runs IN-PROCESS (refactored schematic-scanning pipeline functions) so per-PDF progress
can be streamed straight into the job registry: extract → graph → building → routes,
plus a best-effort walls pass. The expensive stage is extract (one o3 vision call per
floor sheet); its progress callback drives the docs_processed/docs_total poll.

Outputs land in the canonical building dir:
    floors/*.json   per-level room JSON      (count = floors extracted)
    graph.json      merged room graph
    building.json   doorway graph            → GET /buildings/{id}/graph
    routes.json     traversal skeleton       → GET /buildings/{id}/routes
    walls.json      wall geometry (optional, for the 3D wall layer)
"""

import sys

import store

# The pipeline modules live outside this package and import each other flat, so put
# their dir on sys.path and import by bare name (mirrors enricher_bridge.py).
if str(store.SCHEMATIC_DIR) not in sys.path:
    sys.path.insert(0, str(store.SCHEMATIC_DIR))


def run_ingest(slug: str) -> None:
    """Blocking — run inside a FastAPI BackgroundTask (Starlette threadpool)."""
    import door_graph_builder
    import extract
    import graph_builder
    import route_graph_builder
    import vector_extract

    bdir = store.building_dir(slug)
    pdf_dir = store.pdf_dir_for(slug)
    floors_dir = bdir / "floors"
    curated = bdir / "building.curated.json"

    store.set_job(
        slug,
        "ingest",
        status="running",
        started_at=store.now(),
        finished_at=None,
        error=None,
        current_stage="extract",
        docs_processed=0,
        docs_total=store.doc_count(slug),
        low_confidence_floors=[],
    )

    def cb(done: int, total: int, stem: str) -> None:
        store.set_job(
            slug,
            "ingest",
            docs_processed=done,
            docs_total=total,
            current_stage=f"extract:{stem}",
        )

    try:
        summary = extract.run(pdf_dir, floors_dir, progress_cb=cb)
        store.set_job(
            slug,
            "ingest",
            docs_processed=summary["sheets_processed"],
            docs_total=summary["sheets_total"],
            floors_extracted=summary["floors_extracted"],
            low_confidence_floors=summary["low_confidence"],
            skipped_sheets=summary["skipped"],
            current_stage="graph",
        )
        if summary["floors_extracted"] == 0:
            raise ValueError(
                "no floor sheets extracted — nothing to build a model from"
            )

        graph_builder.run(floors_dir, bdir / "graph.json")

        store.set_job(slug, "ingest", current_stage="building")
        door_graph_builder.run(
            bdir / "graph.json",
            bdir / "building.json",
            curated_path=curated if curated.exists() else None,
        )

        store.set_job(slug, "ingest", current_stage="routes")
        route_graph_builder.run(bdir / "building.json", bdir / "routes.json")

        # Walls feed the 3D wall layer but aren't needed for nodes/edges/routes, so a
        # failure here must not fail the whole ingest.
        store.set_job(slug, "ingest", current_stage="walls")
        try:
            vector_extract.run(pdf_dir, bdir / "walls.json")
        except Exception as e:  # noqa: BLE001
            print(f"  walls pass failed (non-fatal): {type(e).__name__}: {e}")

        store.set_job(
            slug,
            "ingest",
            status="complete",
            current_stage="done",
            finished_at=store.now(),
        )
    except Exception as e:  # noqa: BLE001
        store.set_job(
            slug,
            "ingest",
            status="failed",
            error=f"{type(e).__name__}: {e}",
            finished_at=store.now(),
        )

"""Building index + job registry for the blueprint pipeline API.

The "internal database" of buildings is just the on-disk directory tree at
building-scanner/buildings/<slug>/. A building is "enriched" once it has ≥1 blueprint
PDF (either flat in the slug dir, the older layout, or under documents/, where the
download agent now writes). A0 (discover) and A1 (ingest) each run as one background
job per building; their lifecycle is tracked here and persisted to jobs.json so a
poller survives a server reload.

Progress that the workers emit incrementally (A0's phase, A1's docs_processed) is read
straight off disk by the router — the files ARE the progress — so this registry only
needs the coarse job lifecycle (pending/running/complete/failed).
"""

import json
import threading
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ROOT = BACKEND_DIR.parent  # building-scanner/
BUILDINGS_DIR = ROOT / "buildings"
SCHEMATIC_DIR = ROOT / "dev" / "arbor-graph" / "dev" / "schematic-scanning"
PLANNING_SCOUT_MAIN = ROOT.parent / "toolings" / "planning-scout" / "main.py"
JOBS_FILE = BACKEND_DIR / "jobs.json"

_lock = threading.RLock()
_jobs: dict[str, dict] = {}


# ── Job registry ──────────────────────────────────────────────────────────────
def _key(slug: str, phase: str) -> str:
    return f"{slug}:{phase}"


def load_jobs() -> None:
    """Load jobs.json at startup. Any job still 'running' died with the previous
    process (background tasks don't survive a restart), so mark it failed."""
    global _jobs
    if JOBS_FILE.exists():
        try:
            _jobs = json.loads(JOBS_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            _jobs = {}
    changed = False
    for j in _jobs.values():
        if j.get("status") == "running":
            j["status"] = "failed"
            j["error"] = "interrupted by server restart"
            changed = True
    if changed:
        _persist()


def _persist() -> None:
    tmp = JOBS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(_jobs, indent=2))
    tmp.replace(JOBS_FILE)  # atomic — a poller never reads a half-written file


def get_job(slug: str, phase: str) -> dict | None:
    with _lock:
        j = _jobs.get(_key(slug, phase))
        return dict(j) if j else None


def set_job(slug: str, phase: str, **fields) -> dict:
    with _lock:
        j = _jobs.setdefault(_key(slug, phase), {"building": slug, "phase": phase})
        j.update(fields)
        _persist()
        return dict(j)


def is_running(slug: str, phase: str) -> bool:
    j = get_job(slug, phase)
    return bool(j and j.get("status") == "running")


# ── Building store helpers ──────────────────────────────────────────────────────
def building_dir(slug: str) -> Path:
    return BUILDINGS_DIR / slug


def exists(slug: str) -> bool:
    return building_dir(slug).is_dir()


def pdf_dir_for(slug: str) -> Path:
    """Where this building's blueprint PDFs live: documents/ if it has any, else the
    flat slug dir (the older hand-curated layout, e.g. Arbor)."""
    bdir = building_dir(slug)
    docs = bdir / "documents"
    if docs.is_dir() and any(docs.glob("*.pdf")):
        return docs
    return bdir


def doc_count(slug: str) -> int:
    return len(list(pdf_dir_for(slug).glob("*.pdf")))


def enriched(slug: str) -> bool:
    return doc_count(slug) > 0


def overall_status(slug: str) -> str:
    """Coarse rollup for the list view."""
    if (building_dir(slug) / "building.json").exists():
        return "ingested"
    if enriched(slug):
        return "enriched"
    d = get_job(slug, "discover")
    if d and d.get("status") == "running":
        return "discovering"
    return "empty"


def list_slugs() -> list[str]:
    if not BUILDINGS_DIR.is_dir():
        return []
    return sorted(p.name for p in BUILDINGS_DIR.iterdir() if p.is_dir())


# ── Per-building metadata (the address the building was added with) ──────────────
def read_meta(slug: str) -> dict:
    f = building_dir(slug) / "meta.json"
    if f.exists():
        try:
            return json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def write_meta(slug: str, **fields) -> dict:
    bdir = building_dir(slug)
    bdir.mkdir(parents=True, exist_ok=True)
    meta = read_meta(slug)
    meta.update(fields)
    (bdir / "meta.json").write_text(json.dumps(meta, indent=2))
    return meta


def now() -> float:
    return time.time()

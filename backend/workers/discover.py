"""A0 — Schematic Discovery worker.

Spawns the existing local OpenAI planning-scout agent as a SUBPROCESS, pointed at the
canonical buildings/<slug>/ dir. The subprocess isolates openai-agents' own asyncio +
Playwright-MCP event loop from the API's, and runs under the interpreter that has the
openai-agents SDK installed (the user's system python by default — overridable with
PLANNING_SCOUT_PYTHON). Live phase progress is the progress.json the agent writes; this
worker only owns the coarse job lifecycle.
"""

import os
import subprocess

import store

# The agent enforces its own AGENT_TIMEOUT (default 600s); give the subprocess headroom
# on top so a clean agent timeout surfaces as its own failed phase, not a hard kill here.
SUBPROCESS_TIMEOUT = float(os.environ.get("DISCOVER_SUBPROCESS_TIMEOUT", "900"))


def run_discover(slug: str, address: str) -> None:
    """Blocking — run inside a FastAPI BackgroundTask (Starlette threadpool)."""
    bdir = store.building_dir(slug)
    bdir.mkdir(parents=True, exist_ok=True)
    store.set_job(
        slug,
        "discover",
        status="running",
        started_at=store.now(),
        error=None,
        finished_at=None,
    )

    py = os.environ.get("PLANNING_SCOUT_PYTHON", "python3")
    cmd = [py, str(store.PLANNING_SCOUT_MAIN), address, slug, str(bdir)]

    try:
        proc = subprocess.run(
            cmd,
            cwd=str(
                store.PLANNING_SCOUT_MAIN.parent
            ),  # so its relative imports + .env resolve
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        store.set_job(
            slug,
            "discover",
            status="failed",
            error=f"agent subprocess exceeded {SUBPROCESS_TIMEOUT:.0f}s",
            finished_at=store.now(),
        )
        return
    except Exception as e:
        store.set_job(
            slug,
            "discover",
            status="failed",
            error=f"{type(e).__name__}: {e}",
            finished_at=store.now(),
        )
        return

    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-600:]
        store.set_job(
            slug,
            "discover",
            status="failed",
            error=f"agent exited {proc.returncode}: {tail}",
            finished_at=store.now(),
        )
        return

    store.set_job(
        slug,
        "discover",
        status="complete",
        finished_at=store.now(),
        doc_count=store.doc_count(slug),
    )

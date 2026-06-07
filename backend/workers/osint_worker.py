"""C — OSINT worker.

Wraps scan.py's passive, VPN-gated device scan as a pollable job. Needs a company
domain (the org whose IP space is attributed + scanned). VPN-down / no-ranges are
reported as 'unavailable' with the reason, never as a fake empty success.
"""

import asyncio

import store


def run_osint(slug: str, domain: str = "") -> None:
    """Blocking — run inside a FastAPI BackgroundTask (Starlette threadpool)."""
    store.set_job(
        slug,
        "osint",
        status="running",
        started_at=store.now(),
        finished_at=None,
        error=None,
        devices=[],
    )

    if not domain:
        store.set_job(
            slug,
            "osint",
            status="unavailable",
            error="no company domain — pass {domain} to attribute IP space",
            finished_at=store.now(),
        )
        return

    try:
        import scan as scan_engine

        d = scan_engine.normalise_domain(domain)
        if not d:
            raise ValueError(f"could not parse a domain from {domain!r}")
        result = asyncio.run(scan_engine.scan(d))
        scan_engine.save_to_index(slug, result)
        devices = result.get("devices", [])
        store.set_job(
            slug,
            "osint",
            status="complete",
            finished_at=store.now(),
            devices=devices,
            device_count=len(devices),
            org=result.get("org", ""),
        )
    except Exception as e:  # noqa: BLE001
        # VPN down / no attributable ranges → unavailable (expected), else failed.
        name = type(e).__name__
        status = (
            "unavailable" if name in ("VpnDownError", "NoRangesError") else "failed"
        )
        store.set_job(
            slug, "osint", status=status, error=f"{name}: {e}", finished_at=store.now()
        )

#!/usr/bin/env python3
"""FastAPI wrapper around the building device scanner (scan.py).

Same engine as the CLI: a company URL goes in, the org's IP space is attributed,
device fingerprints run over Shodan, and results are cached per building in
camera_index.json. This module just exposes that over HTTP.

    uv run uvicorn api:app --port 8000          # serve
    uv run uvicorn api:app --reload             # dev (cache is on disk, safe to reload)

SECURITY: scanning is VPN-gated exactly like the CLI. POST /scan returns 503 if the
Surfshark WireGuard tunnel isn't the active default route, so the real IP is never
sent to Shodan. Passive only — reads Shodan's index, never probes found devices.

Endpoints:
    GET  /health             VPN status + egress IP (no scan)
    POST /scan               {url, id?} -> attribute + scan + cache, returns devices
    GET  /buildings          list cached buildings (id, domain, org, device count)
    GET  /buildings/{id}     full cached result for one building, or 404

The scan is synchronous: POST /scan blocks ~60-120s (Shodan is rate-limited to
~1 req/sec) and returns the full result in one response. No job store or polling.
"""

import json
import pathlib

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import scan as engine

app = FastAPI(
    title="Building Device Scanner API",
    version="1.0",
    description="Passive, VPN-gated OSINT scan: company URL -> exposed devices (IP:port + URL).",
)

# ── Demo fixtures ─────────────────────────────────────────────────────────────
# Example buildings with hard-coded scan results so the UI returns instantly
# instead of waiting on the live 60-120s Shodan sweep. Each fixture is a real
# captured /scan response. Matched by substring against the incoming url/query.
_FIXTURE_DIR = pathlib.Path(__file__).resolve().parent / "fixtures"
_DEMO_FIXTURES = [
    {
        "keys": ("fenchurch", "walkie", "20fenchurchstreet", "skygarden", "sky garden"),
        "file": "walkie_talkie.json",
    },
]


def _demo_fixture(req: "ScanRequest") -> dict | None:
    """Return a hard-coded scan result if the request targets a known demo building."""
    haystack = " ".join(s for s in (req.url, req.query) if s).lower()
    if not haystack:
        return None
    for entry in _DEMO_FIXTURES:
        if any(k in haystack for k in entry["keys"]):
            result = json.loads((_FIXTURE_DIR / entry["file"]).read_text())
            # Echo back what the caller actually asked with, so the UI's
            # "from <query>" attribution stays accurate.
            result["resolved_from"] = req.query or req.url
            if req.id:
                result["building_id"] = req.id.strip().lower()
            return result
    return None


class ScanRequest(BaseModel):
    # Either a direct URL/domain, OR a free-text query (building/company name +
    # address) we resolve to a website via the Maps API. At least one is required.
    url: str | None = None  # company URL or bare domain, e.g. "mit.edu"
    query: str | None = None  # e.g. "1 Blackfriars Road, London" → resolve a domain
    id: str | None = None  # building id to cache under (defaults to the domain)


@app.get("/health")
async def health() -> dict:
    """VPN tunnel status and egress IP. Use this to confirm Surfshark is up before scanning."""
    return await engine.vpn_status()


@app.post("/scan")
async def run_scan(req: ScanRequest) -> dict:
    """Attribute the domain's IP space, scan it for devices, cache, and return the result.

    Accepts a direct `url` or a free-text `query` (building/company name) we resolve
    to a website via the Maps API. 503 if the VPN is down, 422 if no domain resolves
    or no org ranges attribute.
    """
    # Demo buildings short-circuit to a hard-coded result (no live scan).
    fixture = _demo_fixture(req)
    if fixture is not None:
        return fixture

    domain = engine.normalise_domain(req.url) if req.url else ""
    resolved_from: str | None = None
    if not domain:
        if not req.query:
            raise HTTPException(422, "Provide a url or a query to scan.")
        try:
            domain = await engine.resolve_domain(req.query)
            resolved_from = req.query
        except engine.NoDomainError as e:
            raise HTTPException(422, str(e))
    try:
        result = await engine.scan(domain)
    except engine.VpnDownError as e:
        raise HTTPException(503, str(e))
    except engine.NoRangesError as e:
        raise HTTPException(422, str(e))
    except engine.ScanError as e:
        raise HTTPException(500, str(e))

    building_id = (req.id or domain).strip().lower()
    engine.save_to_index(building_id, result)
    # Surface what we resolved so the UI can show "scanned acme.com (from <query>)".
    return {
        "building_id": building_id,
        "resolved_domain": domain,
        "resolved_from": resolved_from,
        **result,
    }


@app.get("/buildings")
async def list_buildings() -> list[dict]:
    """Every cached building: id, domain, org, and device count."""
    index = engine.load_index()
    return [
        {
            "building_id": bid,
            "domain": r.get("domain", ""),
            "org": r.get("org", ""),
            "devices": len(r.get("devices", [])),
        }
        for bid, r in index.items()
    ]


@app.get("/buildings/{building_id}")
async def get_building(building_id: str) -> dict:
    """The full cached result (org, cidrs, devices) for one building, or 404."""
    index = engine.load_index()
    r = index.get(building_id.strip().lower())
    if not r:
        raise HTTPException(404, f"No cached building {building_id!r}")
    return {"building_id": building_id, **r}

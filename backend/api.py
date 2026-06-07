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

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import scan as engine

app = FastAPI(
    title="Building Device Scanner API",
    version="1.0",
    description="Passive, VPN-gated OSINT scan: company URL -> exposed devices (IP:port + URL).",
)


class ScanRequest(BaseModel):
    url: str  # company URL or bare domain, e.g. "mit.edu"
    id: str | None = None  # building id to cache under (defaults to the domain)


@app.get("/health")
async def health() -> dict:
    """VPN tunnel status and egress IP. Use this to confirm Surfshark is up before scanning."""
    return await engine.vpn_status()


@app.post("/scan")
async def run_scan(req: ScanRequest) -> dict:
    """Attribute the domain's IP space, scan it for devices, cache, and return the result.

    503 if the VPN is down, 422 if the URL is unparseable or no org ranges resolve.
    """
    domain = engine.normalise_domain(req.url)
    if not domain:
        raise HTTPException(422, f"Could not parse a domain from {req.url!r}")
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
    return {"building_id": building_id, **result}


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

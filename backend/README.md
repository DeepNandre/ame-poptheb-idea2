# Building Device Scanner

An OSINT tool: give it a company URL and it surfaces the network devices in that
organisation's IP space — cameras, RFID/access-control readers, building-automation
services, and exposed remote access — each with an `IP:port`, a reachable URL, and a
Shodan host link. Results are cached per building so you can re-query without
rescanning. Use it two ways: a **CLI** (`scan.py`) or an **HTTP API** (`api.py`),
both driving the same engine.

All Shodan/RDAP traffic is forced through a Surfshark WireGuard VPN; the scan
aborts before sending anything if the tunnel isn't the active default route, so
your real IP is never exposed. It is **passive** — it reads Shodan's index and
public certificate-transparency logs, and never probes the devices it finds.

---

## Setup

Requires [`uv`](https://docs.astral.sh/uv/) and a Shodan API key.

```bash
uv sync
```

Put your key in `backend/.env` (or the project-root `.env` — both are loaded and
gitignored):

```
SHODAN_API_KEY=your_key_here
```

Connect Surfshark (full-tunnel WireGuard) before scanning. The preflight checks
that the default route is the `surfshark_wg` interface and aborts otherwise.

---

## Usage

```bash
uv run python scan.py <company-url>          # scan, print, and cache
uv run python scan.py <company-url> --id hq  # cache under a custom building id
uv run python scan.py list                   # list cached buildings
uv run python scan.py show <building-id>      # reprint a cached result (no rescan)
```

### Example

```bash
uv run python scan.py mit.edu
```

```
[*] VPN preflight…
[+] Tunnelled via surfshark_wg → egress 138.199.29.143
[*] Attributing IP space for mit.edu (CT logs → RDAP)…
[+] org='Massachusetts Institute of Technology'  cidrs=['18.0.0.0/11', '128.30.0.0/16', '128.52.0.0/16']
[*] Scanning: camera…
[*] Scanning: access_control…
[*] Scanning: building_service…

18 device(s) for mit.edu (org: Massachusetts Institute of Technology):

CATEGORY         PRODUCT                  URL                          SHODAN
-----------------------------------------------------------------------------
camera           -                        rtsp://18.18.134.16:554      https://www.shodan.io/host/18.18.134.16
camera           -                        rtsp://18.27.130.103:554     https://www.shodan.io/host/18.27.130.103
remote_access    Remote Desktop Protocol  18.25.5.154:3389             https://www.shodan.io/host/18.25.5.154
...
```

---

## HTTP API

The same engine behind an HTTP wrapper (`api.py`, FastAPI). Connect Surfshark first,
then serve:

```bash
uv run uvicorn api:app --port 8000          # serve
uv run uvicorn api:app --reload             # dev (cache is on disk, safe to reload)
```

Interactive docs (Swagger UI) are at `http://localhost:8000/docs`.

Scanning is VPN-gated exactly like the CLI: `POST /scan` returns **503** if the
Surfshark tunnel isn't the active default route, so your real IP is never sent to
Shodan. The scan is **synchronous** — `POST /scan` blocks ~60–120s (Shodan is
rate-limited to ~1 req/sec) and returns the full result in one response. No job
store, no polling.

### Endpoints

| Method | Path | Body / Params | Returns |
|---|---|---|---|
| `GET` | `/health` | — | `{vpn_up, iface, egress_ip}` — VPN status, no scan |
| `POST` | `/scan` | `{"url": "...", "id": "..."?}` | scan result (attributes, scans, caches) |
| `GET` | `/buildings` | — | list of cached buildings (`building_id`, `domain`, `org`, `devices` count) |
| `GET` | `/buildings/{building_id}` | — | full cached result, or `404` |

`POST /scan` body: `url` is a company URL or bare domain; optional `id` is the
building id to cache under (defaults to the domain).

**Status codes:** `200` ok · `422` unparseable URL or no org-owned IP ranges
resolved · `404` unknown building id · `503` VPN not active · `500` other scan error.

### Examples

```bash
# Is the VPN up?
curl localhost:8000/health
# {"vpn_up": true, "iface": "surfshark_wg", "egress_ip": "138.199.29.143"}

# Scan a company (blocks until done, then caches under "mit.edu")
curl -X POST localhost:8000/scan -H 'content-type: application/json' \
     -d '{"url": "mit.edu"}'
# {"building_id": "mit.edu", "domain": "mit.edu",
#  "org": "Massachusetts Institute of Technology",
#  "cidrs": ["18.0.0.0/11", "128.30.0.0/16", "128.52.0.0/16"],
#  "devices": [{"category": "camera", "ip": "18.18.134.16", "port": 554,
#               "url": "rtsp://18.18.134.16:554", "shodan": "https://www.shodan.io/host/18.18.134.16"}, ...]}

# List cached buildings
curl localhost:8000/buildings

# Re-fetch a cached result without rescanning
curl localhost:8000/buildings/mit.edu
```

The CLI and API share `camera_index.json`, so a building scanned on the CLI is
retrievable over the API and vice versa.

> **Related:** building **occupancy & people** intel (who is registered in a building,
> the directors behind those companies, and per-person LinkedIn/email enrichment) lives in
> the separate Blueprint Pipeline API — see [`OCCUPANCY_API.md`](OCCUPANCY_API.md).

---

## How it works

1. **VPN preflight** — confirm the default route egresses via the `surfshark_wg`
   tunnel (and the egress IP isn't your ISP). Abort if not.
2. **Attribution** — the apex domain is usually CDN-fronted, so resolving it gives
   the CDN's IP, not the org's. Instead we enumerate subdomains from certificate
   transparency (CertSpotter + crt.sh) plus an infrastructure wordlist, resolve
   them, look each IP up via **RDAP** (`rdap.arin.net`, follows redirects to other
   RIRs), drop CDN/cloud-owned blocks, and keep the dominant org's real netblocks.
3. **Discovery** — run the `DEVICE_QUERIES` fingerprint list over Shodan against
   those CIDRs, deduped by `IP:port`.
4. **Classify** — label each device by its actual signal (port/product), not just
   which query found it, so e.g. an RDP host caught by a broad query isn't
   mislabelled a camera.
5. **Cache** — write to `camera_index.json` (gitignored), keyed by building id.

### Device categories

The fingerprint list lives in `DEVICE_QUERIES` in `scan.py` and is easy to extend.

| Category | Looks for |
|---|---|
| `camera` | RTSP:554, Hikvision / Dahua / Axis, screenshot-enabled hosts |
| `access_control` | HID VertX, Lenel, Genetec, Honeywell, RFID |
| `building_service` | BACnet (47808), Modbus (502) |
| `remote_access` | exposed RDP (3389) / VNC (assigned at classification time) |

---

## Files

```
scan.py            the engine + CLI (attribution + discovery + classify + cache)
api.py             FastAPI HTTP wrapper around the engine
vpn.py             VPN preflight (route check) + httpx client
pyproject.toml     deps: httpx, python-dotenv, fastapi, uvicorn
camera_index.json  scan cache, shared by CLI + API (gitignored)
```

---

## Choosing a target

Works best on organisations that **own their IP space** and whose subdomains
resolve into it (universities, large enterprises). CDN-fully-fronted sites with no
resolvable org subdomains will return no netblocks. `CertSpotter`'s free tier is
rate-limited (a few queries/hour without a key); when it's throttled, attribution
falls back to crt.sh and the infrastructure wordlist.

---

## Security & scope

- VPN-gated: no request leaves outside the WireGuard tunnel. The CLI aborts (exit 2)
  and the API returns `503` if the tunnel isn't the active default route.
- Passive: reads Shodan + CT logs only; never connects to or probes found devices.
- Intended for authorised security research and testing only.

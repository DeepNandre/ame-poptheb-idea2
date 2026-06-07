# Building Scanner — Project Handoff

> **Purpose:** Onboard the next agent to everything built so far, every issue hit, and what still needs improvement. Read this before touching code.

---

## What this repo is

Two products live in one repo (currently **App.tsx only mounts Building Scanner** — the Launch landing page components still exist but are unused):

| Product | Entry | Description |
|---------|-------|-------------|
| **Building Scanner** | `src/components/BuildingScannerProduct.tsx` | 3D Mapbox map + live WiFi scan + planning lookup + corporate OSINT + live CCTV discovery |
| **Launch landing** (dormant) | `src/components/Hero.tsx`, etc. | Marketing landing page — not wired into `App.tsx` |

**Stack:** React 19 + Vite 6 + TypeScript + Tailwind + Mapbox GL + Node HTTP/WS + Python 3 scripts.

**Run (dev):**
```bash
npm install --legacy-peer-deps
npm run install:cameradar   # once — installs bin/cameradar (macOS arm64/amd64)
brew install ffmpeg nmap    # ffmpeg for live CCTV video; nmap for Cameradar
npm run dev                 # single command — Vite + planning API + scanner WS + CCTV streams
```
Open http://localhost:5173

**Env (project root `.env.local`, NOT `server/`):**
```env
VITE_MAPBOX_TOKEN=...
SHODAN_API_KEY=...          # optional — real exposed infra
CENSYS_API_TOKEN=...        # optional — real exposed infra (Bearer token)
VITE_CCTV_DEMO=0            # set to 1 only for offline demo CCTV dataset
```

---

## Architecture (data flow)

```
Browser (BuildingScannerProduct.tsx)
  ├─ Mapbox 3D map + heatmap + geolocation
  ├─ Command bar (src/lib/agent.ts) → navigate / investigate / recon intents
  ├─ WebSocket ws://localhost:517x/ws/scanner  ← scannerRelay.mjs
  │     ├─ start_scan → server/scanner.py (WiFi beacon capture)
  │     ├─ run_corporate_recon → osint_engine.py → corporate_recon.py
  │     └─ scan_cctv_live → cameradar_engine.py
  ├─ HTTP /api/planning/* ← planning.mjs (UK planning proxy)
  └─ HTTP /api/cctv/* ← cctvStream.mjs (subnet detect + RTSP→MJPEG proxy)
```

**Key files:**

| Path | Role |
|------|------|
| `src/components/BuildingScannerProduct.tsx` | Main UI — map, scan, recon panel, CCTV feeds |
| `src/lib/agent.ts` | LLM + regex command routing (navigate/investigate/recon) |
| `src/lib/geocode.ts` | Mapbox geocoding |
| `src/lib/planning.ts` | Planning applications API client |
| `server/scannerRelay.mjs` | WebSocket hub, spawns Python processes |
| `server/scanner.py` | Passive WiFi/Bluetooth beacon scanner |
| `server/osint_engine.py` | OSINT: subdomains, employees, Shodan/Censys, CCTV |
| `server/corporate_recon.py` | Correlates live scan devices with OSINT |
| `server/cameradar_engine.py` | RTSP camera discovery via Cameradar |
| `server/cctvStream.mjs` | Local subnet detection + ffmpeg MJPEG proxy |
| `server/planning.mjs` | Planning records proxy |
| `server/index.mjs` | Standalone API on :8787 (`npm run api`) |
| `vite.config.ts` | Co-hosts backend in dev via `backendPlugin()` |
| `bin/cameradar` | Cameradar v6.1.1 binary (gitignored, via install script) |
| `AGENTS.md` | Cursor continual-learning notes (user prefs) |

---

## Features built (one by one)

### 1. 3D Mapbox building map
- Dark 3D buildings, user geolocation dot, fly-to on load
- Default center London; geolocation recenters map
- **Files:** `BuildingScannerProduct.tsx`, `BuildingMap.tsx`, `VITE_MAPBOX_TOKEN`

### 2. Live WiFi / Bluetooth passive scan
- "Scan" button starts Python scanner via WebSocket
- Real SSIDs + RSSI from user's machine (macOS `en0` etc.)
- Device count badge, "Networks nearby" side panel sorted by signal
- **Files:** `server/scanner.py`, `scannerRelay.mjs`

### 3. WiFi heatmap on map
- GeoJSON heatmap layer updated on each scan tick
- Points placed at **user's GPS location** with deterministic hash-based offset per MAC (NOT random, NOT per-AP GPS)
- Color by signal strength (weak=blue → strong=red)
- **Honest limitation:** networks have no real coordinates — dots are estimates at scan center
- **Files:** `updateHeatmapData()` in `BuildingScannerProduct.tsx`

### 4. UK planning records lookup
- Command bar "investigate" intent → geocode → planning API → detail panel + evidence report
- Proxy via `server/planning.mjs` at `/api/planning/*`
- **Files:** `src/lib/planning.ts`, `DetailPanel.tsx`, `EvidenceReport.tsx`

### 5. Natural-language command bar
- Intents: `navigate`, `investigate`, `recon`
- LLM routing when API key available; regex fallback
- Extracts company, place, IP range for recon/CCTV
- **Files:** `src/lib/agent.ts`, `CommandBar.tsx`

### 6. Corporate OSINT engine (Phase 1)
- Subdomains (subfinder if installed)
- Employee emails (theHarvester if installed)
- Exposed infrastructure (Shodan + Censys when keys set)
- Tech stack from company website
- **Files:** `server/osint_engine.py`

### 7. Live device correlation (Phase 2)
- Matches scanned WiFi device names against OSINT employee/tech data
- Outputs employees_present, correlated_devices with confidence + reasoning
- **Files:** `server/corporate_recon.py`

### 8. Corporate Recon UI panel
- Glass panel: staff count, WiFi links, subdomains, tech stack, exposed infra, correlated devices
- Collapsible diagnostics (internal tool names sanitized in UI)
- Triggered via command bar recon intent or **OSINT** button in panel
- **Files:** `BuildingScannerProduct.tsx`

### 9. Real API key loading (no silent fakes for OSINT)
- `.env.local` loaded from **project root** (was wrongly looking in `server/`)
- Removed fake subdomain lists, fake employee data, fake Shodan IPs when keys missing
- Empty arrays + honest notes when tools/keys unavailable
- **Files:** `scannerRelay.mjs`, `osint_engine.py`, `CORPORATE_RECON_REAL_KEYS.md`

### 10. CCTV / RTSP discovery (Cameradar)
- `cameradar_engine.py` wraps Cameradar v6 (CLI at `bin/cameradar`, Docker, or `--use-sample`)
- Parses M3U output, normalizes camera objects (ip, port, model, rtsp_url, credentials)
- Integrated into full OSINT pipeline + standalone fast scan
- Install without Go: `npm run install:cameradar` → `scripts/install-cameradar.sh`
- **Files:** `cameradar_engine.py`, `server/samples/cameradar_sample.json`

### 11. Live CCTV scan (WebSocket action)
- `scan_cctv_live` — fast CCTV-only scan (~90s timeout), no full OSINT
- Auto-detects machine LAN subnet via `os.networkInterfaces()`
- Broadcasts `cctv_scan_result` to all WS clients
- Updates camera registry for stream proxy
- **Files:** `scannerRelay.mjs` → `scanCctvLive()`

### 12. Live CCTV video in browser (not copy-link)
- `cctvStream.mjs` proxies RTSP → MJPEG via ffmpeg
- Endpoints: `GET /api/cctv/subnet`, `/api/cctv/cameras`, `/api/cctv/stream?id=N`
- UI `<img src="/api/cctv/stream?id=N">` for each discovered camera
- **Files:** `cctvStream.mjs`, `CctvLiveFeed` component

### 13. Auto re-scan CCTV on movement
- Geolocation watch — rescan after ~75m movement (debounced 2s)
- Toggle: "Re-scan CCTV when I move"
- Auto-scan when recon panel opens (if live scan enabled, demo off)
- **Files:** `BuildingScannerProduct.tsx` (`haversineM`, `watchPosition`)

### 14. Dev server integration (single `npm run dev`)
- Vite plugin co-hosts: planning middleware, CCTV middleware, scanner WebSocket relay
- No need for separate `npm run api` in dev (still available for production)
- **Files:** `vite.config.ts`, `backendPlugin()`

### 15. Target / demo data for planning
- Static targets (Arbor, Building 1, Ludgate) in `scanner/data.ts`
- Live planning target built from API results
- **Files:** `src/components/scanner/data.ts`

### 16. Recon / capture tooling (separate folder)
- `recon/` — GBFS audit script, disclosure templates, Hannover/London snap JSON captures
- Not wired into main app UI — research/audit artifacts
- **Files:** `recon/gbfs_audit.py`, `recon/CAPTURE.md`

### 17. User preference documentation
- `AGENTS.md` — no mock data, production-ready mindset, honest UX copy
- **Files:** `AGENTS.md`

---

## Issues faced & how they were fixed

### Issue 1: Heatmap / OSINT looked "fake" or random
**Symptom:** Random dots on map; recon showed made-up subdomains, employees, Shodan IPs.  
**Cause:** Fallback mock data in `osint_engine.py`; heatmap used `Math.random()` for offsets.  
**Fix:** Removed fake OSINT fallbacks; deterministic hash-based heatmap offsets; empty states + notes when no real data.  
**Still open:** Heatmap is still an estimate — user asked about Gaussian splatting / radiomap techniques as a future upgrade.

### Issue 2: API keys not loading — always mocked
**Symptom:** Shodan/Censys keys in `.env.local` ignored.  
**Cause:** Env file path pointed at `server/.env.local` instead of project root.  
**Fix:** Load `.env.local` from repo root in `scannerRelay.mjs`; restart dev after edits.

### Issue 3: Scan / Recon WebSocket connection failed
**Symptom:** "Scanner backend not responding"; WS to port 8787 refused in dev.  
**Cause:** Frontend expected separate API server; user only ran `npm run dev`.  
**Fix:** Integrated scanner relay into Vite via `backendPlugin()` — one `npm run dev` runs everything.

### Issue 4: `npm run dev` crashed with EADDRINUSE
**Symptom:** Port 5173 already in use; dev server dies.  
**Cause:** Stale/zombie Vite processes from prior sessions.  
**Fix:** Dev script kills 5173 before start; `strictPort: false` falls back to 5174+.

### Issue 5: WebSocket invalid frame errors + blank page
**Symptom:** Browser console WS frame errors; Vite HMR broken; white screen.  
**Cause:** Scanner WebSocket hijacked root path `/` — conflicted with Vite HMR WebSocket.  
**Fix:** Dedicated path `/ws/scanner` (`SCANNER_WS_PATH`); frontend `scannerWsUrl()` updated; relay uses `noServer` + path routing when co-hosted with Vite.

### Issue 6: WS attach timing crash
**Symptom:** EADDRINUSE / crash when attaching scanner relay too early.  
**Fix:** Defer `attachScannerRelay()` to Vite `configureServer` **post** hook (after HTTP server binds).

### Issue 7: Corporate Recon UI felt "dodgy" / Cameradar branding exposed
**Symptom:** Internal tool names visible; confusing UX.  
**Fix:** UI sanitizes notes ("CCTV scan" not "Cameradar"); demo checkbox removed from default flow; summary chips cleaned up.

### Issue 8: CCTV showed dummy cameras with "Copy stream" links
**Symptom:** 3 fake Hikvision/Dahua cameras; user thought it was live.  
**Cause:** "Include reference CCTV dataset" demo mode was on (`--use-sample` / sample JSON).  
**Fix:** Demo off by default (`VITE_CCTV_DEMO=1` to enable); live scan UI with embedded video; removed copy-link as primary UX.

### Issue 9: Cameradar install required Go
**Symptom:** User on macOS without Go couldn't install Cameradar.  
**Fix:** `scripts/install-cameradar.sh` downloads v6.1.1 prebuilt binary to `bin/cameradar`; `npm run install:cameradar`.

### Issue 10: Corporate Recon IP range placeholder bug
**Symptom:** Empty or wrong IP range sent to scanner.  
**Fix:** Auto-detect subnet from `guessLocalSubnet()`; placeholder "auto (your WiFi subnet)"; `"auto"` sent to backend when blank.

### Issue 11: CCTV discovery vs GPS confusion
**Symptom:** User expected cameras near map pin (Canary Wharf) while on public EE WiFi.  
**Reality:** RTSP scan runs on **machine's LAN**, not geolocation. Public WiFi → usually zero cameras.  
**Fix:** UI copy: "Scans your LAN, not GPS"; empty state explains need for building WiFi/VPN.

### Issue 12: Live video requires ffmpeg
**Symptom:** Streams fail without ffmpeg.  
**Fix:** `/api/cctv/subnet` returns `hasFfmpeg`; UI warns `brew install ffmpeg` when missing.

### Issue 13: Documentation out of date
**Symptom:** `SCANNER_SETUP.md`, `README.md`, `AGENTS.md` still describe old two-terminal setup, ws://8787 in dev, mock-first OSINT, "Recon" sparkles button.  
**Status:** NOT FIXED — next agent should update these docs to match current architecture.

### Issue 14: `npm run dev:full` still documented but redundant
**Symptom:** Confusion about whether to run api + dev separately.  
**Current truth:** `npm run dev` alone is enough in development. `dev:full` spawns duplicate backend on 8787.

### Issue 15: TypeScript / JSX errors during CCTV UI refactor
**Symptom:** Broken JSX fragments, unused imports after recon panel rewrite.  
**Fix:** Build passes (`npm run build` verified).

---

## Known limitations (not bugs — design constraints)

1. **WiFi heatmap** — No per-AP GPS; dots are signal-strength-weighted estimates at user location.
2. **CCTV scan scope** — Only discovers RTSP on the Mac's current network interface subnet, not "cameras near map coordinates."
3. **Public WiFi** — Client isolation → almost never finds building CCTV from coffee shop / mobile hotspot WiFi.
4. **Live streams** — Require camera reachable from Mac + open/default creds; many real cameras block external RTSP or need VPN.
5. **OSINT completeness** — Subdomains/employees need optional CLI tools (`subfinder`, `theHarvester`); Shodan/Censys have rate limits.
6. **Bluetooth** — Scanner supports it but WiFi is primary path on macOS dev setups.
7. **Windows** — Scapy/scanner largely untested on Windows.
8. **Demo CCTV sample** — Still exists at `server/samples/cameradar_sample.json` for offline demos only.
9. **Launch landing page** — Components exist but app entry is Building Scanner only.

---

## Suggested improvement order (for next agent)

Work through these **one at a time**, verifying with `npm run dev` + manual UI test after each:

| # | Area | Task |
|---|------|------|
| 1 | **Docs** | Rewrite `SCANNER_SETUP.md`, `README.md`, `AGENTS.md` to match single-port dev, `/ws/scanner`, live CCTV, no-mock policy |
| 2 | **CCTV streams** | Harden ffmpeg MJPEG proxy (error states, stream timeout, auth retry); test with real LAN camera |
| 3 | **CCTV UX** | Loading skeleton per feed; stream health indicator; retry button |
| 4 | **Heatmap** | Replace hash-offset dots with proper radiomap / Gaussian splatting or RSSI-decay circles |
| 5 | **OSINT** | Better empty states; surface which sources are live vs missing; cache results per company |
| 6 | **Corporate recon** | Faster pipeline; parallel OSINT + CCTV scan; progress events over WebSocket |
| 7 | **Scanner** | Linux sudo path; interface auto-detection; scan quality metrics |
| 8 | **Command bar** | Recon intent should trigger CCTV scan + optional full OSINT; better IP range extraction |
| 9 | **Production** | Single deploy story: `npm run build` + `npm run api` serves static + WS + CCTV |
| 10 | **Security/ethics** | Disclosure banners, consent copy, rate limiting on scan endpoints |
| 11 | **Tests** | Smoke tests for WS actions, cameradar JSON parsing, subnet detection |
| 12 | **Launch page** | Re-wire routing if both products needed (`/` landing, `/scanner` app) |

---

## Quick verification checklist

```bash
# 1. Build
npm run build

# 2. Subnet + ffmpeg
curl -s http://localhost:5173/api/cctv/subnet | python3 -m json.tool

# 3. Cameradar (sample — offline)
python3 server/cameradar_engine.py --use-sample --pretty

# 4. OSINT (needs keys in env)
python3 server/osint_engine.py --company "Test Corp" --address "London" --pretty

# 5. UI smoke test
# - Open app → map loads with geolocation
# - Click Scan → networks appear in panel + heatmap updates
# - Click CCTV → panel opens → Scan CCTV → wait ~90s → cameras or honest empty state
# - Type "corporate recon for Bankside" in command bar → OSINT panel populates
```

---

## User preferences (from AGENTS.md — respect these)

- **Real data only** — no mock/demo fallbacks unless explicitly opted in (e.g. `VITE_CCTV_DEMO=1`)
- **Production-ready** — setup should be keys + `npm run dev`, not manual wiring
- **Honest UX** — show limitations (LAN vs GPS, signal estimates, empty states)
- **Impactful copy** — not generic marketing fluff
- **Minimal scope per PR** — improve one feature at a time

---

*Last updated: 2026-06-06 — reflects state through live CCTV MJPEG integration and recon panel rewrite.*

# Building Scanner

**Google Maps shows the outside. The planning record shows the inside.**

A full-screen 3D map that turns a building into an intelligence surface — its
**public UK planning record**, the **live wireless devices** around you, the
**corporate OSINT** footprint of its tenants, and any **open CCTV** on the local
network — driven by a natural-language command bar.

> Scope: public planning records + passive, locally-captured signals only. No
> traffic interception, no exploitation, no defeating access controls. See
> [Scope & ethics](#scope--ethics).

## Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind + Mapbox GL
- **Backend (in-process during dev):** Node HTTP middleware + a `ws` WebSocket relay
- **Engines:** Python 3 (`scanner.py`, `osint_engine.py`, `corporate_recon.py`, `cameradar_engine.py`)
- **LLM:** OpenRouter (server-side proxy) for the command bar, with a keyword fallback

## Quick start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local        # then paste your real keys into .env.local
npm run setup:python              # once — creates .venv with bleak (live nearby-Bluetooth scan)
npm run install:cameradar         # once — downloads bin/cameradar (CCTV discovery)
brew install ffmpeg nmap          # ffmpeg = live CCTV video, nmap = RTSP scan
npm run dev                        # ONE command: Vite + planning API + scanner WS + CCTV streams
```

On macOS, grant your terminal **Bluetooth** and **Location** access (System Settings →
Privacy & Security) so the scanner can see nearby BLE devices and Wi-Fi networks.

Open **http://localhost:5173**.

A single `npm run dev` co-hosts the whole backend in-process via a Vite plugin —
there is no second terminal and no separate API port in development.

### Environment (`.env.local` at the project root)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_MAPBOX_TOKEN` | **yes** | 3D map + address geocoding (public token; URL-restrict it for prod) |
| `OPENROUTER_API_KEY` | optional | Natural-language command bar (server-side only — never shipped to the browser) |
| `OPENROUTER_MODEL` | optional | Defaults to `anthropic/claude-sonnet-4.6` |
| `SHODAN_API_KEY` | optional | Real exposed-infrastructure OSINT |
| `CENSYS_API_TOKEN` | optional | Real exposed-infrastructure OSINT (Personal Access Token) |
| `CCTV_IP_RANGE` | optional | Default LAN range for CCTV discovery (blank = auto-detect subnet) |

Missing an optional key never injects fake data — that source is simply skipped
with an honest note in the UI. See [`.env.example`](.env.example).

## What it does

| Feature | How |
|---------|-----|
| **3D building map** | Dark Mapbox buildings, geolocation dot, fly-to on load |
| **Live WiFi / Bluetooth scan** | Real SSIDs + RSSI and a live BLE scan of devices **around you** (not paired history), streamed over `ws://…/ws/scanner` |
| **Signal heatmap** | Deterministic RSSI-weighted estimates at your location (no fake per-AP GPS) |
| **UK planning lookup** | Geocode → PlanIt aggregator → Idox document parsing → evidence panel |
| **Command bar (NL)** | LLM routes `navigate` / `investigate` / `recon`; keyword fallback offline |
| **Corporate OSINT** | Subdomains, employees, Shodan/Censys exposure, tech stack — real data only |
| **Device correlation** | Matches live wireless devices to OSINT employees with confidence |
| **Live CCTV** | RTSP discovery (Cameradar) → in-browser MJPEG via ffmpeg, with retry/health UI |

## Scripts

```bash
npm run dev       # dev: Vite + co-hosted backend (one port, one command)
npm run build     # type-check + production build to dist/
npm run preview   # preview the production build (backend co-hosted)
npm run lint      # ESLint 9 (flat config)
npm run api       # standalone Node API + WebSocket on :8787 (production backend)
```

## Architecture

```
Browser (BuildingScannerProduct.tsx)
  ├─ Mapbox 3D map + WiFi/Bluetooth heatmap + geolocation
  ├─ Command bar → POST /api/agent/interpret  (server holds the LLM key)
  ├─ WebSocket ws://…/ws/scanner  ← server/scannerRelay.mjs
  │     ├─ start_scan          → server/scanner.py        (live WiFi/BT)
  │     ├─ run_corporate_recon → osint_engine.py → corporate_recon.py
  │     └─ scan_cctv_live      → cameradar_engine.py
  ├─ GET /api/planning/*  ← server/planning.mjs   (UK planning proxy)
  └─ GET /api/cctv/*      ← server/cctvStream.mjs (subnet detect + RTSP→MJPEG)
```

In dev, every `/api/*` route and the WebSocket are mounted inside Vite by
`backendPlugin()` in `vite.config.ts`. The same middleware runs standalone on
:8787 via `npm run api` (`server/index.mjs`) for production.

See [`SCANNER_SETUP.md`](SCANNER_SETUP.md) for the scanner/OSINT/CCTV details and
[`PROJECT_HANDOFF.md`](PROJECT_HANDOFF.md) for the full feature/issue history.

## Honest limitations

- **Heatmap** is an RSSI-weighted estimate at *your* location — wireless scans
  carry no per-access-point GPS.
- **CCTV** discovers RTSP cameras on *your machine's current LAN*, not cameras
  near the map pin. On public/guest WiFi (client isolation) you'll usually find none.
- **OSINT depth** improves with optional CLIs (`subfinder`, `theHarvester`);
  Shodan/Censys free tiers are rate-limited.

## Scope & ethics

Building Scanner surfaces **public planning records** and **passive, locally
captured** wireless/RTSP signals. It does not intercept traffic, exploit devices,
brute-force credentials, or defeat any access control. Disclosure templates live
in [`recon/DISCLOSURE_TEMPLATE.md`](recon/DISCLOSURE_TEMPLATE.md).

---

*The dormant marketing landing-page components (`Hero`, `FeaturesGrid`, …) still
live under `src/components/` but are not mounted — `App.tsx` renders the Building
Scanner only.*

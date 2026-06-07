# Scanner, OSINT & CCTV — setup

Real-time wireless scanning, corporate OSINT, and local CCTV discovery, wired
into the Mapbox map. **Everything runs from a single `npm run dev`.**

## Prerequisites

```bash
python3 --version          # 3.9+  (macOS ships it)
npm run setup:python       # creates .venv and installs bleak (live BLE scanning)
brew install ffmpeg nmap   # ffmpeg = live CCTV video, nmap = RTSP discovery
npm run install:cameradar  # downloads bin/cameradar (no Go toolchain needed)
```

- **macOS:** WiFi scanning shells out to `system_profiler` (no root). Live
  **nearby Bluetooth** uses an active BLE advertisement scan via `bleak`
  (CoreBluetooth) — it reports devices physically **around you** with real RSSI,
  not devices paired to your Mac. Grant your terminal **Bluetooth** and
  **Location** access (System Settings → Privacy & Security) or it sees nothing.
- **Linux:** passive WiFi capture uses scapy and needs root + a monitor-mode
  interface (`pip install scapy`, run with `sudo`); BLE uses `bleak`.
- The relay auto-uses `.venv/bin/python3` when present (override with
  `SCANNER_PYTHON`), so `npm run dev` picks up bleak automatically.

## Running

### Development — one command

```bash
npm run dev
```

- App + API + WebSocket all on **http://localhost:5173** (Vite co-hosts the
  backend in-process; if 5173 is taken it falls back to 5174+).
- Click **Scan** to start live WiFi/Bluetooth. Click **CCTV** for the recon panel.

There is **no** separate `npm run api` and **no** second port in development.

### Production — standalone backend

```bash
npm run build     # build the frontend to dist/
npm run api       # Node HTTP + WebSocket on :8787 (serves dist/ when present)
```

Open **http://localhost:8787**. Override the port with `PLANNING_PORT=9000 npm run api`.

## How it works

1. **Python scanner** (`server/scanner.py`)
   - WiFi (macOS): parses `system_profiler SPAirPortDataType` (no root).
   - WiFi (Linux): passive 802.11 beacon/probe capture via scapy (root).
   - Bluetooth: live BLE advertisement scan via `bleak` → nearby devices with
     real RSSI and vendor labels. Falls back to `system_profiler` (paired-only,
     clearly labelled) when bleak isn't installed.
   - Emits a JSON line per scan cycle (~5–10s) to stdout.

2. **WebSocket relay** (`server/scannerRelay.mjs`, path `/ws/scanner`)
   - Spawns/kills the Python scanner on `start_scan` / `stop_scan`.
   - Also routes `run_corporate_recon` and `scan_cctv_live` actions.
   - Mounted inside Vite in dev; attached to the standalone server in prod.

3. **Mapbox heatmap**
   - A GeoJSON source updates each scan tick.
   - Points are placed at **your GPS location** with a *deterministic* per-MAC
     offset weighted by signal strength — **not** random, and **not** real
     per-network GPS (wireless scans don't carry coordinates). The UI says so.

## Device output format

```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "ssid": "Network Name or Hidden Network",
  "rssi": -65,
  "signal_strength": 70,
  "radio": "wifi",
  "timestamp": "2026-06-06T12:34:56.789Z"
}
```

## Troubleshooting

**"Scanner backend not responding"**
- Make sure `npm run dev` is running; the WebSocket is `ws://<host>/ws/scanner`
  (same origin in dev). Restart `npm run dev` if you edited a `server/*.mjs` file —
  backend modules don't hot-reload.

**No WiFi networks on macOS**
- Grant your terminal **Location Services** access (System Settings → Privacy &
  Security → Location). macOS hides nearby Wi-Fi info without it.

**Linux: "Scanner requires root privileges"**
- Run with `sudo`, and ensure a monitor-mode interface exists.

**No CCTV cameras found**
- The scan runs on **your machine's current LAN**, not the map pin. On public /
  guest WiFi (client isolation) you'll usually find nothing — connect to the
  building network or a VPN. Install `ffmpeg` for in-browser video.

---

## Corporate Recon — OSINT + live device correlation

Trigger it from the **CCTV/recon panel** (the **OSINT** button) or the command
bar (`corporate recon for Bankside Yards`, `who works here right now`,
`osint Acme Corp`). Two phases run:

1. **OSINT discovery** (`server/osint_engine.py`)
   - Subdomains (`subfinder` if installed)
   - Employee names + emails (`theHarvester` if installed)
   - Exposed infrastructure (Shodan + Censys when keys are set)
   - Tech stack (homepage signature scan / `wappalyzer` if installed)

2. **Live correlation** (`server/corporate_recon.py`)
   - Matches the live wireless devices on the map against the OSINT data and
     produces `probable_owner`, confidence, and reasoning per device.

The panel shows employees likely present, subdomains, tech stack, exposed
infrastructure, correlated devices, and any live CCTV streams.

### Real data only

This engine **never injects mock or demo data**. When a key or CLI tool is
missing, that source returns an empty result with a note explaining why
(e.g. *"No Shodan or Censys credentials configured — exposed-infrastructure scan
skipped"*). The only opt-in simulated source is the offline CCTV reference
dataset, enabled explicitly with `CCTV_DEMO=1`.

### Keys (all optional, server-side)

Put these in `.env.local` at the project root (loaded by the Node backend,
never shipped to the browser):

```env
SHODAN_API_KEY=your_shodan_api_key
CENSYS_API_TOKEN=your_censys_personal_access_token   # modern Bearer token
# legacy only:
# CENSYS_API_ID=...
# CENSYS_API_SECRET=...
```

Restart `npm run dev` after editing `.env.local` so the backend reloads the env.

### Test it from the CLI

```bash
# Real OSINT (uses whatever keys/tools are present; honest empty state otherwise)
python3 server/osint_engine.py --company "Acme Corp" --address "Bankside Yards, London" --pretty

# CCTV discovery against a subnet (or --use-sample for the offline dataset)
python3 server/cameradar_engine.py --ip-range 192.168.1.0/24 --pretty
```

### Temp files

During a recon run the relay writes `server/.tmp_osint.json` and
`server/.tmp_devices.json`, then deletes them immediately. Harmless.

## Scope

Passive, local, public-records only. Beacon frames are broadcast by devices;
RTSP discovery only lists cameras reachable on your own network. No traffic
interception, no exploitation, no credential attacks.

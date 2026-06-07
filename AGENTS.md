## Learned User Preferences

- Insist on real data only — no mock, demo, or fallback OSINT or heatmap data in the Building Scanner
- Wants implementations production-ready so setup is limited to API keys and running services
- Prefer catchy, easy-to-understand, impactful marketing copy over boring or generic headlines
- Reject fake or randomized visualizations; show honest limitations (e.g., signal-strength estimates, not fake GPS per network)
- Built to a high (2026) standard: secrets server-side, current model IDs, lint/build green

## Learned Workspace Facts

- Repo hosts two routed products: **German Shepherd** insurer landing at `/` (`GermanShepherdLanding.tsx`) and **Building Scanner** at `/app` (lazy-loaded; not linked from public nav). Old Launch/Spectre landing components were removed.
- Stack: React 19 / Vite 6 / TypeScript frontend; Node HTTP middleware + `ws` relay backend; Python 3 engines (`scanner.py`, `osint_engine.py`, `corporate_recon.py`, `cameradar_engine.py`, `cctvStream.mjs`).
- **One command runs everything in dev: `npm run dev`.** Vite's `backendPlugin()` co-hosts planning API, CCTV RTSP→MJPEG proxy (`/api/cctv/stream`), agent (LLM) proxy, and scanner WebSocket. No `dev:full` and no separate dev API port.
- `npm run api` (`server/index.mjs`) is the standalone production backend on :8787 and also serves `dist/` when built.
- Scanner WebSocket is at path `/ws/scanner` (same origin in dev; `ws://localhost:8787/ws/scanner` for standalone) — kept off `/` so it never clashes with Vite HMR.
- `.env.local` lives at the **project root** (not `server/`) and is loaded by the Node backend (`loadProjectEnv` in `scannerRelay.mjs`).
- **The OpenRouter LLM key is server-side only** (`OPENROUTER_API_KEY`, no `VITE_` prefix). The browser calls `/api/agent/interpret`; the key is never bundled. Default model `anthropic/claude-sonnet-4.6`.
- OSINT is **real-data-only**: missing keys/tools → empty result + honest note, never mock data. Opt-in offline CCTV dataset: `CCTV_DEMO=1` / `VITE_CCTV_DEMO=1`. Shodan works on free tier; Censys Platform needs `CENSYS_ORG_ID` + paid plan (free tokens are UI-only). Censys auth uses `CENSYS_API_TOKEN` (Bearer); legacy `CENSYS_API_ID`/`CENSYS_API_SECRET` optional.
- Richer subdomain/employee OSINT needs optional CLIs: `subfinder`, `theHarvester`. CCTV needs `bin/cameradar` (via `npm run install:cameradar`), `nmap`, and `ffmpeg`.
- **Bluetooth tracker mirrors WiFi:** one Scan button; `bluetooth_scan_update` WS events; orange WiFi / purple BT heatmaps; devices merged for corporate recon. **Live nearby BLE** via `bleak` (CoreBluetooth) in `.venv` — NOT paired-device cache. `system_profiler` is a labelled fallback only. Run `npm run setup:python`; relay auto-prefers `.venv/bin/python3` (override `SCANNER_PYTHON`). Needs macOS Bluetooth + Location permission.
- **Gotcha:** the scanner streams JSON-per-line on stdout; large Bluetooth payloads (80+ devices) span multiple stdout chunks, so any consumer MUST line-buffer (accumulate, split on `\n`, keep the partial). Parsing per-chunk silently drops big updates.
- WiFi/BT heatmap places devices around the user by deterministic bearing + RSSI→distance estimate (log-distance path-loss). Honest estimate; no per-device GPS. CCTV scans the Mac's LAN subnet, not map GPS. Recon panel shows per-source provenance chips (live vs skipped).
- **`PROJECT_HANDOFF.md`** is the canonical onboarding doc (features built, issues hit, improvement order). Use `npm install --legacy-peer-deps`; lint is ESLint 9 flat config (`eslint.config.js`); `npm run lint`, `npm run build`, and `npx tsc -b` are all green.

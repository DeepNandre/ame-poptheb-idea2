// WebSocket scanner + Corporate Recon relay — shared by standalone API and Vite dev server.
import { WebSocketServer } from "ws";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { setCameraRegistry, guessLocalSubnet } from "./cctvStream.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.join(__dirname, "..");

// Prefer the project virtualenv (has bleak for live BLE scanning) when present,
// honour an explicit override, else fall back to system python3.
function resolvePython() {
  if (process.env.SCANNER_PYTHON) return process.env.SCANNER_PYTHON;
  const venvPy = path.join(PROJECT_ROOT, ".venv", "bin", "python3");
  try {
    if (fs.existsSync(venvPy)) return venvPy;
  } catch {
    // ignore
  }
  return "python3";
}
const PYTHON = resolvePython();

export function loadProjectEnv() {
  function loadEnvFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq === -1) return;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
          process.env[key] = val;
        }
      });
    } catch {
      // missing file is fine
    }
  }
  loadEnvFile(path.join(PROJECT_ROOT, ".env"));
  loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  // The Python backend keeps its own env (GOOGLE_MAPS_API_KEY for the Places
  // website resolver, etc.). Load it too so the spawned osint_engine can resolve
  // a building's website from its name+address. Root .env wins (loaded first).
  loadEnvFile(path.join(PROJECT_ROOT, "backend", ".env"));
}

loadProjectEnv();

let scannerProcess = null;
let wss = null;
let latestDevices = [];
let latestBluetoothDevices = [];
// Cooldown so rapid re-clicks can't burn the limited Shodan/Censys quota.
let lastReconStart = 0;
const RECON_COOLDOWN_MS = 15000;

// CCTV scan coalescing — the live scan is auto-triggered (panel open + movement)
// and manually, so guard against overlapping/rapid cameradar+nmap LAN scans.
let cctvScanning = false;
let lastCctvResult = null;
let lastCctvScanAt = 0;
const CCTV_COOLDOWN_MS = 20000;
/** Dedicated path so we never steal Vite HMR WebSocket upgrades on the same port. */
export const SCANNER_WS_PATH = "/ws/scanner";

function broadcast(json) {
  if (!wss) return;
  const payload = JSON.stringify(json);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

function startScanner(ws) {
  if (scannerProcess) {
    ws.send(JSON.stringify({ type: "error", message: "Scanner already running" }));
    return;
  }

  console.log("[scanner] Starting Bluetooth/WiFi scanner…");

  scannerProcess = spawn(PYTHON, [path.join(__dirname, "scanner.py")], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  // Line-buffer stdout: a single JSON line (e.g. a large Bluetooth update) can be
  // split across 'data' chunks, so we must not parse per-chunk or we'd silently
  // drop big payloads. Accumulate and only parse complete newline-terminated lines.
  let stdoutBuffer = "";
  scannerProcess.stdout.on("data", (data) => {
    stdoutBuffer += data.toString();
    let nl;
    while ((nl = stdoutBuffer.indexOf("\n")) !== -1) {
      const line = stdoutBuffer.slice(0, nl).trim();
      stdoutBuffer = stdoutBuffer.slice(nl + 1);
      if (!line) continue;
      try {
        const json = JSON.parse(line);
        if (json.type === "scan_update" && Array.isArray(json.devices)) {
          latestDevices = json.devices;
        }
        if (json.type === "bluetooth_scan_update" && Array.isArray(json.devices)) {
          latestBluetoothDevices = json.devices;
        }
        broadcast(json);
      } catch {
        // ignore non-JSON lines (partial lines are handled by buffering)
      }
    }
  });

  scannerProcess.stderr.on("data", (data) => {
    const raw = data.toString().trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === "error") {
        console.error("[scanner] Fatal:", parsed.message);
        if (scannerProcess) {
          scannerProcess.kill();
          scannerProcess = null;
        }
        broadcast({ type: "error", message: parsed.message });
      } else {
        console.log("[scanner]", raw);
      }
    } catch {
      console.log("[scanner]", raw);
    }
  });

  scannerProcess.on("exit", (code) => {
    console.log(`[scanner] Exited with code ${code}`);
    scannerProcess = null;
  });

  ws.send(JSON.stringify({ type: "scanner_start", message: "Scanner started" }));
}

function stopScanner() {
  if (!scannerProcess) return;
  console.log("[scanner] Stopping…");
  scannerProcess.kill();
  scannerProcess = null;
  latestDevices = [];
  latestBluetoothDevices = [];
  broadcast({ type: "scanner_stop", message: "Scanner stopped" });
}

function runCorporateRecon(ws, company, address = "", ipRange = "", useCctvSample = false) {
  const now = Date.now();
  const sinceLast = now - lastReconStart;
  if (sinceLast < RECON_COOLDOWN_MS) {
    const wait = Math.ceil((RECON_COOLDOWN_MS - sinceLast) / 1000);
    ws.send(
      JSON.stringify({
        type: "error",
        message: `Recon is rate-limited — wait ${wait}s (protects your Shodan/Censys quota)`,
      }),
    );
    return;
  }
  lastReconStart = now;

  console.log(`[recon] company="${company}" address="${address || ""}" ipRange="${ipRange || ""}"`);
  const hasShodan = !!process.env.SHODAN_API_KEY;
  const hasCensys =
    !!process.env.CENSYS_API_TOKEN ||
    (!!process.env.CENSYS_API_ID && !!process.env.CENSYS_API_SECRET);
  console.log(`[recon] Keys — Shodan: ${hasShodan}, Censys: ${hasCensys}`);

  const osintArgs = [
    path.join(__dirname, "osint_engine.py"),
    "--company",
    company,
    "--address",
    address || company,
  ];
  // CCTV is handled by the dedicated scan_cctv_live flow — we deliberately do NOT
  // pass an --ip-range here, so OSINT does not spawn a second, concurrent Cameradar
  // scan of the same LAN. Demo sample mode is still allowed (it's instant, no scan).
  if (useCctvSample || process.env.CAMERADAR_USE_SAMPLE === "1" || process.env.CCTV_DEMO === "1") {
    osintArgs.push("--use-cctv-sample");
  }

  broadcast({
    type: "recon_progress",
    stage: "osint",
    message: `Profiling ${company} — subdomains, employees, exposed infrastructure & tech stack…`,
  });

  const osint = spawn(PYTHON, osintArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  let osintStdout = "";
  osint.stdout.on("data", (d) => {
    osintStdout += d.toString();
  });
  osint.stderr.on("data", (d) => console.log("[osint]", d.toString().trim()));

  osint.on("close", (code) => {
    if (code !== 0) {
      ws.send(JSON.stringify({ type: "error", message: "OSINT engine failed" }));
      return;
    }

    let osintJson;
    try {
      const lines = osintStdout.trim().split("\n");
      osintJson = JSON.parse(lines[lines.length - 1]);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Failed to parse OSINT output" }));
      return;
    }

    const osintPath = path.join(__dirname, ".tmp_osint.json");
    const devPath = path.join(__dirname, ".tmp_devices.json");
    try {
      fs.writeFileSync(osintPath, JSON.stringify(osintJson));
      fs.writeFileSync(devPath, JSON.stringify([...latestDevices, ...latestBluetoothDevices]));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Failed to prepare recon temp files" }));
      return;
    }

    broadcast({
      type: "recon_progress",
      stage: "correlate",
      message: "Correlating live wireless devices with the OSINT footprint…",
    });

    const recon = spawn(
      PYTHON,
      [
        path.join(__dirname, "corporate_recon.py"),
        "--osint-json",
        osintPath,
        "--devices-json",
        devPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"], env: process.env },
    );

    let reconOut = "";
    recon.stdout.on("data", (d) => {
      reconOut += d.toString();
    });
    recon.stderr.on("data", (d) => console.log("[recon]", d.toString().trim()));

    recon.on("close", (c) => {
      try {
        fs.unlinkSync(osintPath);
      } catch {}
      try {
        fs.unlinkSync(devPath);
      } catch {}

      if (c !== 0) {
        ws.send(JSON.stringify({ type: "error", message: "Correlation engine failed" }));
        return;
      }
      try {
        const payload = JSON.parse(reconOut.trim().split("\n").pop() || "{}");
        const cams = payload.osint_context?.cctv_cameras || [];
        if (cams.length) setCameraRegistry(cams);
        broadcast({ type: "corporate_recon_result", payload });
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Failed to parse recon result" }));
      }
    });
  });
}

function scanCctvLive(ws, ipRange = "auto", useSample = false) {
  const now = Date.now();

  // Coalesce: if a scan is already running, or one finished very recently, return
  // the latest result instead of launching another LAN scan. Always reply so the
  // UI clears its "scanning…" state.
  if (cctvScanning || (!useSample && lastCctvResult && now - lastCctvScanAt < CCTV_COOLDOWN_MS)) {
    const note = cctvScanning
      ? "CCTV scan already in progress…"
      : "Showing the most recent scan (rate-limited)";
    ws.send(
      JSON.stringify(
        lastCctvResult
          ? { ...lastCctvResult, notes: [note, ...(lastCctvResult.notes || [])].slice(0, 3) }
          : { type: "cctv_scan_result", cameras: [], subnet: null, notes: [note] },
      ),
    );
    return;
  }

  const local = guessLocalSubnet();
  const target = (
    !ipRange || ipRange === "auto" ? local?.subnet || "" : ipRange
  ).trim();

  console.log(`[cctv] Live scan subnet="${target || "sample"}" demo=${useSample}`);

  if (!target && !useSample) {
    ws.send(
      JSON.stringify({
        type: "cctv_scan_result",
        cameras: [],
        subnet: null,
        address: local?.address ?? null,
        notes: ["Connect to the building WiFi/LAN to discover local RTSP cameras"],
      }),
    );
    return;
  }

  const args = [path.join(__dirname, "cameradar_engine.py")];
  if (useSample) {
    args.push("--use-sample");
  } else {
    args.push("--ip-range", target, "--timeout", "90");
  }

  cctvScanning = true;
  lastCctvScanAt = now;

  const proc = spawn(PYTHON, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  let out = "";
  proc.stdout.on("data", (d) => {
    out += d.toString();
  });
  proc.stderr.on("data", (d) => console.log("[cctv]", d.toString().trim()));

  proc.on("error", (e) => {
    cctvScanning = false;
    ws.send(JSON.stringify({ type: "error", message: `CCTV scan could not start: ${e.message}` }));
  });

  proc.on("close", () => {
    cctvScanning = false;
    try {
      const parsed = JSON.parse(out.trim());
      const cameras = parsed.cctv?.cameras || [];
      if (cameras.length) setCameraRegistry(cameras);
      const result = {
        type: "cctv_scan_result",
        cameras,
        subnet: parsed.cctv?.building_ip_range || target,
        address: local?.address ?? null,
        notes: parsed.notes || [],
        scanned_at: parsed.cctv?.scanned_at,
      };
      lastCctvResult = result;
      broadcast(result);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "CCTV scan failed to parse" }));
    }
  });
}

function bindConnectionHandlers() {
  wss.on("error", (err) => {
    console.error("[scanner] WebSocket server error:", err.message);
  });

  wss.on("connection", (ws) => {
    console.log("[scanner] WebSocket client connected");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.action === "start_scan") startScanner(ws);
        else if (msg.action === "stop_scan") stopScanner();
        else if (msg.action === "run_corporate_recon") {
          runCorporateRecon(
            ws,
            msg.company || msg.place || "Bankside Yards",
            msg.address,
            msg.ip_range || msg.ipRange || "",
            Boolean(msg.use_cctv_sample || msg.useCctvSample),
          );
        } else if (msg.action === "scan_cctv_live") {
          scanCctvLive(
            ws,
            msg.ip_range || msg.ipRange || "auto",
            Boolean(msg.use_cctv_sample || msg.useCctvSample),
          );
        }
      } catch (err) {
        console.error("[scanner] Message parse error:", err);
      }
    });

    ws.on("close", () => {
      if (wss.clients.size === 0) stopScanner();
    });

    ws.on("error", (err) => console.error("[scanner] WebSocket error:", err));
  });
}

/**
 * Attach scanner WebSocket relay to an HTTP server.
 * @param {import('node:http').Server} httpServer
 * @param {{ shareWithVite?: boolean }} [options] — shareWithVite: route only SCANNER_WS_PATH (required when co-hosted with Vite HMR)
 */
export function attachScannerRelay(httpServer, options = {}) {
  if (wss) return wss;

  const shareWithVite = options.shareWithVite ?? false;

  if (shareWithVite) {
    // Must NOT use { server: httpServer } — that hijacks Vite's HMR WebSocket and breaks the app.
    wss = new WebSocketServer({ noServer: true });
    bindConnectionHandlers();

    httpServer.on("upgrade", (request, socket, head) => {
      const pathname = request.url?.split("?")[0];
      if (pathname !== SCANNER_WS_PATH) return;
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });
  } else {
    wss = new WebSocketServer({ server: httpServer, path: SCANNER_WS_PATH });
    bindConnectionHandlers();
  }

  return wss;
}

export function logOsintKeyStatus() {
  const hasShodan = !!process.env.SHODAN_API_KEY;
  const hasCensysToken = !!process.env.CENSYS_API_TOKEN;
  const hasCensysLegacy = !!(process.env.CENSYS_API_ID && process.env.CENSYS_API_SECRET);
  console.log(
    `OSINT keys loaded from ${PROJECT_ROOT} — Shodan: ${hasShodan ? "YES" : "NO"}, Censys Token: ${hasCensysToken ? "YES" : "NO"}, Censys Legacy: ${hasCensysLegacy ? "YES" : "NO"}`,
  );
}

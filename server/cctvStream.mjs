// Live RTSP → MJPEG proxy for in-browser CCTV preview + local subnet detection.
import { spawn } from "node:child_process";
import os from "node:os";
import { execSync } from "node:child_process";

/** Latest cameras from the most recent live scan (indexed for /api/cctv/stream?id=N). */
let cameraRegistry = [];

export function setCameraRegistry(cameras) {
  cameraRegistry = Array.isArray(cameras) ? cameras : [];
}

export function getCameraRegistry() {
  return cameraRegistry;
}

export function guessLocalSubnet() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const cfg of entries || []) {
      if (cfg.family !== "IPv4" || cfg.internal) continue;
      const parts = cfg.address.split(".");
      if (parts.length !== 4) continue;
      return {
        subnet: `${parts[0]}.${parts[1]}.${parts[2]}.0/24`,
        address: cfg.address,
        interface: cfg.address,
      };
    }
  }
  return null;
}

function findFfmpeg() {
  try {
    execSync("which ffmpeg", { stdio: "ignore" });
    return "ffmpeg";
  } catch {
    return null;
  }
}

const activeStreams = new Map();

function pipeMjpeg(rtspUrl, req, res) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain");
    return res.end("ffmpeg not installed — brew install ffmpeg");
  }

  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    "Cache-Control": "no-cache, no-store",
    Connection: "close",
    Pragma: "no-cache",
  });

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    // Fail fast on unreachable / blocked cameras (8s socket timeout, µs) so the
    // browser shows the retry state instead of hanging on an open connection.
    "-rw_timeout",
    "8000000",
    "-i",
    rtspUrl,
    "-an",
    "-f",
    "mpjpeg",
    "-q:v",
    "8",
    "-r",
    "8",
    "pipe:1",
  ];

  const proc = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
  const streamId = `${Date.now()}-${Math.random()}`;
  activeStreams.set(streamId, proc);

  proc.stdout.pipe(res, { end: true });
  proc.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log("[cctv-stream]", msg.slice(0, 120));
  });

  const cleanup = () => {
    activeStreams.delete(streamId);
    try {
      proc.kill("SIGTERM");
    } catch {}
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
  proc.on("exit", cleanup);
}

export function cctvStreamMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/cctv/subnet") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const info = guessLocalSubnet();
    return res.end(
      JSON.stringify({
        subnet: info?.subnet ?? null,
        address: info?.address ?? null,
        hasFfmpeg: !!findFfmpeg(),
        cameraCount: cameraRegistry.length,
      }),
    );
  }

  if (url.pathname === "/api/cctv/cameras") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.end(JSON.stringify({ cameras: cameraRegistry }));
  }

  if (url.pathname === "/api/cctv/stream") {
    const id = Number(url.searchParams.get("id"));
    const cam = cameraRegistry[id];
    if (!cam?.rtsp_url) {
      res.statusCode = 404;
      return res.end("Camera not found or no stream URL");
    }
    return pipeMjpeg(cam.rtsp_url, req, res);
  }

  return next();
}

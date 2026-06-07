// Minimal static-file middleware for the production build (dist/).
// Serves built assets and falls back to index.html for client-side routes, so
// `npm run build && npm run api` ships the whole app, API, and WebSocket on one
// port. No-op in dev (Vite serves the frontend) and when dist/ doesn't exist.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

export function hasStaticBuild() {
  return fs.existsSync(path.join(DIST, "index.html"));
}

export function staticMiddleware(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (!hasStaticBuild()) return next();

  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  // Resolve within DIST and reject path traversal.
  let filePath = path.normalize(path.join(DIST, pathname));
  if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }

  let stat = null;
  try {
    stat = fs.statSync(filePath);
  } catch {
    stat = null;
  }
  if (stat?.isDirectory()) {
    filePath = path.join(filePath, "index.html");
    stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  }

  if (!stat) {
    // A missing real asset (has an extension) is a genuine 404 — let it fall
    // through. An extensionless route is a client-side path → serve index.html.
    if (path.extname(pathname)) return next();
    filePath = path.join(DIST, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  if (filePath.endsWith("index.html")) {
    res.setHeader("Cache-Control", "no-cache");
  } else if (pathname.startsWith("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }

  try {
    const data = fs.readFileSync(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Content-Length", data.length);
    if (req.method === "HEAD") return res.end();
    return res.end(data);
  } catch {
    return next();
  }
}

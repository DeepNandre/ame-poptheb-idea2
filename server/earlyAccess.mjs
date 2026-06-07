// Demo-request / lead capture.
//
// Appends each submission as one JSON line to data/demo-requests.jsonl. The file
// is gitignored — it holds visitor PII, so it never gets committed.
//
//   POST /api/demo           { name, email, company? }  -> { ok: true }
//   POST /api/early-access    { email, name? }           -> { ok: true }   (legacy alias)
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "demo-requests.jsonl");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROUTES = new Set(["/api/demo", "/api/early-access"]);

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 8192) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        data = data.slice(0, limit);
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function earlyAccessMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (!ROUTES.has(url.pathname)) return next();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return json(res, 405, { error: "Use POST" });

  let body;
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    return json(res, 400, { error: "Invalid JSON body" });
  }

  const email = str(body.email, 320);
  const name = str(body.name, 200);
  const company = str(body.company, 200);
  if (!EMAIL_RE.test(email)) return json(res, 400, { error: "Invalid email" });

  const record = {
    name,
    email,
    company,
    source: url.pathname === "/api/demo" ? "book-a-demo" : "early-access",
    ts: new Date().toISOString(),
    ua: (req.headers["user-agent"] || "").slice(0, 300),
    ip:
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "",
  };

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(record) + "\n");
  } catch (err) {
    console.error("[demo] failed to persist:", err);
    return json(res, 500, { error: "Could not save submission" });
  }

  console.log(
    `[demo] new request: ${email}${name ? ` (${name})` : ""}${company ? ` @ ${company}` : ""}`,
  );
  return json(res, 200, { ok: true });
}

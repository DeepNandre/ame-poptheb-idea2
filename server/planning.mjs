// Building Scanner — planning proxy (server-side).
//
// Two endpoints, same-origin to the app so the browser never hits a CORS wall:
//   GET /api/planning/search?q=...&lat=...&lng=...
//        -> live UK application search via the open PlanIt API (planit.org.uk).
//   GET /api/planning/documents?url=<council application url>
//        -> the document/drawing list, parsed from the council's Idox
//           "documents" tab. Graceful fallback when a portal isn't parseable.
//
// PlanIt is an open aggregator (Andrew Speakman) covering ~420 UK authorities.
// We reuse it for search instead of scraping. Document files still live on the
// council portal, so the documents endpoint fetches + parses that page.
//
// Scope: PUBLIC planning-permission documents only — the same boundary the rest
// of the product holds. Nothing here defeats an access control.

import https from "node:https";
import http from "node:http";
import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const PLANIT = "https://www.planit.org.uk/api/applics/json";

/* ----------------------------- connect middleware ----------------------------- */

export async function planningMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/planning/")) return next();

  // CORS (harmless same-origin; lets a separately-deployed API work too)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (url.pathname.endsWith("/search")) {
      const out = await handleSearch(url.searchParams);
      return json(res, 200, out);
    }
    if (url.pathname.endsWith("/documents")) {
      const out = await handleDocuments(url.searchParams);
      return json(res, 200, out);
    }
    return json(res, 404, { error: "Unknown planning endpoint" });
  } catch (err) {
    return json(res, 502, { error: String(err?.message || err) });
  }
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

/* --------------------------------- search --------------------------------- */

async function handleSearch(params) {
  const q = (params.get("q") || "").trim();
  const lat = num(params.get("lat"));
  const lng = num(params.get("lng"));

  // 1) text + (optional) radius around the geocoded point
  let records = await planitQuery({ search: q, lat, lng, krad: 0.5, pg_sz: 8 });
  // 2) fall back to "what's been applied for near here" if text matched nothing
  if (records.length === 0 && lat != null && lng != null) {
    records = await planitQuery({ lat, lng, krad: 0.4, pg_sz: 8 });
  }
  // 3) last resort: pure text search, nationwide
  if (records.length === 0 && q) {
    records = await planitQuery({ search: q, pg_sz: 8 });
  }

  return { query: q, apps: records.map(normalizeApp).filter((a) => a.url) };
}

// Reusable by the building-intelligence aggregator: "what's been applied for at
// or around this point", normalized. Same PlanIt source the search endpoint uses.
export async function searchPlanItApps({ q = "", lat = null, lng = null, pg_sz = 10 } = {}) {
  let records = [];
  if (lat != null && lng != null) {
    records = await planitQuery({ search: q || undefined, lat, lng, krad: 0.2, pg_sz });
    if (records.length === 0) records = await planitQuery({ lat, lng, krad: 0.3, pg_sz });
  } else if (q) {
    records = await planitQuery({ search: q, pg_sz });
  }
  return records.map(normalizeApp).filter((a) => a.url);
}

async function planitQuery({ search, lat, lng, krad, pg_sz }) {
  const p = new URLSearchParams();
  if (search) p.set("search", search);
  if (lat != null && lng != null) {
    p.set("lat", String(lat));
    p.set("lng", String(lng));
    p.set("krad", String(krad ?? 0.5));
  }
  p.set("pg_sz", String(pg_sz ?? 8));

  const r = await fetch(`${PLANIT}?${p.toString()}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data?.records) ? data.records : [];
}

function normalizeApp(rec) {
  return {
    ref: rec.uid || rec.name || "",
    name: rec.name || "",
    description: rec.description || "",
    council: rec.area_name || "",
    url: rec.url || rec.link || "",
    appType: rec.app_type || "",
    state: rec.app_state || "",
    size: rec.app_size || "",
    address: rec.address || "",
    lat: typeof rec.location_y === "number" ? rec.location_y : undefined,
    lng: typeof rec.location_x === "number" ? rec.location_x : undefined,
    date: rec.consulted_date || rec.last_changed || "",
  };
}

/* ------------------------------- documents ------------------------------- */

async function handleDocuments(params) {
  const appUrl = (params.get("url") || "").trim();
  if (!appUrl) return { supported: false, reason: "Missing url", documents: [] };

  // Only Idox Public Access has a predictable documents tab we can parse.
  const isIdox = /\/online-applications\/applicationDetails\.do/i.test(appUrl);
  if (!isIdox) {
    return {
      supported: false,
      reason: "Portal is not Idox Public Access — open the application page to view documents.",
      documentsUrl: appUrl,
      documents: [],
    };
  }

  const documentsUrl = toDocumentsTab(appUrl);
  try {
    const { status, body } = await getText(documentsUrl, { referer: appUrl, insecure: true });
    if (status >= 400 || !body) {
      return { supported: true, documentsUrl, documents: [], reason: `Portal returned ${status}` };
    }
    const documents = parseIdoxDocuments(body, documentsUrl).slice(0, 40);
    return { supported: true, documentsUrl, documents };
  } catch (err) {
    return { supported: true, documentsUrl, documents: [], reason: String(err?.message || err) };
  }
}

function toDocumentsTab(appUrl) {
  if (/activeTab=/i.test(appUrl)) return appUrl.replace(/activeTab=[^&]*/i, "activeTab=documents");
  return appUrl + (appUrl.includes("?") ? "&" : "?") + "activeTab=documents";
}

function parseIdoxDocuments(html, baseUrl) {
  const $ = cheerio.load(html);

  // Find the documents table by its header row, and map column positions.
  let table = null;
  const idx = { date: -1, type: -1, desc: -1, drawing: -1 };
  $("table").each((_, t) => {
    const headers = $(t)
      .find("th")
      .map((__, th) => $(th).text().trim().toLowerCase())
      .get();
    const joined = headers.join("|");
    if (/document type/.test(joined) || /date published/.test(joined)) {
      headers.forEach((h, i) => {
        if (idx.date < 0 && /date/.test(h)) idx.date = i;
        else if (idx.type < 0 && /type/.test(h)) idx.type = i;
        else if (idx.desc < 0 && /description/.test(h)) idx.desc = i;
        else if (idx.drawing < 0 && /drawing/.test(h)) idx.drawing = i;
      });
      table = t;
      return false;
    }
  });

  const rows = table ? $(table).find("tr") : $("table tr");
  const out = [];
  const seen = new Set();

  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const texts = tds.map((__, td) => $(td).text().trim().replace(/\s+/g, " ")).get();
    const at = (i) => (i >= 0 && i < texts.length ? texts[i] : "");

    let date = at(idx.date) || texts.find((t) => /\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/.test(t)) || "";
    let type = at(idx.type);
    let drawingNo = at(idx.drawing) || texts.find((t) => /^[A-Z]{1,4}[-_ ]?\d{2,}[A-Z0-9_.-]*$/.test(t)) || "";
    let description = clean(
      at(idx.desc) ||
        texts
          .filter((t) => t && !/^select this document$/i.test(t))
          .sort((a, b) => b.length - a.length)[0] ||
        "",
    );

    if (!description || /^select this document$/i.test(description)) return;
    const key = (drawingNo || description).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const hrefs = $(tr)
      .find("a[href]")
      .map((__, a) => $(a).attr("href"))
      .get();
    const fileHref =
      hrefs.find((h) => /files\/|getdocument|documentdetails|\.pdf|documentnumber|apppk/i.test(h)) ||
      hrefs.find((h) => h && !/^#|^javascript:/i.test(h));
    const url = fileHref ? safeResolve(fileHref, baseUrl) : undefined;

    const cls = classifyDoc(`${type} ${description} ${drawingNo}`);
    out.push({
      date,
      docType: cls.type,
      drawingNo,
      description,
      url,
      reveals: cls.reveals,
      basis: cls.basis,
      confidence: cls.confidence,
      rank: cls.rank,
    });
  });

  // Surface the genuine drawings first; drop the internal rank before returning.
  out.sort((a, b) => a.rank - b.rank);
  return out.map(({ rank, ...d }) => d); // eslint-disable-line no-unused-vars
}

function clean(s) {
  return (s || "").replace(/select this document/gi, "").replace(/\s+/g, " ").trim();
}

/* ------------------------------- classifier ------------------------------- */

// Lower rank = surfaced first. Drawings (the point of the tool) rank above the
// legal/admin paperwork that fills most planning files.
export function classifyDoc(text) {
  const t = (text || "").toLowerCase();
  const hit = (type, reveals, rank, confidence = 90) => ({
    type,
    reveals,
    rank,
    confidence,
    basis: "Classified from the document type and description in the council register.",
  });

  // Admin / legal / reports — explicitly NOT drawings (guards "Section 106" etc.)
  if (
    /section ?106|s\.?106|legal agreement|unilateral undertaking|deed|decision notice|officer report|committee report|delegated report|consultation|neighbour|objection|representation|email|notification|press notice|site notice|application form|covering letter|cil |community infrastructure|transport (statement|assessment)|travel plan|statement of community|air quality|noise|acoustic|ecolog|arboricultural|tree |energy statement|sustainability|overheating|daylight|sunlight|flood risk|drainage|sud|heritage statement|townscape|planning statement|design code|fire statement|servicing (and )?(delivery|management)|waste management|wind |microclimate|viability|affordable housing|phasing|schedule of|validation|fee /.test(
      t,
    )
  )
    return hit("Document", [], 90, 55);

  if (/design\s*(and|&)?\s*access|\bdas\b/.test(t))
    return hit("DAS", ["Entrance strategy", "Circulation", "Front vs back-of-house", "Accessibility"], 0, 94);
  if (/(ground|lower ground)\s*floor/.test(t))
    return hit("GA plan", ["Entrances", "Reception", "Lift core"], 1, 92);
  if (/basement/.test(t)) return hit("Basement", ["Plant", "Parking", "Back-of-house"], 2);
  if (/roof\s*plan|roof\s*ga|roof\s*level/.test(t)) return hit("Roof plan", ["Roof plant", "Terraces"], 3);
  if (/floor\s*plan|\bga\b|general arrangement|typical (floor|level)|level \d/.test(t))
    return hit("GA plan", ["Floor-plate layout", "Core position"], 3);
  if (/cross\s*section|long\s*section|^section|section [a-z]{1,2}\b|sections?\b/.test(t))
    return hit("Section", ["Floor-to-floor heights", "Vertical stacking"], 4);
  if (/elevation/.test(t)) return hit("Elevation", ["Façade", "Fenestration"], 5);
  if (/site\s*plan|location plan|block plan|masterplan/.test(t))
    return hit("Site plan", ["Footprint in context", "Approach routes", "Street frontage"], 5);
  if (/drawing register|drawing (list|schedule)|document (register|schedule)/.test(t))
    return hit("Register", ["Full sheet list", "What else exists to pull"], 6, 88);
  if (/\bplan\b|layout/.test(t)) return hit("GA plan", ["Floor-plate layout", "Core position"], 6, 75);

  return { type: "Document", reveals: [], rank: 95, confidence: 55, basis: "Listed in the register; type not auto-detected." };
}

/* --------------------------------- http --------------------------------- */

function getText(target, { referer, insecure = false, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(target);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(
      u,
      {
        method: "GET",
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          ...(referer ? { Referer: referer } : {}),
        },
        // Some council hosts serve an incomplete TLS chain (browsers auto-fix
        // via AIA; Node does not). This reads public pages only.
        rejectUnauthorized: !insecure,
        timeout: 12000,
      },
      (resp) => {
        const status = resp.statusCode || 0;
        if (status >= 300 && status < 400 && resp.headers.location && redirects > 0) {
          resp.resume();
          const nextUrl = safeResolve(resp.headers.location, target);
          return resolve(getText(nextUrl, { referer, insecure, redirects: redirects - 1 }));
        }
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
    req.end();
  });
}

function safeResolve(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

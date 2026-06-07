// Building Intelligence Engine — single endpoint that aggregates every available
// public data source for a UK building into one UnifiedBuilding object.
//
//   GET /api/building?address=...            -> full unified intelligence object
//   GET /api/building?lat=..&lng=..          -> same, from a map click
//   GET /api/building/status                 -> which sources/keys are wired
//
// Same-origin to the app (mounted by Vite in dev and server/index.mjs in prod),
// so the browser makes ONE call and never hits a CORS wall. Secrets stay server
// side. Missing keys degrade to honest `unavailable` sections — never mock data.

import { loadProjectEnv } from "./scannerRelay.mjs";
import { getBuilding } from "./aggregator.mjs";
import { resolverKeyStatus } from "./sources/osPlaces.mjs";

loadProjectEnv();

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function keyStatus() {
  const r = resolverKeyStatus();
  return {
    resolver: r, // { osPlaces, mapbox }
    sources: {
      police: { auth: "none", live: true },
      foodHygiene: { auth: "none", live: true },
      flood: { auth: "none", live: true },
      planningApps: { auth: "none", live: true },
      planningData: { auth: "none", live: true },
      landRegistry: { auth: "none", live: true },
      tfl: { auth: "none", live: true, note: "TFL_APP_KEY only raises the rate limit" },
      deprivation: { auth: "none", live: true, note: "IMD via findthatpostcode → feeds the risk index" },
      groundStability: {
        auth: "none",
        live: true,
        note: "BGS GeoSure subsidence/landslide — run `npm run ingest:hazard` once",
      },
      companiesHouse: { auth: "key", live: !!process.env.COMPANIES_HOUSE_KEY },
      cqc: { auth: "key", live: !!process.env.CQC_API_KEY },
      charities: { auth: "key", live: !!process.env.CHARITY_COMMISSION_KEY },
      epc: { auth: "key", live: !!(process.env.EPC_EMAIL && process.env.EPC_API_KEY) },
      voa: { auth: "none", live: false, note: "no open API — returns official lookup links" },
      osLinkedIds: {
        auth: "key",
        live: !!(process.env.OS_PLACES_KEY || process.env.OS_DATA_HUB_KEY),
        note: "shares OS_PLACES_KEY — adds TOID + USRN to identity",
      },
    },
    memory: {
      recall: "local risk-factor similarity (always on)",
      cloudSync: process.env.SUPERMEMORY_API_KEY ? "supermemory" : "off",
      note: "Similar-sites recall works with no key; SUPERMEMORY_API_KEY adds cloud sync",
    },
  };
}

export async function buildingMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/building")) return next();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (url.pathname === "/api/building/status") {
    return json(res, 200, keyStatus());
  }

  if (url.pathname !== "/api/building") {
    return json(res, 404, { error: "Unknown building endpoint" });
  }

  const input = {
    address: (url.searchParams.get("address") || "").trim() || undefined,
    lat: num(url.searchParams.get("lat")),
    lng: num(url.searchParams.get("lng")),
    postcode: (url.searchParams.get("postcode") || "").trim() || undefined,
  };

  try {
    const result = await getBuilding(input);
    if (!result.ok) return json(res, result.status, { error: result.error });
    return json(res, 200, result.building);
  } catch (err) {
    return json(res, 502, { error: String(err?.message || err) });
  }
}

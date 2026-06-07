// Geological hazard — BGS open data, ingested locally by
// scripts/ingest-hazard.mjs (npm run ingest:hazard, ~24MB keyless download):
//   • GeoSure 5km hex     → ground stability (shrink-swell SUBSIDENCE, landslides,
//                           soluble-rock dissolution/sinkholes, running sand,
//                           collapsible & compressible ground)   [data/hazard/geosure.json]
//   • Mining hazard 1km   → non-coal underground mining           [data/hazard/mining.json]
//   • Radon atlas 1km     → radon potential band 1–6              [data/hazard/radon.json]
//
// Subsidence + mining are structural property risks (they drive the risk index's
// "ground stability" factor); radon is a health/remediation flag (surfaced, not
// scored). Lookups use a bucketed nearest-centroid index so even the 242k-tile
// radon set resolves in well under a millisecond. Joins on coordinates. If the
// data isn't ingested yet it reports `unavailable` with the setup command — never mock.

import fs from "node:fs";
import path from "node:path";
import { ok, unavailable, error } from "./util.mjs";

const SOURCE = "groundStability";
const DIR = path.join(process.cwd(), "data", "hazard");
const SEV_LABELS = ["None", "Low", "Moderate", "Significant", "High", "Very high"];
const HAZARD_LABEL = {
  shrinkSwell: "Shrink-swell (subsidence)",
  landslides: "Landslides",
  solubleRocks: "Soluble rocks (dissolution)",
  runningSand: "Running sand",
  collapsible: "Collapsible deposits",
  compressible: "Compressible ground",
};
// Radon CLASS_MAX 1–6 = max % of homes above the action level in the grid square.
const RADON = {
  1: { label: "Lowest (<1%)", severity: 1 },
  2: { label: "Low (1–3%)", severity: 1 },
  3: { label: "Moderate (3–5%)", severity: 2 },
  4: { label: "Moderate–high (5–10%)", severity: 2 },
  5: { label: "High (10–30%)", severity: 3 },
  6: { label: "Highest (>30%)", severity: 3 },
};

const CELL = 0.02; // ~2.2 km bucket grid

function buildIndex(records) {
  const idx = new Map();
  for (const r of records) {
    const k = `${Math.round(r.lat / CELL)}_${Math.round(r.lng / CELL)}`;
    let arr = idx.get(k);
    if (!arr) idx.set(k, (arr = []));
    arr.push(r);
  }
  return idx;
}

const datasets = {}; // name → { index } | null (missing)
function load(name) {
  if (name in datasets) return datasets[name];
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8"));
    datasets[name] = { index: buildIndex(data.records) };
  } catch {
    datasets[name] = null;
  }
  return datasets[name];
}

function nearest(ds, lat, lng, maxKm) {
  if (!ds) return null;
  const cLat = Math.round(lat / CELL), cLng = Math.round(lng / CELL);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best = null, bestSq = Infinity;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const arr = ds.index.get(`${cLat + i}_${cLng + j}`);
      if (!arr) continue;
      for (const r of arr) {
        const dx = (r.lng - lng) * cosLat * 111.32;
        const dy = (r.lat - lat) * 110.57;
        const sq = dx * dx + dy * dy;
        if (sq < bestSq) (bestSq = sq), (best = r);
      }
    }
  }
  const km = Math.sqrt(bestSq);
  return best && km <= maxKm ? { rec: best, km } : null;
}

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query geological hazard.");
  }
  const geo = load("geosure");
  if (!geo) {
    return unavailable(
      SOURCE,
      "Geological hazard not ingested yet — run `npm run ingest:hazard` (BGS GeoSure/Mining/Radon, ~24MB, no key).",
    );
  }

  const gHit = nearest(geo, ctx.lat, ctx.lng, 4);
  if (!gHit) {
    return ok(SOURCE, { available: false, note: "Outside the GB hazard grid (e.g. NI or offshore)." });
  }

  // GeoSure per-hazard + worst structural hazard
  const hazards = {};
  let worst = { hazard: null, severity: -1, name: null };
  for (const [key, sev] of Object.entries(gHit.rec.h || {})) {
    hazards[key] = { severity: sev, label: SEV_LABELS[sev] ?? String(sev), name: HAZARD_LABEL[key] || key };
    if (sev > worst.severity) worst = { hazard: key, severity: sev, name: HAZARD_LABEL[key] || key };
  }

  // Mining (structural) — folds into the worst structural hazard
  let mining = null;
  const mHit = nearest(load("mining"), ctx.lat, ctx.lng, 1.5);
  mining = mHit
    ? { severity: mHit.rec.s, label: SEV_LABELS[mHit.rec.s] ?? String(mHit.rec.s) }
    : { severity: 0, label: "No known mining" };
  if (mining.severity > worst.severity) {
    worst = { hazard: "mining", severity: mining.severity, name: "Mining (non-coal)" };
  }

  // Radon (health) — surfaced, not scored into the structural index
  let radon = null;
  const rHit = nearest(load("radon"), ctx.lat, ctx.lng, 1.5);
  if (rHit) {
    const band = rHit.rec.b;
    const m = RADON[band] || { label: `Band ${band}`, severity: 1 };
    radon = { band, label: m.label, severity: m.severity };
  }

  return ok(SOURCE, {
    available: true,
    distanceKm: Math.round(gHit.km * 10) / 10,
    overall: { severity: worst.severity, label: SEV_LABELS[worst.severity] ?? "None", hazard: worst.hazard, name: worst.name },
    hazards,
    mining,
    radon,
  });
}

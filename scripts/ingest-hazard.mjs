// One-time ingest of BGS open hazard data into a compact per-hex lookup.
//
//   node scripts/ingest-hazard.mjs        (or: npm run ingest:hazard)
//
// Source: OS Data Hub Downloads API (keyless, OGL) — the BGS open 5 km-hex
// GeoSure ground-stability suite (shrink-swell subsidence, landslides, soluble
// rocks/dissolution, running sand, collapsible & compressible ground) and the
// BGS/UKHSA Radon Indicative Atlas. These are national hex grids in British
// National Grid (EPSG:27700); each GeoPackage feature carries an envelope in its
// geometry header, so we read the hex centroid directly (no WKB ring parsing),
// convert BNG → WGS84, and write data/hazard/*.json. The runtime source then
// does a nearest-centroid lookup. data/ is gitignored — this is regenerable.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const DOWNLOADS = "https://api.os.uk/downloads/v1/products";
const OUT_DIR = path.join(process.cwd(), "data", "hazard");
const TMP = path.join(os.tmpdir(), "haz-ingest");

/* ----------------------- BNG (EPSG:27700) → WGS84 ----------------------- */
// Airy 1830 transverse-mercator inverse, then a Helmert datum shift to WGS84.
// Accurate to a few metres without OSTN15 — ample for a 5 km hex grid.

const D2R = Math.PI / 180;
function bngToWgs84(E, N) {
  const a = 6377563.396, b = 6356256.909, F0 = 0.9996012717;
  const phi0 = 49 * D2R, lam0 = -2 * D2R, N0 = -100000, E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b), n2 = n * n, n3 = n * n * n;

  let phi = phi0, M = 0;
  do {
    phi = (N - N0 - M) / (a * F0) + phi;
    const Ma = (1 + n + 1.25 * n2 + 1.25 * n3) * (phi - phi0);
    const Mb = (3 * n + 3 * n2 + 2.625 * n3) * Math.sin(phi - phi0) * Math.cos(phi + phi0);
    const Mc = (1.875 * n2 + 1.875 * n3) * Math.sin(2 * (phi - phi0)) * Math.cos(2 * (phi + phi0));
    const Md = (35 / 24) * n3 * Math.sin(3 * (phi - phi0)) * Math.cos(3 * (phi + phi0));
    M = b * F0 * (Ma - Mb + Mc - Md);
  } while (Math.abs(N - N0 - M) >= 0.00001);

  const cosphi = Math.cos(phi), sinphi = Math.sin(phi), tanphi = Math.tan(phi);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sinphi * sinphi);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sinphi * sinphi, 1.5);
  const eta2 = nu / rho - 1;
  const t2 = tanphi * tanphi, t4 = t2 * t2, t6 = t4 * t2, sec = 1 / cosphi;
  const nu3 = nu * nu * nu, nu5 = nu3 * nu * nu, nu7 = nu5 * nu * nu;
  const VII = tanphi / (2 * rho * nu);
  const VIII = (tanphi / (24 * rho * nu3)) * (5 + 3 * t2 + eta2 - 9 * t2 * eta2);
  const IX = (tanphi / (720 * rho * nu5)) * (61 + 90 * t2 + 45 * t4);
  const X = sec / nu;
  const XI = (sec / (6 * nu3)) * (nu / rho + 2 * t2);
  const XII = (sec / (120 * nu5)) * (5 + 28 * t2 + 24 * t4);
  const XIIA = (sec / (5040 * nu7)) * (61 + 662 * t2 + 1320 * t4 + 720 * t6);
  const dE = E - E0, dE2 = dE * dE, dE3 = dE2 * dE, dE4 = dE2 * dE2, dE5 = dE3 * dE2, dE6 = dE4 * dE2, dE7 = dE5 * dE2;
  const latAiry = phi - VII * dE2 + VIII * dE4 - IX * dE6;
  const lonAiry = lam0 + X * dE - XI * dE3 + XII * dE5 - XIIA * dE7;

  // OSGB36 (Airy) geodetic → cartesian → Helmert → WGS84 geodetic
  const sL = Math.sin(latAiry), cL = Math.cos(latAiry), sO = Math.sin(lonAiry), cO = Math.cos(lonAiry);
  const nuA = a / Math.sqrt(1 - e2 * sL * sL);
  const x1 = nuA * cL * cO, y1 = nuA * cL * sO, z1 = (1 - e2) * nuA * sL;
  const tx = 446.448, ty = -125.157, tz = 542.06, s = 20.4894e-6;
  const rx = (0.1502 / 3600) * D2R, ry = (0.247 / 3600) * D2R, rz = (0.8421 / 3600) * D2R;
  const x2 = tx + x1 * (1 + s) - y1 * rz + z1 * ry;
  const y2 = ty + x1 * rz + y1 * (1 + s) - z1 * rx;
  const z2 = tz - x1 * ry + y1 * rx + z1 * (1 + s);
  const a2 = 6378137, b2 = 6356752.3142, e2b = 1 - (b2 * b2) / (a2 * a2);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let lat = Math.atan2(z2, p * (1 - e2b)), prev, i = 0;
  do {
    prev = lat;
    const nu2 = a2 / Math.sqrt(1 - e2b * Math.sin(lat) * Math.sin(lat));
    lat = Math.atan2(z2 + e2b * nu2 * Math.sin(lat), p);
  } while (Math.abs(lat - prev) > 1e-12 && ++i < 10);
  return { lat: round(lat / D2R, 5), lng: round(Math.atan2(y2, x2) / D2R, 5) };
}
const round = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;

/* --------------------------- gpkg geometry --------------------------- */
// Read the hex centroid from the GeoPackage geometry-blob envelope (flags E=1 →
// [minX, maxX, minY, maxY] as little-endian doubles after the 8-byte header).
function centroidFromGpkg(blob) {
  const b = Buffer.from(blob);
  if (b[0] !== 0x47 || b[1] !== 0x50) return null; // 'GP'
  const flags = b[3];
  const E = (flags >> 1) & 0x07;
  if (E !== 1) return null; // we only need the simple XY envelope
  const minX = b.readDoubleLE(8), maxX = b.readDoubleLE(16);
  const minY = b.readDoubleLE(24), maxY = b.readDoubleLE(32);
  return { e: (minX + maxX) / 2, n: (minY + maxY) / 2 };
}

function legendToSeverity(legend) {
  const t = String(legend || "").toLowerCase();
  if (/very high|very significant/.test(t)) return 5;
  if (/high/.test(t)) return 4;
  if (/significant|moderate to high/.test(t)) return 3;
  if (/moderate/.test(t)) return 2;
  if (/very low|negligible|no hazard|not.*present/.test(t)) return 0;
  if (/low/.test(t)) return 1;
  return 0;
}

/* ------------------------------ download ------------------------------ */
async function fetchGpkg(productId) {
  fs.mkdirSync(TMP, { recursive: true });
  const zipPath = path.join(TMP, `${productId}.zip`);
  if (!fs.existsSync(zipPath)) {
    const list = await (await fetch(`${DOWNLOADS}/${productId}/downloads`, { headers: { Accept: "application/json" } })).json();
    const dl = (Array.isArray(list) ? list : []).find((d) => d.format === "GeoPackage" && (d.area === "GB" || !d.area));
    if (!dl) throw new Error(`No GeoPackage download for ${productId}`);
    console.log(`  downloading ${productId} (${Math.round((dl.size || 0) / 1e6)}MB)…`);
    const res = await fetch(dl.url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }
  const dir = path.join(TMP, productId);
  fs.rmSync(dir, { recursive: true, force: true });
  execFileSync("unzip", ["-o", "-q", zipPath, "-d", dir]);
  const gpkg = walk(dir).find((f) => f.endsWith(".gpkg"));
  if (!gpkg) throw new Error(`No .gpkg inside ${productId}`);
  return gpkg;
}
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/* ------------------------------ GeoSure ------------------------------ */
const GEOSURE_TABLES = {
  shrinkSwell: "GB_Hex_5km_GS_ShrinkSwell_v8",
  landslides: "GB_Hex_5km_GS_Landslides_v8",
  solubleRocks: "GB_Hex_5km_GS_SolubleRocks_v8",
  runningSand: "GB_Hex_5km_GS_RunningSand_v8",
  collapsible: "GB_Hex_5km_GS_CollapsibleDeposits_v8",
  compressible: "GB_Hex_5km_GS_CompressibleGround_v8",
};

async function ingestGeoSure() {
  console.log("GeoSure (ground stability)…");
  const gpkg = await fetchGpkg("GB-Hex-5km-GeoSure");
  const db = new DatabaseSync(gpkg, { readOnly: true });
  const hexes = new Map(); // key "e_n" → { lat,lng, h:{hazard:sev} }
  const legends = {};

  for (const [hazard, table] of Object.entries(GEOSURE_TABLES)) {
    let rows;
    try {
      rows = db.prepare(`SELECT geom, CLASS, Legend FROM ${table}`).all();
    } catch (e) {
      console.log(`  ! skip ${table}: ${e.message}`);
      continue;
    }
    let n = 0;
    for (const r of rows) {
      const c = centroidFromGpkg(r.geom);
      if (!c) continue;
      const key = `${Math.round(c.e)}_${Math.round(c.n)}`;
      let rec = hexes.get(key);
      if (!rec) {
        const ll = bngToWgs84(c.e, c.n);
        rec = { lat: ll.lat, lng: ll.lng, h: {} };
        hexes.set(key, rec);
      }
      const sev = legendToSeverity(r.Legend);
      rec.h[hazard] = sev;
      legends[`${hazard}:${sev}`] = r.Legend;
      n++;
    }
    console.log(`  ${hazard.padEnd(13)} ${n} hexes`);
  }
  db.close();

  const records = [...hexes.values()];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "geosure.json"),
    JSON.stringify({ product: "BGS GeoSure 5km hex v8 (OGL)", hazards: Object.keys(GEOSURE_TABLES), records }),
  );
  console.log(`  → data/hazard/geosure.json (${records.length} hexes)`);

  // sanity: a London hex should resolve to ~51.5 / ~-0.1
  const london = records.reduce((best, r) => {
    const d = Math.hypot(r.lat - 51.5, r.lng + 0.1);
    return d < best.d ? { d, r } : best;
  }, { d: Infinity, r: null });
  console.log(`  sanity: nearest-to-London hex at lat ${london.r.lat}, lng ${london.r.lng}`);
}

/* ------------------------------ Mining ------------------------------ */
async function ingestMining() {
  console.log("Mining hazard (non-coal, 1km)…");
  const gpkg = await fetchGpkg("GB-Hex-1km-Mining-Haz");
  const db = new DatabaseSync(gpkg, { readOnly: true });
  const rows = db.prepare("SELECT geom, Class FROM Hex_1km_MiningHazardNotIncludingCoalGB_v8").all();
  const records = [];
  for (const r of rows) {
    const sev = legendToSeverity(r.Class); // Low/Moderate/Significant → 1/2/3; NA → 0
    if (sev <= 0) continue; // skip "no known mining" — absence is reported by the source
    const c = centroidFromGpkg(r.geom);
    if (!c) continue;
    const ll = bngToWgs84(c.e, c.n);
    records.push({ lat: ll.lat, lng: ll.lng, s: sev });
  }
  db.close();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "mining.json"),
    JSON.stringify({ product: "BGS Mining hazard (non-coal) 1km hex v8 (OGL)", records }),
  );
  console.log(`  → data/hazard/mining.json (${records.length} hexes with known mining)`);
}

/* ------------------------------ Radon ------------------------------ */
async function ingestRadon() {
  console.log("Radon (BGS/UKHSA indicative atlas, 1km)…");
  const gpkg = await fetchGpkg("Radon_Indicative_Atlas");
  const db = new DatabaseSync(gpkg, { readOnly: true });
  const rows = db.prepare("SELECT geom, CLASS_MAX FROM Radon_Indicative_Atlas_v3").all();
  const records = [];
  for (const r of rows) {
    const b = Number(r.CLASS_MAX);
    if (!Number.isFinite(b)) continue;
    const c = centroidFromGpkg(r.geom);
    if (!c) continue;
    const ll = bngToWgs84(c.e, c.n);
    records.push({ lat: ll.lat, lng: ll.lng, b });
  }
  db.close();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "radon.json"),
    JSON.stringify({ product: "BGS/UKHSA Radon Indicative Atlas v3 (OGL)", records }),
  );
  console.log(`  → data/hazard/radon.json (${records.length} tiles)`);
}

await ingestGeoSure();
await ingestMining();
await ingestRadon();
console.log("done.");

// Cross-building risk recall.
//
// Our risk profiles are STRUCTURED (crime / flood / ground / deprivation /
// heritage scores), so "most structurally-similar building" is computed exactly
// and instantly as nearest-neighbour over the risk-factor vector — no key, no
// indexing lag, deterministic. That local store powers the "Similar sites" card.
//
// Supermemory is kept as an OPTIONAL cloud write-layer: when SUPERMEMORY_API_KEY
// is set we also push each building's profile to it (verified: POST /v3/documents
// stores + processes), so the same memory accumulates in the cloud for future
// cross-device / portfolio use. We do NOT read recall from Supermemory because
// its free-tier search index populates too slowly to be useful live.

import fs from "node:fs";
import path from "node:path";
import { loadProjectEnv } from "./scannerRelay.mjs";

loadProjectEnv();

const STORE = path.join(process.cwd(), "data", "risk-memory.json");
const MAX_STORE = 2000;
const FACTOR_KEYS = ["crime", "flood", "ground", "deprivation", "regulatory"];

/* ------------------------------ local store ------------------------------ */

function vec(b) {
  const m = Object.fromEntries((b.risk?.factors || []).map((f) => [f.key, f.score]));
  return FACTOR_KEYS.map((k) => (typeof m[k] === "number" ? m[k] : 0));
}
function buildingId(b) {
  if (b.identity?.uprn) return `uprn:${b.identity.uprn}`;
  const c = b.identity?.coordinates;
  return c ? `geo:${c.lat},${c.lng}` : `addr:${b.identity?.address || "?"}`;
}
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8"));
  } catch {
    return [];
  }
}
function saveStore(arr) {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify(arr.slice(-MAX_STORE)));
  } catch {
    /* best-effort */
  }
}
function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/* ------------------------------ Supermemory ------------------------------ */

const SM_API = "https://api.supermemory.ai/v3";
const CONTAINER = process.env.SUPERMEMORY_CONTAINER || "spectre-buildings";
function smKey() {
  return process.env.SUPERMEMORY_API_KEY || "";
}
export function cloudMemoryEnabled() {
  return !!smKey();
}

function profileText(b) {
  const r = b.risk;
  return [
    b.identity?.address || "Building",
    b.identity?.council ? `in ${b.identity.council}` : "",
    `— risk ${r?.score ?? "?"}/100 (${r?.band ?? "?"}).`,
    ...(r?.factors || []).map((f) => `${f.label} ${f.score}: ${f.basis}.`),
  ]
    .filter(Boolean)
    .join(" ");
}

async function cloudWrite(b) {
  if (!smKey()) return;
  try {
    await fetch(`${SM_API}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${smKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: profileText(b),
        containerTag: CONTAINER,
        customId: buildingId(b),
        metadata: {
          uprn: b.identity?.uprn || "",
          address: b.identity?.address || "",
          council: b.identity?.council || "",
          riskScore: b.risk?.score ?? null,
          riskBand: b.risk?.band ?? "",
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* cloud sync is best-effort — never affects a lookup */
  }
}

/* -------------------------------- public -------------------------------- */

/** Persist this building's risk profile (local store + optional cloud). */
export async function rememberBuilding(b) {
  const arr = loadStore();
  const id = buildingId(b);
  const rec = {
    id,
    address: b.identity?.address || "Building",
    council: b.identity?.council || null,
    riskScore: b.risk?.score ?? null,
    riskBand: b.risk?.band ?? null,
    vec: vec(b),
  };
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr[i] = rec;
  else arr.push(rec);
  saveStore(arr);
  cloudWrite(b); // fire-and-forget cloud sync
}

/** Recall the most structurally-similar buildings assessed before. */
export async function recallSimilar(b, max = 5) {
  const arr = loadStore();
  const id = buildingId(b);
  const v = vec(b);
  const matches = arr
    .filter((x) => x.id !== id && Array.isArray(x.vec))
    .map((x) => ({ x, dist: euclid(v, x.vec) }))
    .sort((p, q) => p.dist - q.dist)
    .slice(0, max)
    .map(({ x, dist }) => ({
      address: x.address,
      council: x.council,
      riskScore: x.riskScore,
      riskBand: x.riskBand,
      similarity: Math.round((1 - Math.min(1, dist / 224)) * 100) / 100, // 0–1
    }));
  return { enabled: matches.length > 0, matches, cloudSync: cloudMemoryEnabled() };
}

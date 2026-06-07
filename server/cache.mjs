// Tiny file cache for building-intelligence source responses.
//
// Building lookups hit a dozen external APIs and the data barely moves, so we
// cache each source's response on disk keyed by (source + UPRN|postcode|coords)
// with a per-source TTL set by the aggregator (crime: 1 day, ownership: 30 days,
// planning: 7 days, …). Lives under data/ which is gitignored.
//
// Deliberately dependency-free and best-effort: any cache failure is swallowed
// and treated as a miss, so the cache can never break a live lookup.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DIR = path.join(process.cwd(), "data", "building-cache");

/** Stable cache key for a source given the resolved building context. */
export function cacheKey(source, ctx) {
  const id =
    ctx.uprn ||
    ctx.postcode ||
    (ctx.lat != null && ctx.lng != null ? `${ctx.lat},${ctx.lng}` : "unknown");
  const hash = crypto.createHash("sha1").update(String(id)).digest("hex").slice(0, 16);
  return `${source}-${hash}`;
}

function fileFor(key) {
  return path.join(DIR, `${key}.json`);
}

/** Returns the cached value if present and younger than ttlMs, else null. */
export function readCache(key, ttlMs) {
  try {
    const raw = fs.readFileSync(fileFor(key), "utf8");
    const env = JSON.parse(raw);
    if (!env || typeof env.ts !== "number") return null;
    if (Date.now() - env.ts > ttlMs) return null;
    return env.value;
  } catch {
    return null;
  }
}

/** Persist a value. Best-effort; never throws. */
export function writeCache(key, value) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileFor(key), JSON.stringify({ ts: Date.now(), value }));
  } catch {
    /* cache is an optimisation — ignore disk errors */
  }
}

/** Common TTLs (ms) so source registrations read cleanly. */
export const TTL = {
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
};

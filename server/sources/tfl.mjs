// Transport — Transport for London Unified API (open; an app key only raises the
// rate limit, it isn't required). Returns the tube / rail / DLR / tram / bus stops
// near the building, the lines that serve them, and a connectivity score derived
// from what's actually within walking distance. Joins on coordinates.
//
// Honest naming: the search API doesn't return step-free/accessibility per stop
// (that needs a per-stop call), so we report a *connectivity* score from mode mix
// and proximity — not a step-free "accessibility" claim.

import { getJson, ok, error } from "./util.mjs";

const STOPPOINT = "https://api.tfl.gov.uk/StopPoint";
const SOURCE = "tfl";
const RADIUS_M = 800;
const STOP_TYPES = "NaptanMetroStation,NaptanRailStation,NaptanPublicBusCoachTram,NaptanFerryPort";

function appKey() {
  return process.env.TFL_APP_KEY || process.env.TFL_API_KEY || "";
}

// Per-mode weight toward the connectivity score.
const MODE_WEIGHT = {
  tube: 35,
  dlr: 30,
  overground: 28,
  "elizabeth-line": 30,
  "national-rail": 25,
  tram: 18,
  "river-bus": 12,
  bus: 0,
};

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query nearby transport.");
  }

  const key = appKey();
  const url =
    `${STOPPOINT}?lat=${ctx.lat}&lon=${ctx.lng}` +
    `&stopTypes=${encodeURIComponent(STOP_TYPES)}&radius=${RADIUS_M}` +
    (key ? `&app_key=${encodeURIComponent(key)}` : "");
  const res = await getJson(url, { timeoutMs: 12000 });
  if (!res.ok) {
    return error(SOURCE, `TfL API returned ${res.status || "no response"}.`);
  }

  const raw = Array.isArray(res.data?.stopPoints) ? res.data.stopPoints : [];

  // Collapse the directional duplicates TfL returns (same name = same stop).
  const byName = new Map();
  for (const s of raw) {
    const name = s.commonName || s.name || "Stop";
    const cur = byName.get(name) || {
      name,
      modes: new Set(),
      lines: new Set(),
      distance: Infinity,
    };
    (s.modes || []).forEach((m) => cur.modes.add(m));
    (s.lines || []).forEach((l) => l?.name && cur.lines.add(l.name));
    if (typeof s.distance === "number") cur.distance = Math.min(cur.distance, s.distance);
    byName.set(name, cur);
  }

  const nearbyStops = [...byName.values()]
    .map((s) => ({
      name: s.name,
      modes: [...s.modes],
      lines: [...s.lines].slice(0, 12),
      distanceM: Number.isFinite(s.distance) ? Math.round(s.distance) : null,
    }))
    .sort((a, b) => (a.distanceM ?? 9e9) - (b.distanceM ?? 9e9));

  // Connectivity score: best mode weights present + bus-route breadth + proximity.
  const allModes = new Set(nearbyStops.flatMap((s) => s.modes));
  let score = 0;
  for (const m of allModes) score += MODE_WEIGHT[m] ?? 0;
  const busLines = new Set(
    nearbyStops.filter((s) => s.modes.includes("bus")).flatMap((s) => s.lines),
  );
  score += Math.min(30, busLines.size * 3); // up to +30 for bus-route breadth
  const nearest = nearbyStops[0]?.distanceM ?? Infinity;
  if (nearest < 200) score += 10;
  else if (nearest < 400) score += 5;
  const connectivityScore = Math.max(0, Math.min(100, Math.round(score)));

  return ok(SOURCE, {
    radiusM: RADIUS_M,
    stopCount: nearbyStops.length,
    modes: [...allModes],
    connectivityScore,
    nearbyStops: nearbyStops.slice(0, 12),
    note:
      nearbyStops.length === 0
        ? "No TfL stops within 800 m — TfL data covers Greater London only."
        : key
          ? undefined
          : "Live without a key; add TFL_APP_KEY to raise the rate limit.",
  });
}

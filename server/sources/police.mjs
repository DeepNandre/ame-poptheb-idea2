// Police crime — data.police.uk (open, no key).
//
// Street-level crime within ~1 mile of the building for the latest published
// month (the API lags ~1–2 months, so we let it default to "latest" rather than
// guess a date). Joins purely on coordinates.

import { getJson, ok, error, round } from "./util.mjs";

const ALL_CRIME = "https://data.police.uk/api/crimes-street/all-crime";
const LAST_UPDATED = "https://data.police.uk/api/crime-last-updated";

const SOURCE = "police";

function titleCase(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query crime by location.");
  }

  const { ok: gotDate, data: upd } = await getJson(LAST_UPDATED, { timeoutMs: 6000 });
  const month = gotDate && upd?.date ? String(upd.date).slice(0, 7) : null;

  const url =
    `${ALL_CRIME}?lat=${ctx.lat}&lng=${ctx.lng}` + (month ? `&date=${month}` : "");
  const res = await getJson(url, { timeoutMs: 12000 });
  if (!res.ok) {
    return error(SOURCE, `data.police.uk returned ${res.status || "no response"}.`);
  }

  const crimes = Array.isArray(res.data) ? res.data : [];
  const counts = new Map();
  const points = [];
  for (const c of crimes) {
    const cat = titleCase(c.category);
    counts.set(cat, (counts.get(cat) || 0) + 1);
    const la = Number(c.location?.latitude);
    const lo = Number(c.location?.longitude);
    if (Number.isFinite(la) && Number.isFinite(lo) && points.length < 400) {
      points.push({ lat: round(la, 5), lng: round(lo, 5), category: cat });
    }
  }

  const byCategory = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return ok(SOURCE, {
    total: crimes.length,
    month,
    radiusMiles: 1,
    byCategory,
    topCategory: byCategory[0]?.category || null,
    // De-duplicated lat/lng anonymised "snap points" the API already returns;
    // used to paint the crime heat layer on the map.
    points,
  });
}

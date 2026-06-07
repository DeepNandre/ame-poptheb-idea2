// Flood risk — Environment Agency Flood Monitoring API (open, no key).
//
// Returns any flood warnings/alerts currently in force near the building. Joins
// on coordinates (`dist` is in km). The static planning flood ZONE (1/2/3a/3b)
// comes from the planning.data.gov.uk `flood-risk-zone` dataset in Phase 3, so
// we surface `floodZone: null` honestly here rather than guess it.

import { getJson, ok, error } from "./util.mjs";

const FLOODS = "https://environment.data.gov.uk/flood-monitoring/id/floods";
const SOURCE = "flood";

// severityLevel: 1 = Severe Flood Warning, 2 = Flood Warning, 3 = Flood Alert,
// 4 = Warning no longer in force.
const SEVERITY = { 1: "Severe flood warning", 2: "Flood warning", 3: "Flood alert", 4: "No longer in force" };

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query flood warnings by location.");
  }

  const url = `${FLOODS}?lat=${ctx.lat}&long=${ctx.lng}&dist=15`;
  const res = await getJson(url, { timeoutMs: 10000 });
  if (!res.ok) {
    return error(SOURCE, `EA flood API returned ${res.status || "no response"}.`);
  }

  const items = Array.isArray(res.data?.items) ? res.data.items : [];
  const warnings = items
    .filter((it) => Number(it.severityLevel) <= 3)
    .map((it) => ({
      severity: it.severity || SEVERITY[Number(it.severityLevel)] || "Unknown",
      severityLevel: Number(it.severityLevel) || null,
      area: it.floodArea?.description || it.description || "",
      message: it.message || "",
      raised: it.timeRaised || it.timeMessageChanged || null,
    }))
    .sort((a, b) => (a.severityLevel || 9) - (b.severityLevel || 9));

  return ok(SOURCE, {
    radiusKm: 15,
    floodZone: null, // resolved via planning.data.gov.uk flood-risk-zone (Phase 3)
    warningCount: warnings.length,
    warnings,
    summary:
      warnings.length === 0
        ? "No active flood warnings within 15 km."
        : `${warnings.length} active flood ${warnings.length === 1 ? "warning" : "warnings"} within 15 km.`,
  });
}

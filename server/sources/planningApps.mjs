// Planning applications — reuses the existing PlanIt integration (planit.org.uk,
// open aggregator across ~420 UK authorities) already powering /api/planning.
// Joins on coordinates. Document drawings still come from the council portal via
// /api/planning/documents — this source just lists what's been applied for here.

import { searchPlanItApps } from "../planning.mjs";
import { ok, error } from "./util.mjs";

const SOURCE = "planningApps";

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query planning applications.");
  }
  try {
    const applications = await searchPlanItApps({ lat: ctx.lat, lng: ctx.lng, pg_sz: 12 });
    return ok(SOURCE, {
      count: applications.length,
      applications,
    });
  } catch (err) {
    return error(SOURCE, `PlanIt query failed: ${String(err?.message || err)}`);
  }
}

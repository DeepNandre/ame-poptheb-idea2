// Building-intelligence aggregator.
//
// Flow:
//   1. resolveIdentity() turns the address (or a map click's lat/lng) into the
//      canonical ctx every source joins on — UPRN is the master key, with
//      coordinates + postcode + council resolved even without an OS key.
//   2. Every source runs IN PARALLEL with ctx, each wrapped so one failure
//      returns {status:'error'} instead of throwing — graceful degradation.
//   3. Each source is cache-checked before the call and cache-written after,
//      with a per-source TTL (crime 1 day, planning 7 days, ownership 30 days…).
//   4. Results merge into one UnifiedBuilding the frontend renders by section.
//
// REAL DATA ONLY: a missing key yields an honest `unavailable` section with a
// note on how to enable it. Nothing here injects mock/demo data.

import { resolveIdentity } from "./sources/osPlaces.mjs";
import { cacheKey, readCache, writeCache, TTL } from "./cache.mjs";
import { recallSimilar, rememberBuilding } from "./memory.mjs";

import * as police from "./sources/police.mjs";
import * as foodStandards from "./sources/foodStandards.mjs";
import * as floodRisk from "./sources/floodRisk.mjs";
import * as planningApps from "./sources/planningApps.mjs";
import * as planningData from "./sources/planningData.mjs";
import * as companiesHouse from "./sources/companiesHouse.mjs";
import * as charityCommission from "./sources/charityCommission.mjs";
import * as cqc from "./sources/cqc.mjs";
import * as landRegistry from "./sources/landRegistry.mjs";
import * as epc from "./sources/epc.mjs";
import * as voa from "./sources/voa.mjs";
import * as tfl from "./sources/tfl.mjs";
import * as osLinkedIds from "./sources/osLinkedIds.mjs";
import * as imd from "./sources/imd.mjs";
import * as groundHazard from "./sources/groundHazard.mjs";

// name → { module, ttl }. Add Phase 2/3 sources here as they land.
const REGISTRY = [
  { name: "police", mod: police, ttl: TTL.DAY },
  { name: "foodHygiene", mod: foodStandards, ttl: TTL.WEEK },
  { name: "flood", mod: floodRisk, ttl: TTL.DAY },
  { name: "planningApps", mod: planningApps, ttl: TTL.WEEK },
  { name: "planningData", mod: planningData, ttl: TTL.WEEK },
  { name: "companiesHouse", mod: companiesHouse, ttl: TTL.MONTH },
  { name: "charities", mod: charityCommission, ttl: TTL.MONTH },
  { name: "cqc", mod: cqc, ttl: TTL.MONTH },
  { name: "landRegistry", mod: landRegistry, ttl: TTL.MONTH },
  { name: "epc", mod: epc, ttl: TTL.MONTH },
  { name: "voa", mod: voa, ttl: TTL.MONTH },
  { name: "tfl", mod: tfl, ttl: TTL.WEEK },
  { name: "osLinkedIds", mod: osLinkedIds, ttl: TTL.MONTH },
  { name: "deprivation", mod: imd, ttl: TTL.MONTH },
  { name: "groundStability", mod: groundHazard, ttl: TTL.MONTH },
];

/* ------------------------------ risk index ------------------------------ */
// A TRANSPARENT, explainable risk index built only from real public signals.
// Every factor shows its weight and the real basis it was scored from; weights
// renormalise over whatever data is present. It is an indicator, NOT a
// prediction of incidents — the note says so.

function band(score) {
  return score >= 75 ? "High" : score >= 50 ? "Elevated" : score >= 25 ? "Moderate" : "Low";
}

function computeRisk({ crime, floodZone, floodWarnings, ground, listedGrade, conservation, decile }) {
  const factors = [];

  if (crime && crime.status === "ok") {
    const total = crime.data?.total ?? 0;
    const score = Math.min(100, Math.round(total / 25)); // ~2,500 crimes/mo/mile → 100
    factors.push({
      key: "crime",
      label: "Area crime",
      weight: 0.35,
      score,
      basis: `${total} crimes within ${crime.data?.radiusMiles ?? 1} mile${crime.data?.month ? ` (${crime.data.month})` : ""}`,
    });
  }

  {
    let score = 10;
    let basis = "No mapped flood-risk zone";
    if (floodZone) {
      score = floodZone.zone === "3" ? 90 : floodZone.zone === "2" ? 55 : 25;
      basis = `Flood Zone ${floodZone.zone}`;
    }
    if (floodWarnings > 0) {
      score = Math.min(100, score + 20);
      basis += ` · ${floodWarnings} active warning${floodWarnings === 1 ? "" : "s"}`;
    }
    factors.push({ key: "flood", label: "Flood", weight: 0.25, score, basis });
  }

  if (ground && ground.severity != null && ground.severity >= 0) {
    factors.push({
      key: "ground",
      label: "Ground stability",
      weight: 0.15,
      score: ground.severity <= 0 ? 10 : Math.min(100, ground.severity * 20),
      basis: `${ground.name || "Ground hazard"}: ${ground.label}`,
    });
  }

  if (decile != null) {
    factors.push({
      key: "deprivation",
      label: "Deprivation (IMD)",
      weight: 0.15,
      score: (11 - decile) * 10, // decile 1 (most deprived) → 100
      basis: `IMD decile ${decile}/10 (1 = most deprived)`,
    });
  }

  {
    let score = 10;
    let basis = "Not listed / unconstrained";
    if (listedGrade) {
      score = listedGrade === "I" ? 80 : listedGrade === "II*" ? 60 : 45;
      basis = `Grade ${listedGrade} listed`;
    } else if (conservation) {
      score = 30;
      basis = "Conservation area";
    }
    factors.push({ key: "regulatory", label: "Heritage / works constraint", weight: 0.1, score, basis });
  }

  const totW = factors.reduce((s, f) => s + f.weight, 0) || 1;
  const overall = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0) / totW);
  return {
    status: "ok",
    score: overall,
    band: band(overall),
    factors,
    note: "Indicative index from public signals (weights shown) — not a prediction of incidents.",
  };
}

async function runSource({ name, mod, ttl }, ctx) {
  const started = Date.now();
  const key = cacheKey(name, ctx);

  const cached = readCache(key, ttl);
  if (cached) return { ...cached, cached: true, ms: Date.now() - started };

  let result;
  try {
    result = await mod.fetchSource(ctx);
  } catch (err) {
    // A source should never throw — but if one does, it must not sink the others.
    result = { source: name, status: "error", data: null, note: String(err?.message || err) };
  }
  // Only cache useful outcomes; don't pin transient errors.
  if (result.status === "ok" || result.status === "unavailable") writeCache(key, result);
  return { ...result, cached: false, ms: Date.now() - started };
}

/* ------------------------------ FOIA stubs ------------------------------ */
// Phase 4 — data that provably EXISTS but isn't centralised/live. We surface the
// field with a ready-to-send FOIA path rather than pretend to fetch it.

function foiaStubs(ctx) {
  const where = ctx.address || ctx.postcode || "the building";
  const auth = ctx.council || "the relevant authority";
  const tmpl = (subject, body) => ({
    field: subject,
    status: "request-only",
    authority: auth,
    template:
      `To: ${auth} FOI team\nSubject: Freedom of Information request — ${subject}, ${where}\n\n` +
      `Under the Freedom of Information Act 2000, please provide ${body} for the property at ${where}` +
      (ctx.uprn ? ` (UPRN ${ctx.uprn})` : "") +
      `.\n\nPlease confirm receipt and the 20-working-day response date.`,
  });
  return [
    tmpl("Fire risk assessment", "the most recent fire risk assessment and any enforcement notices held"),
    tmpl("Contaminated land register entry", "any entry on the contaminated land register and associated site reports"),
    tmpl("Building Regulations completion certificates", "copies of Building Regulations completion certificates issued"),
    { field: "Gas Safe / EICR records", status: "request-only", authority: "Building owner / managing agent",
      template: "Held by the building owner or managing agent, not a public body — request directly from the freeholder." },
  ];
}

/* ------------------------------ assembly ------------------------------ */

function pick(map, name) {
  return map.get(name) || { source: name, status: "unavailable", data: null, note: "Not run." };
}

function sectionStatus(...results) {
  const statuses = results.map((r) => r?.status);
  if (statuses.includes("ok")) return statuses.every((s) => s === "ok") ? "ok" : "partial";
  if (statuses.includes("error")) return "error";
  return "unavailable";
}

function buildUnified(identity, byName, ctx) {
  const crime = pick(byName, "police");
  const food = pick(byName, "foodHygiene");
  const cqcR = pick(byName, "cqc");
  const companies = pick(byName, "companiesHouse");
  const charities = pick(byName, "charities");
  const flood = pick(byName, "flood");
  const planningAppsR = pick(byName, "planningApps");
  const designationsR = pick(byName, "planningData");
  const ownershipR = pick(byName, "landRegistry");
  const buildingR = pick(byName, "epc");
  const financialR = pick(byName, "voa");
  const transportR = pick(byName, "tfl");
  const osIds = pick(byName, "osLinkedIds");
  const deprivationR = pick(byName, "deprivation");
  const groundR = pick(byName, "groundStability");

  const floodZoneVal = designationsR.data?.floodZone ?? flood.data?.floodZone ?? null;
  const risk = computeRisk({
    crime,
    floodZone: floodZoneVal,
    floodWarnings: flood.data?.warnings?.length ?? 0,
    ground: groundR.data?.available ? groundR.data.overall : null,
    listedGrade: designationsR.data?.listed?.grade ?? null,
    conservation: designationsR.data?.conservationArea ?? null,
    decile: deprivationR.data?.decile ?? null,
  });

  const passthrough = (r) => ({ status: r.status, source: r.source, note: r.note, ...r.data });

  return {
    // OS Linked Identifiers enriches the resolved identity with the building's
    // OS MasterMap TOID and its street USRN (both light up with OS_PLACES_KEY).
    identity: { ...identity, toid: osIds.data?.toid ?? null, usrn: osIds.data?.usrn ?? null },

    // Headline: explainable risk index synthesised from the real signals below.
    risk,

    // Ground stability / subsidence (BGS GeoSure) — a risk driver, surfaced too.
    ground: {
      status: groundR.status,
      note: groundR.note,
      available: groundR.data?.available ?? false,
      overall: groundR.data?.overall ?? null,
      hazards: groundR.data?.hazards ?? null,
      mining: groundR.data?.mining ?? null,
      radon: groundR.data?.radon ?? null,
      distanceKm: groundR.data?.distanceKm ?? null,
    },

    // Deprivation (IMD) — a risk driver, surfaced on its own too.
    deprivation: {
      status: deprivationR.status,
      note: deprivationR.note,
      decile: deprivationR.data?.decile ?? null,
      imdRank: deprivationR.data?.imdRank ?? null,
      lsoa: deprivationR.data?.lsoa ?? null,
      lsoaName: deprivationR.data?.lsoaName ?? null,
      nation: deprivationR.data?.nation ?? null,
    },

    // Phase 2 — live.
    ownership: {
      status: ownershipR.status,
      source: ownershipR.source,
      note: ownershipR.note,
      scope: ownershipR.data?.scope,
      matchedAddress: ownershipR.data?.matchedAddress,
      lastSale: ownershipR.data?.lastSale || null,
      salesHistory: ownershipR.data?.salesHistory || [],
    },
    building: {
      status: buildingR.status,
      source: buildingR.source,
      note: buildingR.note,
      epcRating: buildingR.data?.epcRating ?? null,
      potentialRating: buildingR.data?.potentialRating ?? null,
      floorArea: buildingR.data?.floorArea ?? null,
      propertyType: buildingR.data?.propertyType ?? null,
      builtForm: buildingR.data?.builtForm ?? null,
      inspectionDate: buildingR.data?.inspectionDate ?? null,
      register: buildingR.data?.register,
      certificates: buildingR.data?.certificates || [],
    },
    financial: {
      status: financialR.status,
      source: financialR.source,
      note: financialR.note,
      councilTaxBand: null,
      businessRates: null,
      lookups: financialR.data?.lookups || [],
    },
    transport: {
      status: transportR.status,
      source: transportR.source,
      note: transportR.note,
      connectivityScore: transportR.data?.connectivityScore ?? null,
      stopCount: transportR.data?.stopCount,
      modes: transportR.data?.modes || [],
      nearbyStops: transportR.data?.nearbyStops || [],
    },

    // Phase 1 applications + Phase 3 designations (planning.data.gov.uk).
    planning: {
      status: sectionStatus(planningAppsR, designationsR),
      applications: planningAppsR.data?.applications || [],
      designations: designationsR.data?.designations || [],
      designationGeometry: designationsR.data?.designationGeometry || null,
      listed: designationsR.data?.listed || null,
      conservationArea: designationsR.data?.conservationArea || null,
      sources: [meta(planningAppsR), meta(designationsR)],
    },
    occupants: {
      status: sectionStatus(companies, charities),
      companies: companies.data?.companies || [],
      charities: charities.data?.charities || [],
      sources: [meta(companies), meta(charities)],
    },
    safety: {
      status: sectionStatus(crime, food, cqcR),
      crime: passthrough(crime),
      foodHygiene: passthrough(food),
      cqc: passthrough(cqcR),
      sources: [meta(crime), meta(food), meta(cqcR)],
    },
    environment: {
      status: sectionStatus(flood, designationsR),
      source: flood.source,
      note: flood.note,
      // Statutory flood zone comes from planning.data.gov.uk; live warnings from
      // the Environment Agency.
      floodZone: designationsR.data?.floodZone ?? flood.data?.floodZone ?? null,
      floodWarnings: flood.data?.warnings || [],
      summary: flood.data?.summary,
    },

    foia: foiaStubs(ctx),
  };
}

function meta(r) {
  return { source: r.source, status: r.status, note: r.note, cached: !!r.cached, ms: r.ms };
}

/* ------------------------------ entrypoint ------------------------------ */

/**
 * @param {{ address?: string, lat?: number, lng?: number, postcode?: string }} input
 * @returns {Promise<{ ok: true, building } | { ok: false, status: number, error: string }>}
 */
export async function getBuilding(input) {
  if (!input.address && (input.lat == null || input.lng == null)) {
    return { ok: false, status: 400, error: "Provide ?address= or ?lat=&lng=" };
  }

  const resolved = await resolveIdentity(input);
  if (!resolved) {
    return { ok: false, status: 422, error: "Could not resolve that address to a location." };
  }
  const { identity, ctx } = resolved;

  const results = await Promise.all(REGISTRY.map((s) => runSource(s, ctx)));
  const byName = new Map(results.map((r) => [r.source, r]));

  const building = buildUnified(identity, byName, ctx);
  building.meta = {
    generatedAt: new Date().toISOString(),
    ctx,
    sources: results.map(meta),
  };

  // Cross-building risk recall (optional; only with SUPERMEMORY_API_KEY). Recall
  // BEFORE remembering so a building never matches itself.
  building.similar = await recallSimilar(building).catch(() => ({ enabled: false, matches: [] }));
  rememberBuilding(building).catch(() => {}); // fire-and-forget write for next time

  return { ok: true, building };
}

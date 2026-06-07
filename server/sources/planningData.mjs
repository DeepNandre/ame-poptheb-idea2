// Planning designations — planning.data.gov.uk (MHCLG's unified platform, open,
// no key). THE super-source: a point query returns every statutory planning
// designation that applies to a coordinate — conservation areas, listed-building
// outlines, Article 4 directions, tree-preservation zones, green belt,
// brownfield land, world heritage sites, scheduled monuments, historic parks —
// plus the statutory flood-risk zone. Replaces ~6 separate scrapers.
//
// We fetch the designation datasets as GeoJSON (`entity.geojson`) so a single set
// of calls yields BOTH the badge data (feature properties) AND the polygon
// geometry the map draws as coloured overlays. Flood is fetched as plain JSON
// (we only need the zone level; its national geometry is far too large to ship).
// Datasets fan into small PARALLEL batches because one all-datasets query can
// exceed 12 s at dense points; partial-tolerant if a batch times out.

import { getJson, ok, error } from "./util.mjs";

const ENTITY_JSON = "https://www.planning.data.gov.uk/entity.json";
const ENTITY_GEOJSON = "https://www.planning.data.gov.uk/entity.geojson";
const SOURCE = "planningData";

// Drawn datasets (useful polygon geometry), in small parallel batches.
const GEO_BATCHES = [
  ["conservation-area", "listed-building-outline", "article-4-direction-area"],
  ["world-heritage-site", "scheduled-monument", "park-and-garden"],
  ["tree-preservation-zone", "green-belt", "brownfield-land"],
];
const MAX_GEOMETRY_FEATURES = 16;

const LABEL = {
  "conservation-area": "Conservation area",
  "listed-building-outline": "Listed building",
  "article-4-direction-area": "Article 4 direction",
  "tree-preservation-zone": "Tree preservation zone",
  "green-belt": "Green belt",
  "brownfield-land": "Brownfield land",
  "world-heritage-site": "World Heritage Site",
  "scheduled-monument": "Scheduled monument",
  "park-and-garden": "Historic park / garden",
  "flood-risk-zone": "Flood risk zone",
};

function entityUrl(props) {
  return (
    props?.["documentation-url"] ||
    (props?.entity ? `https://www.planning.data.gov.uk/entity/${props.entity}` : undefined)
  );
}

// Returns GeoJSON features for a batch, or null if the request failed/timed out.
async function queryGeoBatch(datasets, ctx) {
  const p = new URLSearchParams();
  datasets.forEach((d) => p.append("dataset", d));
  p.set("latitude", String(ctx.lat));
  p.set("longitude", String(ctx.lng));
  p.set("limit", "30");
  const { ok: gotIt, data } = await getJson(`${ENTITY_GEOJSON}?${p.toString()}`, { timeoutMs: 15000 });
  return gotIt ? (Array.isArray(data?.features) ? data.features : []) : null;
}

async function queryFlood(ctx) {
  const p = new URLSearchParams();
  p.append("dataset", "flood-risk-zone");
  p.set("latitude", String(ctx.lat));
  p.set("longitude", String(ctx.lng));
  p.set("limit", "10");
  const { ok: gotIt, data } = await getJson(`${ENTITY_JSON}?${p.toString()}`, { timeoutMs: 15000 });
  return gotIt ? (Array.isArray(data?.entities) ? data.entities : []) : null;
}

async function resolveListedGrade(nhle) {
  if (!nhle) return { grade: null, url: null, name: null };
  const url = `${ENTITY_JSON}?dataset=listed-building&reference=${encodeURIComponent(nhle)}&limit=1`;
  const { ok: gotIt, data } = await getJson(url, { timeoutMs: 8000 });
  const e = gotIt ? data?.entities?.[0] : null;
  return {
    grade: e?.["listed-building-grade"] || null,
    url: e?.["documentation-url"] || null,
    name: e?.name || null,
  };
}

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query planning designations.");
  }

  const results = await Promise.all([
    ...GEO_BATCHES.map((b) => queryGeoBatch(b, ctx)),
    queryFlood(ctx),
  ]);
  const floodEnts = results.pop(); // last is flood
  const geoBatches = results;

  if (geoBatches.every((r) => r === null) && floodEnts === null) {
    return error(SOURCE, "planning.data.gov.uk did not respond.");
  }
  const failed = geoBatches.filter((r) => r === null).length;
  const features = geoBatches.filter(Boolean).flat();

  // Designation badges (deduped by dataset + name).
  const seen = new Set();
  const designations = [];
  for (const f of features) {
    const pr = f.properties || {};
    const name = pr.name || LABEL[pr.dataset] || pr.dataset;
    const k = `${pr.dataset}|${name}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    designations.push({
      dataset: pr.dataset,
      type: LABEL[pr.dataset] || pr.dataset,
      name,
      reference: pr.reference || null,
      url: entityUrl(pr),
    });
  }

  const conservationArea =
    features.find((f) => f.properties?.dataset === "conservation-area")?.properties?.name || null;

  // Listed building — from the outline containing the point; grade from the
  // listed-building dataset by NHLE reference.
  const outlines = features.filter((f) => f.properties?.dataset === "listed-building-outline");
  let listed = null;
  if (outlines.length) {
    const pr = outlines[0].properties || {};
    const nhle = pr["listed-building"] || null;
    const g = await resolveListedGrade(nhle);
    listed = {
      grade: g.grade,
      name: g.name || pr.name || "Listed building",
      nhle,
      url: g.url || entityUrl(pr),
      count: outlines.length,
    };
  }

  // Statutory flood zone — highest level among overlapping flood-risk-zone polys.
  let floodZone = null;
  if (Array.isArray(floodEnts) && floodEnts.length) {
    const top = floodEnts
      .map((e) => ({ level: Number(e["flood-risk-level"]), type: e["flood-risk-type"] || null }))
      .filter((x) => Number.isFinite(x.level))
      .sort((a, b) => b.level - a.level)[0];
    if (top) floodZone = { zone: String(top.level), type: top.type };
  }

  // Lean GeoJSON for the map overlay — geometry + minimal properties only.
  const geomFeatures = features
    .filter((f) => f.geometry)
    .slice(0, MAX_GEOMETRY_FEATURES)
    .map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        dataset: f.properties?.dataset,
        type: LABEL[f.properties?.dataset] || f.properties?.dataset,
        name: f.properties?.name || "",
      },
    }));

  return ok(
    SOURCE,
    {
      count: designations.length,
      designations,
      conservationArea,
      listed,
      floodZone,
      designationGeometry: geomFeatures.length
        ? { type: "FeatureCollection", features: geomFeatures }
        : null,
    },
    failed ? `${failed} designation group(s) timed out — list may be partial.` : undefined,
  );
}

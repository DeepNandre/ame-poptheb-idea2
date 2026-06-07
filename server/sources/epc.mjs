// Energy & floor area — EPC (Energy Performance Certificates), MHCLG /
// opendatacommunities (free, needs a key). Register at
// epc.opendatacommunities.org → email + key, sent as Basic auth base64(email:key).
// Without EPC_EMAIL + EPC_API_KEY this source reports `unavailable` — never mock.
//
// Returns the energy rating (A–G), total floor area (m²), property type and built
// form. Tries the domestic register first (homes), then the non-domestic register
// (commercial). Joins on UPRN when we have it, else postcode.

import { getJson, ok, unavailable, error } from "./util.mjs";

const BASE = "https://epc.opendatacommunities.org/api/v1";
const SOURCE = "epc";

function creds() {
  const email = process.env.EPC_EMAIL || "";
  const key = process.env.EPC_API_KEY || process.env.EPC_KEY || "";
  return email && key ? { email, key } : null;
}

function authHeader({ email, key }) {
  return "Basic " + Buffer.from(`${email}:${key}`).toString("base64");
}

function query(ctx) {
  const p = new URLSearchParams();
  if (ctx.uprn) p.set("uprn", ctx.uprn);
  else if (ctx.postcode) p.set("postcode", ctx.postcode);
  p.set("size", "20");
  return p.toString();
}

async function search(kind, ctx, auth) {
  const res = await getJson(`${BASE}/${kind}/search?${query(ctx)}`, {
    headers: { Authorization: auth, Accept: "application/json" },
    timeoutMs: 12000,
  });
  return res;
}

function mapDomestic(r) {
  return {
    register: "domestic",
    epcRating: r["current-energy-rating"] || null,
    potentialRating: r["potential-energy-rating"] || null,
    floorArea: r["total-floor-area"] ? Number(r["total-floor-area"]) : null,
    propertyType: r["property-type"] || null,
    builtForm: r["built-form"] || null,
    inspectionDate: r["inspection-date"] || r["lodgement-date"] || null,
    address: r.address || null,
    uprn: r.uprn || null,
  };
}

function mapNonDomestic(r) {
  return {
    register: "non-domestic",
    epcRating: r["asset-rating-band"] || null,
    assetRating: r["asset-rating"] ? Number(r["asset-rating"]) : null,
    floorArea: r["floor-area"] ? Number(r["floor-area"]) : null,
    propertyType: r["property-type"] || null,
    builtForm: null,
    inspectionDate: r["inspection-date"] || r["lodgement-date"] || null,
    address: r.address || null,
    uprn: r.uprn || null,
  };
}

export async function fetchSource(ctx) {
  const c = creds();
  if (!c) {
    return unavailable(
      SOURCE,
      "Add EPC_EMAIL + EPC_API_KEY (free at epc.opendatacommunities.org) for energy rating + floor area.",
    );
  }
  if (!ctx.uprn && !ctx.postcode) return error(SOURCE, "Need a UPRN or postcode for EPC.");

  const auth = authHeader(c);

  const dom = await search("domestic", ctx, auth);
  if (!dom.ok && dom.status === 401) return error(SOURCE, "EPC rejected the credentials (401).");
  let rows = (dom.ok && Array.isArray(dom.data?.rows) ? dom.data.rows : []).map(mapDomestic);

  // No home certificate → try the commercial register.
  if (rows.length === 0) {
    const nd = await search("non-domestic", ctx, auth);
    rows = (nd.ok && Array.isArray(nd.data?.rows) ? nd.data.rows : []).map(mapNonDomestic);
  }

  if (rows.length === 0) {
    return ok(SOURCE, { certificates: [], note: "No EPC lodged for this UPRN/postcode." });
  }

  // Newest certificate is the headline; keep the rest as history.
  rows.sort((a, b) => (b.inspectionDate || "").localeCompare(a.inspectionDate || ""));
  const latest = rows[0];

  return ok(SOURCE, {
    epcRating: latest.epcRating,
    potentialRating: latest.potentialRating || null,
    floorArea: latest.floorArea,
    propertyType: latest.propertyType,
    builtForm: latest.builtForm,
    inspectionDate: latest.inspectionDate,
    register: latest.register,
    certificates: rows.slice(0, 10),
  });
}

// Identity resolver — turns a raw address (or a map click's lat/lng) into the
// canonical building context every other source joins on:
//
//   { uprn?, address, postcode?, lat, lng, classification?, council?, ward?, region? }
//
// UPRN is the master key. The real UPRN + canonical address come from the
// Ordnance Survey Places API (OS Data Hub, free 50k/month) when OS_PLACES_KEY is
// set. Without that key we still resolve everything the coordinate/postcode
// sources need — coordinates from Mapbox geocoding (the token the map already
// uses) and postcode + council from postcodes.io (open, no key). So the engine
// is fully useful day one; UPRN and the canonical address simply switch on the
// moment a key is added. No mock data is ever substituted.

import { getJson, round, UA } from "./util.mjs";

const OS_FIND = "https://api.os.uk/search/places/v1/find";
const OS_NEAREST = "https://api.os.uk/search/places/v1/nearest";
const MAPBOX_GEOCODE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const POSTCODES_IO = "https://api.postcodes.io/postcodes";

function osKey() {
  return process.env.OS_PLACES_KEY || process.env.OS_DATA_HUB_KEY || "";
}
function mapboxToken() {
  return process.env.VITE_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || "";
}

/* ------------------------------ OS Places ------------------------------ */

// DPA = Delivery Point Address (a real postal address with a UPRN).
function fromDpa(dpa) {
  if (!dpa) return null;
  const lat = Number(dpa.LAT);
  const lng = Number(dpa.LNG);
  return {
    uprn: dpa.UPRN ? String(dpa.UPRN) : null,
    address: dpa.ADDRESS || null,
    postcode: dpa.POSTCODE || null,
    classification: dpa.CLASSIFICATION_CODE_DESCRIPTION || dpa.CLASSIFICATION_CODE || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

async function osByAddress(address) {
  const key = osKey();
  if (!key || !address) return null;
  const url =
    `${OS_FIND}?query=${encodeURIComponent(address)}` +
    `&maxresults=1&output_srs=EPSG:4326&key=${key}`;
  const { ok, data } = await getJson(url, { timeoutMs: 9000 });
  if (!ok) return null;
  return fromDpa(data?.results?.[0]?.DPA);
}

async function osByPoint(lat, lng) {
  const key = osKey();
  if (!key || lat == null || lng == null) return null;
  const url =
    `${OS_NEAREST}?point=${lat},${lng}&srs=EPSG:4326&output_srs=EPSG:4326&key=${key}`;
  const { ok, data } = await getJson(url, { timeoutMs: 9000 });
  if (!ok) return null;
  return fromDpa(data?.results?.[0]?.DPA);
}

/* ------------------------------ Mapbox ------------------------------ */

async function mapboxGeocode(address) {
  const token = mapboxToken();
  if (!token || !address) return null;
  const url =
    `${MAPBOX_GEOCODE}/${encodeURIComponent(address)}.json` +
    `?access_token=${token}&limit=1&language=en&country=gb&proximity=-0.1276,51.5072`;
  const { ok, data } = await getJson(url, { timeoutMs: 9000 });
  if (!ok) return null;
  const f = data?.features?.[0];
  if (!f?.center) return null;
  return { lat: f.center[1], lng: f.center[0], address: f.place_name || address };
}

/* ----------------------------- postcodes.io ----------------------------- */

function fromPostcodeRecord(r) {
  if (!r) return null;
  return {
    postcode: r.postcode || null,
    council: r.admin_district || null,
    ward: r.admin_ward || null,
    region: r.region || r.country || null,
    lat: typeof r.latitude === "number" ? r.latitude : null,
    lng: typeof r.longitude === "number" ? r.longitude : null,
  };
}

async function postcodesReverse(lat, lng) {
  if (lat == null || lng == null) return null;
  const url = `${POSTCODES_IO}?lon=${lng}&lat=${lat}&limit=1&radius=500`;
  const { ok, data } = await getJson(url, { timeoutMs: 8000 });
  if (!ok) return null;
  return fromPostcodeRecord(data?.result?.[0]);
}

async function postcodesLookup(postcode) {
  if (!postcode) return null;
  const url = `${POSTCODES_IO}/${encodeURIComponent(postcode.trim())}`;
  const { ok, data } = await getJson(url, { timeoutMs: 8000 });
  if (!ok) return null;
  return fromPostcodeRecord(data?.result);
}

/* ------------------------------ resolver ------------------------------ */

/**
 * Resolve the building context from whatever the caller has.
 * @param {{ address?: string, lat?: number, lng?: number, postcode?: string }} input
 * @returns {Promise<{ identity, ctx, provenance } | null>} null if coords can't be found.
 */
export async function resolveIdentity(input) {
  const address = (input.address || "").trim();
  let lat = input.lat != null ? Number(input.lat) : null;
  let lng = input.lng != null ? Number(input.lng) : null;
  let postcode = (input.postcode || "").trim() || null;

  const provenance = { coords: null, uprn: null, postcode: null };
  let uprn = null;
  let canonicalAddress = address || null;
  let classification = null;

  // 1) OS Places — real UPRN + canonical address + coords (only with a key).
  let os = null;
  if (address) os = await osByAddress(address);
  if (!os && lat != null && lng != null) os = await osByPoint(lat, lng);
  if (os) {
    uprn = os.uprn;
    canonicalAddress = os.address || canonicalAddress;
    classification = os.classification;
    if (os.lat != null && os.lng != null) {
      lat = os.lat;
      lng = os.lng;
      provenance.coords = "os-places";
    }
    if (os.postcode) {
      postcode = os.postcode;
      provenance.postcode = "os-places";
    }
    if (uprn) provenance.uprn = "os-places";
  }

  // 2) No coords yet → geocode the address with Mapbox (token already in env).
  if ((lat == null || lng == null) && address) {
    const mb = await mapboxGeocode(address);
    if (mb) {
      lat = mb.lat;
      lng = mb.lng;
      if (!canonicalAddress) canonicalAddress = mb.address;
      provenance.coords = "mapbox";
    }
  }

  // 3) Still no coords but we have a postcode → use its centroid.
  if ((lat == null || lng == null) && postcode) {
    const pc = await postcodesLookup(postcode);
    if (pc?.lat != null) {
      lat = pc.lat;
      lng = pc.lng;
      provenance.coords = "postcodes.io";
    }
  }

  // Can't place the building at all — caller returns 422.
  if (lat == null || lng == null) return null;

  // 4) Enrich postcode + council/ward/region from postcodes.io (free).
  let admin = null;
  if (postcode) admin = await postcodesLookup(postcode);
  if (!admin) admin = await postcodesReverse(lat, lng);
  if (admin) {
    if (!postcode && admin.postcode) {
      postcode = admin.postcode;
      provenance.postcode = "postcodes.io";
    }
  }

  const ctx = {
    uprn,
    address: canonicalAddress || address || null,
    postcode,
    lat: round(lat, 6),
    lng: round(lng, 6),
    classification,
    council: admin?.council || null,
    ward: admin?.ward || null,
    region: admin?.region || null,
  };

  const identity = {
    status: uprn ? "ok" : "partial",
    uprn,
    address: ctx.address,
    postcode: ctx.postcode,
    coordinates: { lat: ctx.lat, lng: ctx.lng },
    classification: ctx.classification,
    council: ctx.council,
    ward: ctx.ward,
    region: ctx.region,
    note: uprn
      ? undefined
      : "UPRN + canonical address require an OS Places key (OS_PLACES_KEY). Coordinates, postcode and council are resolved without it.",
  };

  return { identity, ctx, provenance };
}

// Used by the engine status endpoint so the UI can show what's wired.
export function resolverKeyStatus() {
  return { osPlaces: !!osKey(), mapbox: !!mapboxToken() };
}

export { UA };

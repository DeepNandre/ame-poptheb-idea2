// Care Quality Commission — care homes, hospitals, GP surgeries, dentists.
//
// Auth: free subscription key (Ocp-Apim-Subscription-Key) from the CQC developer
// portal (required since 2023). Without CQC_API_KEY this source reports
// `unavailable`. Only meaningful when the building is a registered care/health
// location — for anything else it simply returns an empty list. Joins on postcode.

import { getJson, ok, unavailable, error } from "./util.mjs";

const LOCATIONS = "https://api.service.cqc.org.uk/public/v1/locations";
const SOURCE = "cqc";

function key() {
  return process.env.CQC_API_KEY || process.env.CQC_PRIMARY_KEY || "";
}

export async function fetchSource(ctx) {
  const k = key();
  if (!k) {
    return unavailable(
      SOURCE,
      "Add CQC_API_KEY (free at the CQC developer portal) to surface care/health inspection ratings for this address.",
    );
  }
  if (!ctx.postcode) return error(SOURCE, "No postcode to query CQC locations.");

  const headers = { "Ocp-Apim-Subscription-Key": k };
  const listUrl = `${LOCATIONS}?postalCode=${encodeURIComponent(ctx.postcode)}&perPage=20&page=1`;
  const res = await getJson(listUrl, { headers, timeoutMs: 12000 });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      return error(SOURCE, "CQC rejected the key (auth failed).");
    return error(SOURCE, `CQC returned ${res.status || "no response"}.`);
  }

  const stubs = Array.isArray(res.data?.locations) ? res.data.locations : [];
  // Hydrate up to 8 locations for their current rating + type.
  const detailed = await Promise.all(
    stubs.slice(0, 8).map(async (s) => {
      if (!s.locationId) return null;
      const d = await getJson(`${LOCATIONS}/${encodeURIComponent(s.locationId)}`, {
        headers,
        timeoutMs: 9000,
      });
      const loc = d.ok ? d.data : null;
      return {
        name: loc?.name || s.locationName || "",
        type: loc?.type || null,
        rating: loc?.currentRatings?.overall?.rating || null,
        lastInspection: loc?.lastInspection?.date || null,
        registeredManager: loc?.registeredManagerAbsentDate ? null : undefined,
        url: s.locationId
          ? `https://www.cqc.org.uk/location/${s.locationId}`
          : undefined,
      };
    }),
  );

  const locations = detailed.filter(Boolean);
  return ok(SOURCE, { count: locations.length, locations });
}

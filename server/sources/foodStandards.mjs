// Food hygiene — Food Standards Agency (ratings.food.gov.uk, open, no key).
//
// Requires the header `x-api-version: 2`. We geo-search the establishments
// nearest the building so the result is the food businesses actually at/around
// this address (restaurants, takeaways, care kitchens, supermarkets…), each with
// its 0–5 hygiene rating. Joins on coordinates.

import { getJson, ok, error } from "./util.mjs";

const ESTABLISHMENTS = "https://api.ratings.food.gov.uk/Establishments";
const SOURCE = "foodHygiene";

function addressOf(e) {
  return [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.AddressLine4, e.PostCode]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");
}

export async function fetchSource(ctx) {
  if (ctx.lat == null || ctx.lng == null) {
    return error(SOURCE, "No coordinates to query food hygiene by location.");
  }

  const url =
    `${ESTABLISHMENTS}?latitude=${ctx.lat}&longitude=${ctx.lng}` +
    `&maxDistanceLimit=1&sortOptionKey=Distance&pageNumber=1&pageSize=20`;
  const res = await getJson(url, {
    headers: { "x-api-version": "2" },
    timeoutMs: 12000,
  });
  if (!res.ok) {
    return error(SOURCE, `FSA API returned ${res.status || "no response"}.`);
  }

  const list = Array.isArray(res.data?.establishments) ? res.data.establishments : [];
  const establishments = list.map((e) => {
    const numeric = Number(e.RatingValue);
    return {
      name: e.BusinessName || "",
      businessType: e.BusinessType || "",
      // RatingValue is "0".."5" in England/Wales/NI, or "Pass"/"Improvement
      // Required" in Scotland, or "AwaitingInspection"/"Exempt". Keep both.
      rating: e.RatingValue || null,
      ratingNumeric: Number.isFinite(numeric) ? numeric : null,
      ratingDate: e.RatingDate ? String(e.RatingDate).slice(0, 10) : null,
      address: addressOf(e),
      scores: e.scores
        ? {
            hygiene: e.scores.Hygiene ?? null,
            structural: e.scores.Structural ?? null,
            management: e.scores.ConfidenceInManagement ?? null,
          }
        : null,
    };
  });

  return ok(SOURCE, {
    count: establishments.length,
    establishments,
  });
}

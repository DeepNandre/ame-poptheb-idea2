// Deprivation — Index of Multiple Deprivation (IMD) via findthatpostcode.uk
// (open, no key). Deprivation is one of the strongest public correlates of
// property crime / arson / insurance claims, so it feeds the risk index. Joins
// on postcode → LSOA. findthatpostcode returns the English IMD rank; we convert
// it to a 1–10 decile (1 = most deprived 10%). Honest about nation coverage.

import { getJson, ok, unavailable, error } from "./util.mjs";

const BASE = "https://findthatpostcode.uk/postcodes";
const SOURCE = "deprivation";
const ENGLAND_LSOAS = 32844; // 2019 English IMD LSOA count

export async function fetchSource(ctx) {
  if (!ctx.postcode) {
    return unavailable(SOURCE, "Need a postcode for deprivation (IMD).");
  }
  const pc = ctx.postcode.replace(/\s+/g, "").toUpperCase();
  const { ok: gotIt, data, status } = await getJson(`${BASE}/${encodeURIComponent(pc)}.json`, {
    timeoutMs: 9000,
  });
  if (!gotIt) return error(SOURCE, `findthatpostcode returned ${status || "no response"}.`);

  const a = data?.data?.attributes || {};
  const rank = Number(a.imd);
  const lsoa = a.lsoa11 || a.lsoa21 || null;
  const lsoaName = a.lsoa11_name || a.lsoa21_name || null;
  if (!Number.isFinite(rank)) {
    return ok(SOURCE, { available: false, note: "No IMD value published for this area." });
  }

  const isEngland = String(lsoa || "").startsWith("E");
  const decile = isEngland
    ? Math.min(10, Math.max(1, Math.ceil(rank / (ENGLAND_LSOAS / 10))))
    : null;

  return ok(SOURCE, {
    imdRank: rank,
    decile, // 1 = most deprived 10%, 10 = least deprived
    lsoa,
    lsoaName,
    nation: isEngland ? "England (IMD 2019)" : "GB",
    note: isEngland
      ? undefined
      : "Deprivation rank reported; decile only computed for English LSOAs.",
  });
}

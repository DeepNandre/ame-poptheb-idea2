// Charities at this address — Charity Commission Register of Charities API.
//
// Auth: free subscription key (Ocp-Apim-Subscription-Key) from
// api-portal.charitycommission.gov.uk. Without CHARITY_COMMISSION_KEY this
// source reports `unavailable`.
//
// Honest limitation: the public API indexes by charity NAME/number, not by
// postcode, so a precise address join needs the bulk register extract. With a
// key we do a best-effort name search seeded from the council/area and filter by
// postcode where the registered-office postcode is returned; we never fabricate
// matches. Returns an empty list rather than guessing.

import { getJson, ok, unavailable, error } from "./util.mjs";

const SOURCE = "charities";
const BASE = "https://api.charitycommission.gov.uk/register/api";

function key() {
  return process.env.CHARITY_COMMISSION_KEY || process.env.CHARITY_API_KEY || "";
}

export async function fetchSource(ctx) {
  const k = key();
  if (!k) {
    return unavailable(
      SOURCE,
      "Add CHARITY_COMMISSION_KEY (free at api-portal.charitycommission.gov.uk) to list registered charities at this address.",
    );
  }
  // Name search needs a term; without a company/charity name to seed it the
  // postcode-only join isn't reliable on the public API — say so honestly.
  const term = (ctx.address || "").split(",")[0]?.trim();
  if (!term) {
    return unavailable(
      SOURCE,
      "Charity Commission public API joins by name/number, not postcode — needs the bulk register extract for an exact address match.",
    );
  }

  const headers = { "Ocp-Apim-Subscription-Key": k };
  const url = `${BASE}/searchCharityName/${encodeURIComponent(term)}`;
  const res = await getJson(url, { headers, timeoutMs: 12000 });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      return error(SOURCE, "Charity Commission rejected the key (auth failed).");
    return error(SOURCE, `Charity Commission returned ${res.status || "no response"}.`);
  }

  const wantPc = String(ctx.postcode || "").toUpperCase().replace(/\s+/g, "");
  const list = Array.isArray(res.data) ? res.data : [];
  const charities = list
    .filter((c) => {
      if (!wantPc) return false;
      const pc = String(c.postcode || c.registered_office_postcode || "")
        .toUpperCase()
        .replace(/\s+/g, "");
      return pc === wantPc;
    })
    .map((c) => ({
      name: c.charity_name || c.name || "",
      number: c.reg_charity_number || c.charity_number || c.organisation_number || "",
      activities: c.activities || null,
      postcode: c.postcode || null,
    }));

  return ok(SOURCE, {
    count: charities.length,
    charities,
    note:
      charities.length === 0
        ? "No registered-office postcode match. Exact address joins need the bulk register extract."
        : undefined,
  });
}

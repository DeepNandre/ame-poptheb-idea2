// Companies at this address — Companies House public data API.
//
// Auth: free API key used as the Basic-auth username with an empty password
// (Authorization: Basic base64(key:)). Register at
// developer.company-information.service.gov.uk. Without COMPANIES_HOUSE_KEY this
// source reports `unavailable` with the registration hint — never mock data.
//
// Joins on address: we search by postcode (tightest signal) and keep companies
// whose registered-office snippet contains that postcode.

import { getJson, ok, unavailable, error } from "./util.mjs";

const SEARCH = "https://api.company-information.service.gov.uk/search/companies";
const SOURCE = "companiesHouse";

function key() {
  return process.env.COMPANIES_HOUSE_KEY || process.env.COMPANIES_HOUSE_API_KEY || "";
}

function normalisePostcode(pc) {
  return String(pc || "").toUpperCase().replace(/\s+/g, "");
}

export async function fetchSource(ctx) {
  const k = key();
  if (!k) {
    return unavailable(
      SOURCE,
      "Add COMPANIES_HOUSE_KEY (free at developer.company-information.service.gov.uk) to list registered companies at this address.",
    );
  }
  const q = ctx.postcode || ctx.address;
  if (!q) return error(SOURCE, "No postcode or address to search companies by.");

  const auth = Buffer.from(`${k}:`).toString("base64");
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&items_per_page=30`;
  const res = await getJson(url, {
    headers: { Authorization: `Basic ${auth}` },
    timeoutMs: 12000,
  });
  if (!res.ok) {
    if (res.status === 401) return error(SOURCE, "Companies House rejected the key (401).");
    return error(SOURCE, `Companies House returned ${res.status || "no response"}.`);
  }

  const wantPc = normalisePostcode(ctx.postcode);
  const items = Array.isArray(res.data?.items) ? res.data.items : [];
  const companies = items
    .filter((it) => {
      if (!wantPc) return true;
      const snip = normalisePostcode(it.address_snippet || "");
      const ap = normalisePostcode(it.address?.postal_code || "");
      return snip.includes(wantPc) || ap === wantPc;
    })
    .map((it) => ({
      name: it.title || "",
      number: it.company_number || "",
      status: it.company_status || "",
      type: it.company_type || "",
      incorporated: it.date_of_creation || null,
      address: it.address_snippet || "",
      url: it.company_number
        ? `https://find-and-update.company-information.service.gov.uk/company/${it.company_number}`
        : undefined,
    }));

  return ok(SOURCE, { count: companies.length, companies });
}

// Council tax band + business rates — Valuation Office Agency.
//
// The VOA has no clean JSON API and its council-tax-band lookup is a
// session/POST-driven form (a GET to the results page 303-redirects back to the
// search), so there is nothing to fetch reliably. Rather than ship a brittle
// scraper or — worse — fabricate a band, this source stays honest: it reports
// `unavailable` and hands back one-click deep links to the official VOA tools,
// pre-seeded with the postcode. Same principle as the FOIA stubs.

import { unavailable, error } from "./util.mjs";

const SOURCE = "voa";

export async function fetchSource(ctx) {
  if (!ctx.postcode) {
    return error(SOURCE, "Need a postcode for the VOA council tax / rates lookup.");
  }
  const pc = ctx.postcode;
  const enc = encodeURIComponent(pc);
  return unavailable(
    SOURCE,
    "The VOA publishes no open API for council tax bands or rateable values — look them up directly:",
    {
      lookups: [
        {
          label: `Council tax band for ${pc}`,
          url: `https://www.tax.service.gov.uk/check-council-tax-band/search-postcode?postcode=${enc}`,
        },
        {
          label: `Business rates (rateable value) for ${pc}`,
          url: `https://www.tax.service.gov.uk/business-rates-find/search?postcode=${enc}`,
        },
      ],
    },
  );
}

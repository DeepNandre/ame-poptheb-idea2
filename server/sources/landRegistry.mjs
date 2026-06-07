// Ownership / sales history — HM Land Registry Price Paid Data (open, no key).
//
// Live SPARQL query against landRegistry.data.gov.uk for every recorded sale at
// the building's postcode (residential + the commercial "additional price paid"
// records), newest first. Joins on postcode; when the resolved address carries a
// house number (PAON) we flag the rows that are the same property so the UI can
// surface the building's own sales above the rest of the street.

import { ok, unavailable, error, UA } from "./util.mjs";

const SPARQL = "https://landregistry.data.gov.uk/landregistry/query";
const SOURCE = "landRegistry";

function buildQuery(postcode) {
  return `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?paon ?saon ?street ?town ?amount ?date ?category WHERE {
  VALUES ?postcode {"${postcode}"^^xsd:string}
  ?addr lrcommon:postcode ?postcode.
  ?tx lrppi:propertyAddress ?addr ;
      lrppi:pricePaid ?amount ;
      lrppi:transactionDate ?date ;
      lrppi:transactionCategory/skos:prefLabel ?category.
  OPTIONAL {?addr lrcommon:paon ?paon}
  OPTIONAL {?addr lrcommon:saon ?saon}
  OPTIONAL {?addr lrcommon:street ?street}
  OPTIONAL {?addr lrcommon:town ?town}
} ORDER BY DESC(?date) LIMIT 100`;
}

// Leading house number from the resolved address ("104, Pattinson Drive" -> 104).
function paonOf(address) {
  const first = String(address || "").split(",")[0].trim();
  const m = first.match(/^(\d+[A-Za-z]?)\b/);
  return m ? m[1].toUpperCase() : null;
}

export async function fetchSource(ctx) {
  if (!ctx.postcode) {
    return unavailable(SOURCE, "Need a postcode to query Land Registry sales history.");
  }
  const v = (x) => x?.value ?? null;

  let bindings;
  try {
    const url = `${SPARQL}?query=${encodeURIComponent(buildQuery(ctx.postcode.toUpperCase()))}`;
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return error(SOURCE, `Land Registry SPARQL returned ${res.status}.`);
    const json = await res.json();
    bindings = json?.results?.bindings || [];
  } catch (err) {
    return error(SOURCE, `Land Registry query failed: ${String(err?.message || err)}`);
  }

  const wantPaon = paonOf(ctx.address);
  let matched = 0;
  const salesHistory = bindings.map((b) => {
    const paon = v(b.paon);
    const address = [v(b.saon), paon, v(b.street), v(b.town)].filter(Boolean).join(" ");
    const sameBuilding = !!wantPaon && paon != null && paon.toUpperCase() === wantPaon;
    if (sameBuilding) matched++;
    return {
      date: v(b.date),
      price: Number(v(b.amount)) || null,
      address,
      category: v(b.category),
      sameBuilding,
    };
  });

  // Surface this building's own sales first when we could identify it.
  salesHistory.sort((a, b) => {
    if (a.sameBuilding !== b.sameBuilding) return a.sameBuilding ? -1 : 1;
    return (b.date || "").localeCompare(a.date || "");
  });

  const lastSale = salesHistory.find((s) => s.sameBuilding) || salesHistory[0] || null;

  return ok(SOURCE, {
    count: salesHistory.length,
    scope: matched > 0 ? "building" : "postcode",
    matchedAddress: matched,
    lastSale: lastSale ? { date: lastSale.date, price: lastSale.price, address: lastSale.address } : null,
    salesHistory: salesHistory.slice(0, 40),
  });
}

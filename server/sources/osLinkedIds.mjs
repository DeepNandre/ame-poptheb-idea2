// OS Linked Identifiers — Ordnance Survey Data Hub (free OpenData API).
//
// Given the building's UPRN, this returns the authoritative links to its OS
// MasterMap TOID (the persistent topographic-feature id of the building) and the
// USRN of the street it sits on. One OS Data Hub key (OS_PLACES_KEY) unlocks
// Places + Names + Linked Identifiers — they share a project key. We only have a
// UPRN when OS Places resolved it, so this lights up alongside Places; without
// the key (or a UPRN) it reports `unavailable`. Never mock.
//
// Endpoint: GET https://api.os.uk/search/links/v1/identifiers/{uprn}?key=...
// Response nests correlated identifiers tagged with a TOID/USRN/UPRN type enum.

import { getJson, ok, unavailable, error } from "./util.mjs";

const BASE = "https://api.os.uk/search/links/v1/identifiers";
const SOURCE = "osLinkedIds";

function osKey() {
  return process.env.OS_PLACES_KEY || process.env.OS_DATA_HUB_KEY || "";
}

// Walk the (slightly variable) response and collect identifiers by type.
function collect(data) {
  const out = { TOID: new Set(), USRN: new Set(), UPRN: new Set() };
  const lists = [];
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 6) return;
    if (Array.isArray(node.linkedIdentifiers)) lists.push(...node.linkedIdentifiers);
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v === "object") visit(v, depth + 1);
    }
  };
  visit(data, 0);

  const add = (type, id) => {
    if (type && out[type] && id != null) out[type].add(String(id));
  };
  for (const li of lists) {
    const self = li.linkedIdentifier;
    if (self?.identifierType) add(self.identifierType, self.identifier);
    for (const corr of li.correlations || []) {
      for (const ci of corr.correlatedIdentifiers || []) {
        add(ci.correlatedIdentifierType || ci.identifierType, ci.identifier);
      }
    }
  }
  return out;
}

export async function fetchSource(ctx) {
  const key = osKey();
  if (!key) {
    return unavailable(
      SOURCE,
      "Add OS_PLACES_KEY (free OS Data Hub) — the same key also unlocks OS Linked Identifiers (TOID + USRN).",
    );
  }
  if (!ctx.uprn) {
    return unavailable(
      SOURCE,
      "No UPRN resolved — OS Places (OS_PLACES_KEY) must provide the UPRN before linked identifiers can be looked up.",
    );
  }

  const url = `${BASE}/${encodeURIComponent(ctx.uprn)}?key=${encodeURIComponent(key)}`;
  const res = await getJson(url, { timeoutMs: 9000 });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return error(SOURCE, "OS rejected the key — add the Linked Identifiers API to your Data Hub project.");
    }
    return error(SOURCE, `OS Linked Identifiers returned ${res.status || "no response"}.`);
  }

  const c = collect(res.data);
  return ok(SOURCE, {
    toid: [...c.TOID][0] || null,
    usrn: [...c.USRN][0] || null,
    toidCount: c.TOID.size,
    usrnCount: c.USRN.size,
  });
}

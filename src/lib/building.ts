// Client for the Building Intelligence Engine (/api/building).
//
// One call returns the full UnifiedBuilding — every public source aggregated
// server-side, so the browser makes a single same-origin request and never
// touches an API key or a CORS wall. Missing keys come back as honest
// `unavailable` sections; nothing here is mock data.

export type SectionStatus = "ok" | "partial" | "unavailable" | "error";

export interface Identity {
  status: "ok" | "partial";
  uprn: string | null;
  toid?: string | null;
  usrn?: string | null;
  address: string | null;
  postcode: string | null;
  coordinates: { lat: number; lng: number };
  classification: string | null;
  council: string | null;
  ward: string | null;
  region: string | null;
  note?: string;
}

export interface CrimeData {
  status: SectionStatus;
  source: string;
  note?: string;
  total?: number;
  month?: string | null;
  radiusMiles?: number;
  topCategory?: string | null;
  byCategory?: { category: string; count: number }[];
  points?: { lat: number; lng: number; category: string }[];
}

export interface FoodEstablishment {
  name: string;
  businessType: string;
  rating: string | null;
  ratingNumeric: number | null;
  ratingDate: string | null;
  address: string;
  scores: { hygiene: number | null; structural: number | null; management: number | null } | null;
}

export interface FoodData {
  status: SectionStatus;
  source: string;
  note?: string;
  count?: number;
  establishments?: FoodEstablishment[];
}

export interface CqcLocation {
  name: string;
  type: string | null;
  rating: string | null;
  lastInspection: string | null;
  url?: string;
}

export interface CqcData {
  status: SectionStatus;
  source: string;
  note?: string;
  count?: number;
  locations?: CqcLocation[];
}

export interface PlanningApplication {
  ref: string;
  name: string;
  description: string;
  council: string;
  url: string;
  appType?: string;
  state?: string;
  address?: string;
  lat?: number;
  lng?: number;
  date?: string;
}

export interface Company {
  name: string;
  number: string;
  status: string;
  type: string;
  incorporated: string | null;
  address: string;
  url?: string;
}

export interface Charity {
  name: string;
  number: string;
  activities: string | null;
  postcode: string | null;
}

export interface FloodWarning {
  severity: string;
  severityLevel: number | null;
  area: string;
  message: string;
  raised: string | null;
}

export interface Designation {
  dataset: string;
  type: string;
  name: string;
  reference: string | null;
  url?: string;
}

export interface ListedBuilding {
  grade: string | null;
  name: string;
  nhle: string | null;
  url?: string;
  count: number;
}

export interface FloodZone {
  zone: string;
  type: string | null;
}

export interface Sale {
  date: string | null;
  price: number | null;
  address: string;
  category: string | null;
  sameBuilding: boolean;
}

export interface EpcCertificate {
  register: string;
  epcRating: string | null;
  floorArea: number | null;
  propertyType: string | null;
  builtForm: string | null;
  inspectionDate: string | null;
  address: string | null;
  uprn: string | null;
}

export interface TransportStop {
  name: string;
  modes: string[];
  lines: string[];
  distanceM: number | null;
}

export interface VoaLookup {
  label: string;
  url: string;
}

export interface DesignationFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: { dataset: string; type: string; name: string };
}

export interface DesignationGeometry {
  type: "FeatureCollection";
  features: DesignationFeature[];
}

export interface FoiaStub {
  field: string;
  status: "request-only";
  authority?: string;
  template: string;
}

export interface SourceMeta {
  source: string;
  status: SectionStatus;
  note?: string;
  cached: boolean;
  ms: number;
}

export interface RiskFactor {
  key: string;
  label: string;
  weight: number;
  score: number;
  basis: string;
}

export interface Risk {
  status: SectionStatus;
  score: number;
  band: string;
  factors: RiskFactor[];
  note: string;
}

export interface UnifiedBuilding {
  identity: Identity;
  risk: Risk;
  ground: {
    status: SectionStatus;
    note?: string;
    available: boolean;
    overall: { severity: number; label: string; hazard: string | null; name: string | null } | null;
    hazards: Record<string, { severity: number; label: string; name: string }> | null;
    mining: { severity: number; label: string } | null;
    radon: { band: number; label: string; severity: number } | null;
    distanceKm: number | null;
  };
  deprivation: {
    status: SectionStatus;
    note?: string;
    decile: number | null;
    imdRank: number | null;
    lsoa: string | null;
    lsoaName: string | null;
    nation: string | null;
  };
  ownership: {
    status: SectionStatus;
    source?: string;
    note?: string;
    scope?: "building" | "postcode";
    matchedAddress?: number;
    lastSale: { date: string | null; price: number | null; address: string } | null;
    salesHistory: Sale[];
  };
  building: {
    status: SectionStatus;
    source?: string;
    note?: string;
    epcRating: string | null;
    potentialRating: string | null;
    floorArea: number | null;
    propertyType: string | null;
    builtForm: string | null;
    inspectionDate: string | null;
    register?: string;
    certificates: EpcCertificate[];
  };
  financial: {
    status: SectionStatus;
    source?: string;
    note?: string;
    councilTaxBand: string | null;
    businessRates: unknown;
    lookups: VoaLookup[];
  };
  transport: {
    status: SectionStatus;
    source?: string;
    note?: string;
    connectivityScore: number | null;
    stopCount?: number;
    modes: string[];
    nearbyStops: TransportStop[];
  };
  planning: {
    status: SectionStatus;
    note?: string;
    applications: PlanningApplication[];
    designations: Designation[];
    designationGeometry: DesignationGeometry | null;
    listed: ListedBuilding | null;
    conservationArea: string | null;
    sources?: SourceMeta[];
  };
  occupants: {
    status: SectionStatus;
    companies: Company[];
    charities: Charity[];
    sources: SourceMeta[];
  };
  safety: {
    status: SectionStatus;
    crime: CrimeData;
    foodHygiene: FoodData;
    cqc: CqcData;
    sources: SourceMeta[];
  };
  environment: {
    status: SectionStatus;
    source?: string;
    note?: string;
    floodZone: FloodZone | null;
    floodWarnings: FloodWarning[];
    summary?: string;
  };
  foia: FoiaStub[];
  meta: { generatedAt: string; ctx: Record<string, unknown>; sources: SourceMeta[] };
}

export interface BuildingQuery {
  address?: string;
  lat?: number;
  lng?: number;
  postcode?: string;
}

// Module-level cache so re-opening a building's Intelligence tab is instant and
// doesn't re-hit the engine (the server caches too, but this avoids the round
// trip entirely within a session).
const memo = new Map<string, Promise<UnifiedBuilding>>();

function keyOf(q: BuildingQuery): string {
  return q.lat != null && q.lng != null
    ? `${q.lat.toFixed(5)},${q.lng.toFixed(5)}`
    : (q.address || q.postcode || "").toLowerCase().trim();
}

export async function fetchBuilding(q: BuildingQuery): Promise<UnifiedBuilding> {
  const key = keyOf(q);
  const hit = memo.get(key);
  if (hit) return hit;

  const params = new URLSearchParams();
  if (q.address) params.set("address", q.address);
  if (q.lat != null && q.lng != null) {
    params.set("lat", String(q.lat));
    params.set("lng", String(q.lng));
  }
  if (q.postcode) params.set("postcode", q.postcode);

  const p = (async () => {
    const res = await fetch(`/api/building?${params.toString()}`);
    if (!res.ok) {
      let msg = `Building lookup failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(msg);
    }
    return (await res.json()) as UnifiedBuilding;
  })();

  memo.set(key, p);
  // Don't cache failures — let the next open retry.
  p.catch(() => memo.delete(key));
  return p;
}

/* ----------------------- intelligence Q&A helpers ----------------------- */

export type BuildingFacts = ReturnType<typeof summarizeForAnswer>;

const live = (s: SectionStatus) => s === "ok" || s === "partial";

/**
 * Compact, REAL-ONLY facts for the answer model — drops geometry and raw point
 * arrays, and marks each key-gated/empty section as "unavailable" (with its note)
 * so the model truthfully says when something isn't known rather than inventing.
 */
export function summarizeForAnswer(b: UnifiedBuilding) {
  const crime = b.safety.crime;
  const food = b.safety.foodHygiene;
  const cqc = b.safety.cqc;
  const occNote = b.occupants.sources?.find((s) => s.note)?.note;

  return {
    address: b.identity.address,
    postcode: b.identity.postcode,
    council: b.identity.council,
    uprn: b.identity.uprn,
    toid: b.identity.toid ?? null,
    riskIndex: `${b.risk.score}/100 (${b.risk.band})`,
    riskFactors: b.risk.factors.map((f) => `${f.label}: ${f.score}/100 — ${f.basis}`),
    groundStability:
      b.ground.available && b.ground.overall
        ? `worst: ${b.ground.overall.name} = ${b.ground.overall.label}` +
          (b.ground.hazards
            ? ` (${Object.values(b.ground.hazards)
                .filter((h) => h.severity >= 2)
                .map((h) => `${h.name} ${h.label}`)
                .join(", ") || "others low"})`
            : "")
        : b.ground.note || "unavailable",
    mining: b.ground.mining ? b.ground.mining.label : "unavailable",
    radon: b.ground.radon ? `band ${b.ground.radon.band}/6 — ${b.ground.radon.label} of homes above the radon action level` : "unavailable",
    deprivation:
      b.deprivation.decile != null
        ? `IMD decile ${b.deprivation.decile}/10 (1 = most deprived), ${b.deprivation.nation}`
        : "unavailable",
    listed: b.planning.listed
      ? b.planning.listed.grade
        ? `Grade ${b.planning.listed.grade} listed (${b.planning.listed.name})`
        : "listed (ungraded)"
      : live(b.planning.status)
        ? "not listed"
        : "unavailable",
    conservationArea: b.planning.conservationArea,
    designations: b.planning.designations.map((d) =>
      d.name && d.name !== d.type ? `${d.type}: ${d.name}` : d.type,
    ),
    planningApplications: b.planning.applications.length,
    floodZone: b.environment.floodZone
      ? `Zone ${b.environment.floodZone.zone}${b.environment.floodZone.type ? ` (${b.environment.floodZone.type})` : ""}`
      : live(b.environment.status)
        ? "not in a mapped flood-risk zone"
        : "unavailable",
    activeFloodWarnings: b.environment.floodWarnings.length,
    crime:
      crime.status === "ok"
        ? { total: crime.total ?? 0, month: crime.month ?? null, radiusMiles: crime.radiusMiles ?? 1, topCategories: (crime.byCategory ?? []).slice(0, 5) }
        : "unavailable",
    foodHygiene:
      food.status === "ok"
        ? { ratedBusinesses: food.count ?? food.establishments?.length ?? 0 }
        : "unavailable",
    cqc: cqc.status === "ok" ? { locations: cqc.count ?? cqc.locations?.length ?? 0 } : cqc.note || "unavailable",
    ownership: live(b.ownership.status)
      ? { lastSale: b.ownership.lastSale, recordedSales: b.ownership.salesHistory.length, scope: b.ownership.scope ?? null }
      : b.ownership.note || "unavailable",
    epc: live(b.building.status)
      ? { rating: b.building.epcRating, floorAreaM2: b.building.floorArea, propertyType: b.building.propertyType }
      : b.building.note || "unavailable (needs an EPC key)",
    councilTaxAndRates: b.financial.note || "unavailable — VOA has no open API; use the official lookup",
    transport: b.transport.status === "ok"
      ? {
          connectivityScore: b.transport.connectivityScore,
          stopsWithin800m: b.transport.stopCount ?? b.transport.nearbyStops.length,
          modes: b.transport.modes,
          nearest: b.transport.nearbyStops[0]
            ? `${b.transport.nearbyStops[0].name} (${b.transport.nearbyStops[0].distanceM}m)`
            : null,
        }
      : b.transport.note || "unavailable",
    occupants: live(b.occupants.status)
      ? { companies: b.occupants.companies.length, charities: b.occupants.charities.length }
      : occNote || "unavailable (needs a Companies House key)",
  };
}

/** Facts-only answer when no LLM key is configured. States only present facts. */
export function deterministicAnswer(f: BuildingFacts): string {
  const s: string[] = [];
  s.push(`${f.address || "This location"}${f.postcode ? ` (${f.postcode})` : ""}${f.council ? `, ${f.council}` : ""}.`);
  if (typeof f.listed === "string" && f.listed.startsWith("Grade")) s.push(`It's a ${f.listed}.`);
  else if (f.listed === "not listed") s.push("It isn't a listed building.");
  if (f.conservationArea) s.push(`It sits in the ${f.conservationArea} conservation area.`);
  if (typeof f.floodZone === "string" && f.floodZone.startsWith("Zone")) s.push(`Flood risk: Flood ${f.floodZone}.`);
  if (f.crime && typeof f.crime === "object") {
    const top = f.crime.topCategories?.[0];
    s.push(
      `${f.crime.total} crimes were recorded within ${f.crime.radiusMiles} mile${f.crime.month ? ` in ${f.crime.month}` : ""}${top ? `, mostly ${top.category.toLowerCase()}` : ""}.`,
    );
  }
  if (f.transport && typeof f.transport === "object") {
    s.push(
      `Transport connectivity scores ${f.transport.connectivityScore}/100${f.transport.nearest ? ` — nearest stop ${f.transport.nearest}` : ""}.`,
    );
  }
  if (f.ownership && typeof f.ownership === "object" && f.ownership.lastSale?.price) {
    s.push(
      `Last recorded sale: £${f.ownership.lastSale.price.toLocaleString()}${f.ownership.lastSale.date ? ` (${f.ownership.lastSale.date})` : ""}.`,
    );
  }
  return s.join(" ");
}

// Command-bar brain (client). Turns a natural-language command into a structured
// plan: "navigate" (fly the map), "investigate" (surface a building's public
// planning record), or "recon" (corporate OSINT + live wireless correlation).
//
// The LLM call is proxied through the server (/api/agent/interpret) so the
// OpenRouter key never reaches the browser. When the server has no key — or is
// unreachable — we fall back to a local keyword parser so navigation still works.

export type Intent = "navigate" | "investigate" | "recon" | "intelligence";

export interface CommandPlan {
  intent: Intent;
  /** A geocodable place string for the map. */
  place: string;
  /** The building of interest, when the user wants its drawings. */
  building: string | null;
  /** Optional IP/CIDR for building CCTV scan. */
  ipRange: string | null;
  /** Likely UK local planning authority, if the model can infer one. */
  council: string | null;
  /** One-line explanation, shown back to the user. */
  rationale: string;
  source: "llm" | "keyword";
}

/** Shape returned by the model (pre-normalization). */
interface RawPlan {
  intent?: string;
  place?: string;
  building?: string | null;
  ipRange?: string | null;
  council?: string | null;
  rationale?: string;
}

/** Probe whether the server has an LLM configured (drives the command-bar badge). */
export async function getLlmStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/agent/status");
    if (!res.ok) return false;
    const data = (await res.json()) as { llm?: boolean };
    return Boolean(data.llm);
  } catch {
    return false;
  }
}

export async function interpretCommand(query: string): Promise<CommandPlan> {
  try {
    const res = await fetch("/api/agent/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(16000),
    });
    if (res.ok) {
      const data = (await res.json()) as { plan?: RawPlan };
      if (data.plan) return normalizeLlmPlan(data.plan, query);
    }
  } catch {
    // network / timeout / no-key → degrade gracefully to the keyword parser
  }
  return keywordInterpret(query);
}

function normalizeLlmPlan(parsed: RawPlan, query: string): CommandPlan {
  const intent: Intent =
    parsed.intent === "investigate"
      ? "investigate"
      : parsed.intent === "recon"
        ? "recon"
        : parsed.intent === "intelligence"
          ? "intelligence"
          : "navigate";
  const place = (parsed.place || parsed.building || query).toString().trim();
  const ipRange = parsed.ipRange ? String(parsed.ipRange) : extractIpRange(query);

  return {
    intent,
    place,
    building: parsed.building
      ? String(parsed.building)
      : intent === "investigate" || intent === "intelligence"
        ? place
        : null,
    ipRange,
    council: parsed.council ? String(parsed.council) : null,
    rationale: parsed.rationale ? String(parsed.rationale) : defaultRationale(intent, place),
    source: "llm",
  };
}

const INVESTIGATE_HINTS = [
  "drawing",
  "plan",
  "schematic",
  "floor",
  "section",
  "das",
  "blueprint",
  "inside",
  "interior",
  "layout",
  "elevation",
  "core",
  "entrance",
  "ga ",
  "scan",
];

const RECON_HINTS = [
  "recon",
  "corporate",
  "employee",
  "employees",
  "staff",
  "people here",
  "who works",
  "osint",
  "intel",
  "social engineering",
  "subdomain",
  "exposed",
  "tech stack",
  "devices in the building",
  "who is here",
  "cctv",
  "camera",
  "cameras",
  "rtsp",
  "surveillance",
];

// Questions about a building's public record (no LLM needed to route these).
const INTELLIGENCE_HINTS = [
  "crime",
  "how safe",
  "safe",
  "safety",
  "flood",
  "listed",
  "conservation",
  "heritage",
  "article 4",
  "who owns",
  "owner",
  "owns",
  "sold",
  "sale price",
  "sold for",
  "price paid",
  "epc",
  "energy rating",
  "council tax",
  "business rates",
  "rateable",
  "transport",
  "nearest station",
  "tube",
  "stations",
  "companies",
  "registered here",
  "charity",
  "charities",
  "hygiene",
  "food rating",
  "tell me about",
  "what do you know",
  "intel on",
  "designation",
  "green belt",
];

const IP_RANGE_RE =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3})(?:\/(?:[0-9]|[12][0-9]|3[0-2]))?\b/;

function extractIpRange(text: string): string | null {
  const m = text.match(IP_RANGE_RE);
  return m ? m[0] : null;
}

function keywordInterpret(query: string): CommandPlan {
  const q = query.trim();
  const lower = q.toLowerCase();
  let intent: Intent = "navigate";
  if (RECON_HINTS.some((h) => lower.includes(h))) {
    intent = "recon";
  } else if (INTELLIGENCE_HINTS.some((h) => lower.includes(h))) {
    intent = "intelligence";
  } else if (INVESTIGATE_HINTS.some((h) => lower.includes(h))) {
    intent = "investigate";
  } else {
    intent = "navigate";
  }

  let place = q
    .replace(
      /^(take me to|fly to|go to|navigate to|show me|find|search for|where is|locate|scan|tell me about|what do you know about|how safe is|is|are|does|what'?s|whats)\s+/i,
      "",
    )
    .replace(
      /\b(floor ?plans?|schematics?|drawings?|sections?|das|blueprints?|ga plans?|the inside|interior|layout|elevations?)\b/gi,
      "",
    )
    // strip intelligence topic words so the place geocodes cleanly in fallback
    .replace(
      /\b(listed|conservation area|flood zones?|flood risk|crime|how safe|safety|epc|energy rating|council tax|business rates|rateable value|transport|nearest (tube|station)|companies|charities|food hygiene|hygiene|owns?|owner|who owns|sold for|sale price)\b/gi,
      "",
    )
    .replace(/\bof\b/gi, " ")
    .replace(/[?]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!place) place = q;

  const buildingForRecon = intent === "recon" ? place : null;

  return {
    intent,
    place,
    building: intent === "investigate" || intent === "intelligence" ? place : buildingForRecon,
    ipRange: extractIpRange(q),
    council: null,
    rationale: defaultRationale(intent, place),
    source: "keyword",
  };
}

function defaultRationale(intent: Intent, place: string): string {
  if (intent === "recon") return `Running corporate OSINT and live device correlation for ${place}.`;
  if (intent === "investigate") return `Locating ${place} and looking for its public planning record.`;
  if (intent === "intelligence") return `Pulling every public record for ${place} to answer that.`;
  return `Flying to ${place}.`;
}

/**
 * Compose a grounded natural-language answer from a building's intelligence facts.
 * Proxied through the server (/api/agent/answer) so the model only ever sees the
 * real fetched data. Returns null on no-key/failure so the caller can fall back to
 * the deterministic facts-only summary.
 */
export async function answerBuilding(query: string, facts: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/agent/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, facts }),
      signal: AbortSignal.timeout(24000),
    });
    if (res.ok) {
      const data = (await res.json()) as { answer?: string };
      if (data.answer) return data.answer.trim();
    }
  } catch {
    // no key / network / timeout → caller uses the deterministic fallback
  }
  return null;
}

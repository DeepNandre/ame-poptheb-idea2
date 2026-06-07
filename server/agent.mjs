// Command-bar "brain" — server-side OpenRouter proxy.
//
// The OpenRouter API key lives ONLY on the server. The browser never sees it;
// it POSTs the user's command to /api/agent/interpret and gets back a structured
// plan. Without a key the endpoint returns 503 and the client uses its built-in
// keyword parser, so navigation still works offline.
//
//   GET  /api/agent/status     -> { llm: boolean, model: string }
//   POST /api/agent/interpret  -> { plan: {...}, source: "llm" }   (body: { query })
import { loadProjectEnv } from "./scannerRelay.mjs";

loadProjectEnv();

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";

function getKey() {
  // VITE_ prefix accepted only for backward-compat with older .env.local files.
  return process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "";
}

function getModel() {
  return process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || DEFAULT_MODEL;
}

const SYSTEM = `You are the routing brain for "Building Scanner", a tool that surfaces the PUBLIC UK planning record and also runs passive corporate OSINT / social-engineering recon on buildings (employees, subdomains, exposed devices, tech stack, and live wireless correlation).

Given one user command, reply with ONLY a JSON object:
{
  "intent": "navigate" | "investigate" | "recon" | "intelligence",
  "place": string,        // a precise, geocodable place/address string for a map (append ", London, UK" or the right city if it helps disambiguate)
  "building": string|null, // the specific building or company of interest
  "ipRange": string|null,  // IP or CIDR for CCTV scan when mentioned
  "council": string|null,  // best guess at the UK local planning authority, or null
  "rationale": string      // one short sentence describing what you're doing
}

Rules:
- "navigate": just move the camera. The user only wants to GO somewhere — "take me to", "fly to", "show me", "go to" with no question.
- "investigate": user wants planning drawings, floor plans, sections, "what's inside" the building.
- "recon": user wants corporate intelligence — who works here, employee emails, subdomains, tech stack, exposed infrastructure, CCTV cameras on the building network, or "who is in the building right now" using the live wireless scan. Trigger on words like recon, corporate, employees, staff, people here, osint, social engineering, intel on the company/tenants, cctv, cameras, rtsp.
- "intelligence": user asks a QUESTION about a building's public record — crime/safety ("how safe", "crime here"), flood risk / flood zone, listed status / heritage / conservation area / Article 4, ownership / who owns it / sold for / sale price, EPC / energy rating / floor area, council tax band / business rates, transport / nearby stations / tube, companies or charities registered there, or open-ended "tell me about / what do you know about / give me intel on" a specific BUILDING (not a company's staff). Put the building/address in "place" and "building".
- Prefer "intelligence" over "navigate" whenever the command is phrased as a question or asks ABOUT a place rather than only to move there.
- "place" / "building" should contain the company name or building when doing recon (e.g. "Acme Corp", "Bankside Yards", "Arbor").
- If the user mentions an IP address or CIDR (e.g. 192.168.1.0/24), put it in "ipRange".
- Output JSON only, no prose, no code fences.`;

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 8192) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > limit) {
        data = data.slice(0, limit);
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

function stripFences(text) {
  return String(text)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

async function callOpenRouter(query) {
  const key = getKey();
  if (!key) return { ok: false, status: 503, error: "LLM not configured" };

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://building-scanner.local",
        "X-Title": "Building Scanner",
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: query },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return { ok: false, status: 502, error: `OpenRouter request failed: ${e?.message || e}` };
  }

  if (!res.ok) return { ok: false, status: 502, error: `OpenRouter ${res.status}` };

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    return { ok: true, plan: JSON.parse(stripFences(raw)) };
  } catch {
    return { ok: false, status: 502, error: "Model returned unparseable JSON" };
  }
}

// Grounded Q&A over the building-intelligence facts. The model may use ONLY the
// supplied FACTS — this is what keeps answers honest (no invented crime numbers,
// flood zones, or listings). Missing/key-gated fields must be reported as such.
const ANSWER_SYSTEM = `You answer a user's question about ONE UK building using ONLY the FACTS provided as JSON.

Rules:
- Use ONLY the FACTS. Never invent, guess, or estimate. Do not use outside knowledge.
- If the answer isn't in the FACTS, or a field is null / marked "unavailable", say it's not available — and if the FACTS note that a field needs an API key, say so briefly.
- Be concise: 2-4 sentences of plain prose. No markdown, no bullet points, no headings.
- Answer the user's actual question first, then add the 1-2 most relevant supporting facts.
- Cite the specific values from the FACTS (crime count + month, flood zone, listing grade, sale price + date, EPC rating, connectivity score, etc.).
- Neutral, factual tone. Do not editorialise or give advice.`;

async function callOpenRouterAnswer(query, facts) {
  const key = getKey();
  if (!key) return { ok: false, status: 503, error: "LLM not configured" };

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://building-scanner.local",
        "X-Title": "Building Scanner",
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0,
        messages: [
          { role: "system", content: ANSWER_SYSTEM },
          {
            role: "user",
            content: `Question: ${query}\n\nFACTS (JSON):\n${JSON.stringify(facts).slice(0, 8000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { ok: false, status: 502, error: `OpenRouter request failed: ${e?.message || e}` };
  }

  if (!res.ok) return { ok: false, status: 502, error: `OpenRouter ${res.status}` };

  const data = await res.json();
  const answer = (data?.choices?.[0]?.message?.content ?? "").trim();
  if (!answer) return { ok: false, status: 502, error: "Model returned an empty answer" };
  return { ok: true, answer };
}

export async function agentMiddleware(req, res, next) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/agent/")) return next();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (url.pathname === "/api/agent/status") {
    return json(res, 200, { llm: !!getKey(), model: getModel() });
  }

  if (url.pathname === "/api/agent/interpret") {
    if (req.method !== "POST") return json(res, 405, { error: "Use POST" });
    let query;
    try {
      const body = await readBody(req);
      query = JSON.parse(body || "{}").query;
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }
    if (!query || typeof query !== "string") {
      return json(res, 400, { error: "Missing 'query' string" });
    }
    const result = await callOpenRouter(query.slice(0, 2000));
    if (!result.ok) return json(res, result.status, { error: result.error });
    return json(res, 200, { plan: result.plan, source: "llm" });
  }

  if (url.pathname === "/api/agent/answer") {
    if (req.method !== "POST") return json(res, 405, { error: "Use POST" });
    let body;
    try {
      body = JSON.parse((await readBody(req, 32768)) || "{}");
    } catch {
      return json(res, 400, { error: "Invalid JSON body" });
    }
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const facts = body.facts ?? {};
    if (!query) return json(res, 400, { error: "Missing 'query' string" });
    const result = await callOpenRouterAnswer(query.slice(0, 500), facts);
    if (!result.ok) return json(res, result.status, { error: result.error });
    return json(res, 200, { answer: result.answer, source: "llm" });
  }

  return json(res, 404, { error: "Unknown agent endpoint" });
}

// Thin typed client for the two Python backends behind the recon pipeline.
//   /api/pipeline/*  → pipeline_app.py  (blueprint discovery, ingest, occupants, people)
//   /api/scan/*      → api.py           (VPN-gated device scanner — OSINT)
// Both prefixes are wired as Vite proxies (see vite.config.ts). Long pipeline jobs
// are POST→202→poll-GET; the scan is a single synchronous POST.

const PIPELINE = "/api/pipeline";
const SCAN = "/api/scan";

export interface JobStatus {
  // "already_enriched" is only returned by POST /discover when docs already exist.
  status: "pending" | "running" | "complete" | "failed" | "already_enriched";
  error?: string | null;
  [k: string]: unknown;
}

async function jget<T = JobStatus>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new ReconHttpError(res.status, await res.text());
  return res.json() as Promise<T>;
}

async function jpost<T = JobStatus>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // 409 = already running — treat as a benign "join the existing job", not a failure.
  if (!res.ok && res.status !== 409) throw new ReconHttpError(res.status, await res.text());
  return res.json().catch(() => ({})) as Promise<T>;
}

export class ReconHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "ReconHttpError";
  }
}

// ── Pipeline: add building ────────────────────────────────────────────────────
export interface AddBuildingResponse {
  id: string;
  enriched: boolean;
  doc_count: number;
}

export const addBuilding = (address: string) =>
  jpost<AddBuildingResponse>(`${PIPELINE}/buildings`, { address });

// ── Pipeline: 3D schematic ────────────────────────────────────────────────────
/** Base path the Arbor loader points at — serves the ingested graph/walls/building JSON. */
export const schematicBase = (slug: string) =>
  `${PIPELINE}/buildings/${encodeURIComponent(slug)}/schematic`;

/** Slug of the most recently ingested building, or null if none has been ingested yet. */
export const fetchLatestIngestedSlug = async (): Promise<string | null> => {
  try {
    const { slug } = await jget<{ slug: string }>(`${PIPELINE}/buildings/latest-ingested`);
    return slug;
  } catch (e) {
    if (e instanceof ReconHttpError && e.status === 404) return null;
    throw e;
  }
};

// ── Pipeline: pollable phases (discover / ingest / occupants / people) ────────
type Phase = "discover" | "ingest" | "occupants" | "people";

export const startPhase = (slug: string, phase: Phase, body?: unknown) =>
  jpost(`${PIPELINE}/buildings/${encodeURIComponent(slug)}/${phase}`, body);

export const pollPhase = (slug: string, phase: Phase) =>
  jget(`${PIPELINE}/buildings/${encodeURIComponent(slug)}/${phase}`);

/**
 * Drive a pipeline job to a terminal state: POST to start, then poll the GET every
 * `intervalMs` until status is no longer "running"/"pending". Calls `onTick` with each
 * poll so the UI can reflect intermediate progress fields (docs_found, company_count…).
 */
export async function runPipelinePhase(
  slug: string,
  phase: Phase,
  opts: {
    startBody?: unknown;
    intervalMs?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
    onTick?: (job: JobStatus) => void;
  } = {},
): Promise<JobStatus> {
  const { startBody, intervalMs = 1500, timeoutMs = 240_000, signal, onTick } = opts;
  const startRes = (await startPhase(slug, phase, startBody)) as JobStatus;
  // /discover short-circuits with already_enriched when the docs are already on disk —
  // no background job runs, so polling would spin to timeout. Treat it as complete.
  if (startRes.status === "already_enriched" || startRes.status === "complete") {
    const job = (await pollPhase(slug, phase)) as JobStatus;
    return { ...job, status: "complete" };
  }

  const started = Date.now();
  for (;;) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const job = (await pollPhase(slug, phase)) as JobStatus;
    onTick?.(job);
    if (job.status === "complete" || job.status === "failed") return job;
    if (Date.now() - started > timeoutMs) {
      return { ...job, status: "failed", error: "poll timed out" };
    }
    await sleep(intervalMs, signal);
  }
}

// ── Scanner (OSINT): VPN health + synchronous scan ────────────────────────────
export interface VpnHealth {
  vpn_up: boolean;
  iface?: string;
  egress_ip?: string;
}

export interface ScanDevice {
  category: "camera" | "access_control" | "building_service" | "remote_access" | string;
  ip: string;
  port: number;
  url: string;
  shodan: string;
}

export interface ScanResult {
  building_id: string;
  org: string | null;
  cidrs: string[];
  devices: ScanDevice[];
  /** When scanned via a `query`, the domain the Maps API resolved to, and the query. */
  resolved_domain?: string | null;
  resolved_from?: string | null;
}

export const scanHealth = () => jget<VpnHealth>(`${SCAN}/health`);

/**
 * Synchronous device scan. Blocks 60–120s. Throws ReconHttpError(503) if VPN is down,
 * or ReconHttpError(422) if neither a direct domain nor a resolvable query is given.
 * Pass `url` for a known domain, or `query` (building/company name) to let the backend
 * resolve a website via the Maps API first.
 */
export const runScan = (opts: { url?: string; query?: string; id?: string }) =>
  jpost<ScanResult>(`${SCAN}/scan`, opts);

// ── util ──────────────────────────────────────────────────────────────────────
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

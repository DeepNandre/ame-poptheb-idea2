// Shared helpers for the building-intelligence source modules.
//
// Every source file exports a single `fetchSource(ctx)` returning one of these
// result shapes. The aggregator never lets one source's failure touch another —
// each call is wrapped, and a thrown error becomes { status: 'error' }.

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Source succeeded and `data` is real. */
export function ok(source, data, note) {
  return { source, status: "ok", data, ...(note ? { note } : {}) };
}

/** Source is reachable but has nothing to show, or needs a key we don't have. */
export function unavailable(source, note, data = null) {
  return { source, status: "unavailable", data, note };
}

/** Source errored (network, parse, upstream 5xx). Never throws to the caller. */
export function error(source, note, data = null) {
  return { source, status: "error", data, note };
}

/**
 * GET JSON with a hard timeout. Returns { ok, status, data } and NEVER throws —
 * callers branch on `ok` so a single dead upstream can't crash the aggregator.
 */
export async function getJson(url, { headers = {}, timeoutMs = 12000 } = {}) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const status = res.status;
    if (!res.ok) {
      // Drain the body so the socket frees; ignore content.
      await res.text().catch(() => {});
      return { ok: false, status, data: null };
    }
    const data = await res.json();
    return { ok: true, status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, err: String(err?.message || err) };
  }
}

/** Round a coordinate for cache keys / logging (≈11 m at 4 dp). */
export function round(n, dp = 4) {
  const f = 10 ** dp;
  return Math.round(Number(n) * f) / f;
}

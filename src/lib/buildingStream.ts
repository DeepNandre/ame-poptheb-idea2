// Client for the streaming Building Intelligence engine (/api/building/stream).
//
// Opens an SSE connection and fires a callback for each source as it settles,
// so the evaluation pipeline UI shows real phased progress rather than an
// all-or-nothing spinner. `only` restricts the run to a phase subset.

import type { Identity, SectionStatus, UnifiedBuilding } from "./building";

export interface StreamSourceEvent {
  name: string;
  status: SectionStatus;
  ms: number;
  cached: boolean;
  note?: string;
}

export interface StreamHandlers {
  onIdentity?: (identity: Identity) => void;
  onSource?: (ev: StreamSourceEvent) => void;
  onDone?: (building: UnifiedBuilding) => void;
  onError?: (message: string) => void;
}

export interface StreamQuery {
  address?: string;
  lat?: number;
  lng?: number;
  postcode?: string;
}

/**
 * Start a streaming evaluation. Returns a cancel function that closes the
 * connection. The stream self-closes after `done` or `error`.
 */
export function streamEvaluation(
  q: StreamQuery,
  only: string[],
  handlers: StreamHandlers,
): () => void {
  const params = new URLSearchParams();
  if (q.address) params.set("address", q.address);
  if (q.lat != null && q.lng != null) {
    params.set("lat", String(q.lat));
    params.set("lng", String(q.lng));
  }
  if (q.postcode) params.set("postcode", q.postcode);
  if (only.length) params.set("only", only.join(","));

  const es = new EventSource(`/api/building/stream?${params.toString()}`);
  let finished = false;
  const close = () => {
    finished = true;
    es.close();
  };

  es.onmessage = (e) => {
    let msg: {
      type?: string;
      identity?: Identity;
      building?: UnifiedBuilding;
      error?: string;
    } & Partial<StreamSourceEvent>;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "identity":
        if (msg.identity) handlers.onIdentity?.(msg.identity);
        break;
      case "source":
        handlers.onSource?.(msg as StreamSourceEvent);
        break;
      case "done":
        if (msg.building) handlers.onDone?.(msg.building);
        close();
        break;
      case "error":
        handlers.onError?.(String(msg.error || "Evaluation failed"));
        close();
        break;
    }
  };

  es.onerror = () => {
    if (finished) return; // normal close after done
    handlers.onError?.("Lost connection to the evaluation engine.");
    close();
  };

  return close;
}

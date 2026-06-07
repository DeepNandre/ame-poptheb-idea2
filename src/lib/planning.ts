// Client side of the planning proxy. Talks to /api/planning/* (served
// same-origin by the Vite middleware in dev/preview, or the standalone server
// in prod) — so no API keys or CORS in the browser.

export interface PlanningApp {
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

export interface ProxyDoc {
  date?: string;
  docType: string;
  drawingNo?: string;
  description: string;
  url?: string;
  reveals: string[];
  basis: string;
  confidence: number;
}

export interface DocumentsResult {
  supported: boolean;
  documentsUrl?: string;
  documents: ProxyDoc[];
  reason?: string;
}

export async function searchPlanning(
  query: string,
  near?: { lat: number; lng: number },
): Promise<PlanningApp[]> {
  const p = new URLSearchParams({ q: query });
  if (near) {
    p.set("lat", String(near.lat));
    p.set("lng", String(near.lng));
  }
  const res = await fetch(`/api/planning/search?${p.toString()}`);
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = (await res.json()) as { apps?: PlanningApp[] };
  return data.apps ?? [];
}

export async function getDocuments(appUrl: string): Promise<DocumentsResult> {
  const res = await fetch(`/api/planning/documents?url=${encodeURIComponent(appUrl)}`);
  if (!res.ok) throw new Error(`documents ${res.status}`);
  return (await res.json()) as DocumentsResult;
}

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ChevronDown, Radar, Camera, Loader2, RotateCw, Network, Building2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { interpretCommand, getLlmStatus, answerBuilding, type CommandPlan } from "@/lib/agent";
import { geocode, reverseGeocode } from "@/lib/geocode";
import { searchPlanning, getDocuments, type PlanningApp, type ProxyDoc } from "@/lib/planning";
import {
  fetchBuilding,
  summarizeForAnswer,
  deterministicAnswer,
  type DesignationGeometry,
} from "@/lib/building";
import { TARGETS, type Resolution, type Target } from "./scanner/data";
import { DetailPanel } from "./scanner/DetailPanel";
import { CommandBar, type CommandOutcome } from "./scanner/CommandBar";
import { EvidenceReport } from "./scanner/EvidenceReport";
import { IntelligenceGraph } from "./scanner/IntelligenceGraph";
import { showShardSchematic, removeShardSchematic, SHARD_FLOORS } from "./scanner/shardSchematic";
import { ScannerDashboard } from "./scanner/ScannerDashboard";
import { EvaluationTrigger } from "./scanner/EvaluationTrigger";
import { EvaluationPipeline } from "./scanner/EvaluationPipeline";
import { EvaluationResults, type ResultActions } from "./scanner/EvaluationResults";
import { useBuildingEvaluation } from "./scanner/useBuildingEvaluation";
import { ReconPipeline } from "./scanner/ReconPipeline";
import { ReconWorkspace } from "./scanner/ReconWorkspace";
import { useReconPipeline } from "./scanner/useReconPipeline";
import { SchematicViewer } from "./SchematicViewer";

const DEFAULT_CCTV_RANGE =
  (import.meta.env.VITE_CCTV_IP_RANGE as string | undefined) ||
  (import.meta.env.VITE_CAMERADAR_IP_RANGE as string | undefined) ||
  "";

const CCTV_DEMO_DEFAULT =
  import.meta.env.VITE_CCTV_DEMO === "1" ||
  import.meta.env.VITE_CAMERADAR_USE_SAMPLE === "1";

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough centroid of a building polygon — average of its exterior-ring coords.
 *  Good enough to drop a pin on the building the user meant. */
function polygonCentroid(geom: GeoJSON.Geometry | undefined): [number, number] | null {
  if (!geom) return null;
  let ring: GeoJSON.Position[] | null = null;
  if (geom.type === "Polygon") ring = geom.coordinates[0];
  else if (geom.type === "MultiPolygon") ring = geom.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

/**
 * Snap a click to the nearest building footprint. Queries the Standard style's
 * `buildings` featureset at the point (then a small box around it if the point
 * missed), and returns the centroid of the closest building — so a click near or
 * on a building always selects THAT building, not bare ground. Falls back to the
 * raw click if no building is under/near the cursor.
 */
function snapToBuilding(
  map: mapboxgl.Map,
  point: mapboxgl.Point,
  fallback: [number, number],
): [number, number] {
  const m = map as unknown as {
    getFeaturesetDescriptors?: () => Array<{ featuresetId: string; importId?: string }>;
    queryRenderedFeatures: (g: unknown, o: unknown) => mapboxgl.GeoJSONFeature[];
  };

  // The `buildings` featureset's importId depends on whether Standard is the root
  // style (undefined scope) or imported (e.g. "basemap"). Discover the real target
  // from the style; fall back to both common forms if discovery isn't available.
  let targets: Array<{ featuresetId: string; importId?: string }> = [];
  try {
    const found = m.getFeaturesetDescriptors?.().filter((d) => d.featuresetId === "buildings");
    if (found?.length) {
      targets = found.map((d) => (d.importId ? { featuresetId: "buildings", importId: d.importId } : { featuresetId: "buildings" }));
    }
  } catch {
    /* discovery unavailable — use fallbacks below */
  }
  if (!targets.length) {
    targets = [{ featuresetId: "buildings" }, { featuresetId: "buildings", importId: "basemap" }];
  }

  const query = (geom: unknown): mapboxgl.GeoJSONFeature[] => {
    for (const target of targets) {
      try {
        const r = m.queryRenderedFeatures(geom, { target });
        if (r && r.length) return r;
      } catch {
        /* try next target form */
      }
    }
    return [];
  };

  const px = 30;
  let feats = query(point);
  if (!feats.length) {
    feats = query([
      [point.x - px, point.y - px],
      [point.x + px, point.y + px],
    ]);
  }
  if (!feats.length) return fallback;

  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const f of feats) {
    const c = polygonCentroid(f.geometry as GeoJSON.Geometry);
    if (!c) continue;
    const d = (c[0] - fallback[0]) ** 2 + (c[1] - fallback[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ?? fallback;
}

/**
 * Live RTSP→MJPEG feed with honest connection states: a loading spinner until
 * the first frame lands, a LIVE badge while streaming, and a retry button if the
 * stream fails or stalls (camera blocked, needs VPN / same LAN, ffmpeg drops).
 */
function CctvLiveFeed({ camId, label }: { camId: number; label: string }) {
  const [status, setStatus] = useState<"loading" | "live" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const src = `/api/cctv/stream?id=${camId}&try=${attempt}`;

  // If the first frame never arrives, treat the stream as stalled (retryable).
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "failed" : s));
    }, 12000);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  const retry = () => {
    setStatus("loading");
    setAttempt((a) => a + 1);
  };

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/80">
      {status !== "failed" && (
        <img
          key={attempt}
          src={src}
          alt={label}
          className={cn(
            "h-full w-full bg-black object-cover transition-opacity duration-300",
            status === "live" ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setStatus("live")}
          onError={() => setStatus("failed")}
        />
      )}

      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-[11px] text-white/45">
            <Loader2 className="size-4 animate-spin text-white/40" />
            Connecting…
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="absolute inset-0 grid place-items-center px-3 text-center">
          <div className="space-y-2">
            <p className="text-[11px] text-white/45">
              Stream offline or blocked — camera may need VPN / same LAN
            </p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-white/80 transition-colors hover:bg-white/15"
            >
              <RotateCw className="size-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {status === "live" && (
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-red-300 backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
        </div>
      )}
    </div>
  );
}

/** User-facing diagnostics — hide internal tool names. */
function reconDiagnostics(notes: string[]): string[] {
  return notes
    .map((n) =>
      n
        .replace(/Cameradar/gi, "CCTV scan")
        .replace(/subfinder/gi, "DNS enumeration")
        .replace(/theHarvester/gi, "Contact harvester")
        .replace(/SHODAN_API_KEY/g, "Shodan key")
        .replace(/CENSYS/gi, "Censys"),
    )
    .filter(
      (n) =>
        !/^No (subdomains|employees) discovered/i.test(n) &&
        !/^Install (subfinder|theHarvester)/i.test(n),
    );
}

/** Per-source provenance for the recon panel — shows which intelligence sources
 *  actually returned real data vs were skipped (and why). */
function reconSources(rec: any): { label: string; n: number; live: boolean; hint?: string }[] {
  const oc = rec?.osint_context ?? {};
  const notes: string[] = oc.notes ?? [];
  const subdomains = oc.subdomains ?? [];
  const tech = (oc.tech_stack ?? []).filter((t: string) => t && t !== "Unknown / static site");
  const exposed = oc.exposed_devices ?? [];
  const cctv = oc.cctv_cameras ?? [];
  const censysNote = notes.find((n) => /censys/i.test(n) && /skip|ui-only|free|error|rejected/i.test(n));
  const shodanMissing = notes.some((n) => /shodan.*not present/i.test(n));
  return [
    {
      label: "Exposed infra",
      n: exposed.length,
      live: exposed.length > 0,
      hint: shodanMissing ? "Shodan key missing" : censysNote || undefined,
    },
    {
      label: "Subdomains",
      n: subdomains.length,
      live: subdomains.length > 0,
      hint: notes.some((n) => /subfinder/i.test(n)) ? "install subfinder for more" : undefined,
    },
    { label: "Tech", n: tech.length, live: tech.length > 0 },
    { label: "CCTV", n: cctv.length, live: cctv.length > 0 },
  ];
}

const LONDON_DEFAULT: [number, number] = [-0.1048, 51.5084];

/** Same-origin in dev at /ws/scanner (Vite co-host); standalone API on 8787. */
function scannerWsUrl(): string {
  const override = import.meta.env.VITE_SCANNER_WS_URL;
  if (override) return override;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.DEV) {
    return `${proto}//${window.location.host}/ws/scanner`;
  }
  return `ws://localhost:8787/ws/scanner`;
}

const DOT: Record<Resolution, string> = {
  analogue: "bg-emerald-400",
  unresolved: "bg-amber-400",
  anchor: "bg-sky-400",
};

function matchKnownTarget(text: string | null): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("shard")) return "shard";
  if (t.includes("arbor")) return "arbor";
  if (t.includes("building 1")) return "building-1";
  if (t.includes("ludgate")) return "ludgate";
  if (t.includes("bankside")) return "building-1";
  if (t.includes("blackfriars")) return "ludgate";
  return null;
}

function buildSearchUrl(plan: CommandPlan): string {
  const council = plan.council ? `${plan.council} ` : "";
  const term = plan.building ?? plan.place;
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${term} planning application ${council}documents drawings`,
  )}`;
}

function buildLiveTarget(
  app: PlanningApp,
  docs: ProxyDoc[],
  coords: [number, number],
  documentsUrl?: string,
): Target {
  const documents = docs.map((d, i) => ({
    id: `live-${i}`,
    file: d.drawingNo || d.description.slice(0, 52) || `Document ${i + 1}`,
    docType: d.docType,
    reveals: d.reveals,
    basis: d.basis,
    confidence: d.confidence,
    url: d.url,
  }));

  return {
    id: `live:${app.ref}`,
    name: app.address || app.ref,
    address: app.address || app.council,
    planning: app.ref,
    status: app.state || "Live result",
    resolution: documents.length ? "analogue" : "unresolved",
    coords,
    confidence: documents.length ? 86 : 58,
    summary: app.description || "Live planning application from the council register.",
    register: {
      authority: app.council,
      system: "Council register (Idox)",
      ref: app.ref + (app.state ? ` · ${app.state}` : ""),
      url: documentsUrl || app.url,
      docCount: documents.length || undefined,
    },
    documents,
    insideLogic: { entrances: [], cores: [], publicRoutes: [], serviceRoutes: [], plant: [] },
    trace: [
      {
        title: "Matched in the planning register",
        detail: app.description ? app.description.slice(0, 110) : app.ref,
        status: "done",
        ref: app.ref,
      },
      {
        title: "Authority resolved",
        detail: `${app.council} — via the PlanIt aggregator.`,
        status: "done",
      },
      documents.length
        ? {
            title: "Documents parsed live",
            detail: `${documents.length} public documents classified from the council's Idox portal.`,
            status: "active",
          }
        : {
            title: "Documents not auto-listed",
            detail: "Open the register link to view the full document set on the portal.",
            status: "open",
          },
    ],
  };
}

// A lightweight Target for a chat "intelligence" query — no planning docs, just
// an anchor at the resolved location for the Intelligence tab to hang off.
function buildPlaceTarget(name: string, address: string, coords: [number, number]): Target {
  return {
    id: `intel:${coords[0].toFixed(5)},${coords[1].toFixed(5)}`,
    name: name || address || "Location",
    address: address || name,
    planning: "Public-records intelligence",
    status: "Intelligence lookup",
    resolution: "anchor",
    coords,
    confidence: 0,
    summary: "Aggregated public-record intelligence for this location.",
    register: { authority: "", system: "Public records", ref: "" },
    documents: [],
    insideLogic: { entrances: [], cores: [], publicRoutes: [], serviceRoutes: [], plant: [] },
    trace: [],
  };
}

// Placed outside component so useCallback closures don't need it in deps.
/**
 * Estimate distance (metres) from RSSI with the log-distance path-loss model:
 *   d = 10^((measuredPower - rssi) / (10 · n))
 * measuredPower ≈ RSSI at 1 m, n = environment factor (~2.7 indoors). This is an
 * honest estimate — radio scans carry no real GPS, only signal strength.
 */
function rssiToDistanceM(rssi: number): number {
  const measuredPower = -45; // dBm at 1 m
  const n = 2.7;
  const d = Math.pow(10, (measuredPower - rssi) / (10 * n));
  return Math.max(1, Math.min(120, d)); // clamp to a sane 1–120 m
}

/** Deterministic position around the scan centre: stable bearing per device,
 *  radial distance from its RSSI-derived range. */
function stableRadioOffset(id: string, rssi: number, center: [number, number]): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const angle = (((hash % 360) + 360) % 360) * (Math.PI / 180);
  const meters = rssiToDistanceM(rssi);
  const latRad = (center[1] * Math.PI) / 180;
  const dLat = (meters * Math.sin(angle)) / 111320;
  const dLng = (meters * Math.cos(angle)) / (111320 * Math.max(0.2, Math.cos(latRad)));
  return [
    Math.max(-180, Math.min(180, center[0] + dLng)),
    Math.max(-85, Math.min(85, center[1] + dLat)),
  ];
}

/** Best-available RSSI: prefer a real dBm reading, else derive from 0–100 strength. */
function deviceRssi(device: any): number {
  if (typeof device.rssi === "number" && Number.isFinite(device.rssi) && device.rssi < 0) {
    return device.rssi;
  }
  const strength = Math.max(0, Math.min(100, device.signal_strength ?? 0));
  return strength / 2 - 100; // inverse of _rssi_to_strength
}

function devicesToHeatmapFeatures(devices: any[], scanCenter: [number, number]) {
  return devices
    .filter(
      (d) =>
        d.mac &&
        typeof d.mac === "string" &&
        typeof d.signal_strength === "number" &&
        d.signal_strength >= 0 &&
        d.signal_strength <= 100,
    )
    .map((device) => {
      const strength = Math.max(0, Math.min(100, device.signal_strength));
      const rssi = deviceRssi(device);
      const label = device.mac || device.ssid || device.name || "unknown";
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: stableRadioOffset(label, rssi, scanCenter),
        },
        properties: {
          mac: device.mac,
          ssid: device.ssid || device.name || "Hidden",
          rssi: device.rssi ?? Math.round(rssi),
          signal_strength: strength,
          radio: device.radio || "wifi",
        },
      };
    });
}

function updateHeatmapData(
  map: mapboxgl.Map,
  devices: any[],
  scanCenter: [number, number],
) {
  if (!map || !devices.length) return;
  try {
    const source = map.getSource("devices") as mapboxgl.GeoJSONSource;
    source?.setData({
      type: "FeatureCollection",
      features: devicesToHeatmapFeatures(devices, scanCenter),
    });
  } catch (err) {
    console.error("Failed to update WiFi heatmap:", err);
  }
}

function updateBluetoothHeatmapData(
  map: mapboxgl.Map,
  devices: any[],
  scanCenter: [number, number],
) {
  if (!map) return;
  try {
    const source = map.getSource("bluetooth-devices") as mapboxgl.GeoJSONSource;
    source?.setData({
      type: "FeatureCollection",
      features: devices.length ? devicesToHeatmapFeatures(devices, scanCenter) : [],
    });
  } catch (err) {
    console.error("Failed to update Bluetooth heatmap:", err);
  }
}

function updateCrimeHeatmap(map: mapboxgl.Map, points: { lat: number; lng: number }[] | null) {
  try {
    const source = map.getSource("crime") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: (points ?? []).map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {},
      })),
    });
  } catch (err) {
    console.error("Failed to update crime heatmap:", err);
  }
}

// Per-dataset colour for the planning-designation overlays (fill + outline).
const DESIGNATION_COLOR = [
  "match",
  ["get", "dataset"],
  "conservation-area", "#f59e0b",
  "listed-building-outline", "#ef4444",
  "article-4-direction-area", "#a855f7",
  "world-heritage-site", "#eab308",
  "scheduled-monument", "#b45309",
  "park-and-garden", "#14b8a6",
  "tree-preservation-zone", "#22c55e",
  "green-belt", "#10b981",
  "brownfield-land", "#94a3b8",
  "#38bdf8",
] as unknown as mapboxgl.ExpressionSpecification;

function updateDesignations(map: mapboxgl.Map, fc: DesignationGeometry | null) {
  try {
    const source = map.getSource("designations") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(
      (fc as GeoJSON.FeatureCollection) ?? { type: "FeatureCollection", features: [] },
    );
  } catch (err) {
    console.error("Failed to update designation overlay:", err);
  }
}

function clearScanHeatmaps(map: mapboxgl.Map) {
  try {
    (map.getSource("devices") as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [],
    });
    (map.getSource("bluetooth-devices") as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [],
    });
  } catch {
    // map may not be ready
  }
}

export function BuildingScannerProduct() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerEls = useRef<Record<string, HTMLButtonElement>>({});
  const searchMarker = useRef<mapboxgl.Marker | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const scanRadar = useRef<mapboxgl.Marker | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveTarget, setLiveTarget] = useState<Target | null>(null);
  // Bumped per chat "intelligence" query to force the DetailPanel onto its Intelligence tab.
  const [intelFocus, setIntelFocus] = useState(0);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null);
  const [cmdError, setCmdError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [scannedDevices, setScannedDevices] = useState<any[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<any[]>([]);

  // Corporate Recon (Phase 1 + Phase 2) results — "Corporate Recon" tab / panel
  const [corporateRecon, setCorporateRecon] = useState<any>(null);
  // Centered command dashboard — replaces the old scattered floating panels.
  const [dashOpen, setDashOpen] = useState(true);
  const [dashTab, setDashTab] = useState("overview");
  // 3D building schematic overlay (co-founder's Arbor viewer).
  const [schematicOpen, setSchematicOpen] = useState(false);
  // Building to render in the 3D viewer. Set to the just-scanned building's slug
  // when opened from recon; undefined elsewhere → viewer falls back to the most
  // recently ingested building.
  const [schematicSlug, setSchematicSlug] = useState<string | undefined>(undefined);
  const openSchematic = (slug?: string) => {
    setSchematicSlug(slug);
    setSchematicOpen(true);
  };
  const [reconLoading, setReconLoading] = useState(false);
  const [reconProgress, setReconProgress] = useState<string | null>(null);
  const [shardFloor, setShardFloor] = useState(9);
  const [reconIpRange, setReconIpRange] = useState(DEFAULT_CCTV_RANGE);
  // Recon target — a company name or domain. Auto-fills from the selected
  // building (see effect below) but is fully editable.
  // Defaults to Costain — the Bankside Yards developer that shows up in the
  // on-site WiFi scan — so the Recon tab has a relevant target pre-loaded.
  const [reconCompany, setReconCompany] = useState("costain.com");
  const cctvDemo = CCTV_DEMO_DEFAULT;
  const [liveScanEnabled, setLiveScanEnabled] = useState(true);
  const [liveCctv, setLiveCctv] = useState<{
    cameras: any[];
    subnet: string | null;
    scanning: boolean;
    notes: string[];
  }>({ cameras: [], subnet: null, scanning: false, notes: [] });
  const [hasFfmpeg, setHasFfmpeg] = useState(true);
  const lastCctvScanLoc = useRef<[number, number] | null>(null);
  const cctvScanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reconDiagOpen, setReconDiagOpen] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(false);
  // Recon/CCTV auto-scan should run while either of those tabs is in view.
  const reconActive = dashOpen && (dashTab === "recon" || dashTab === "cctv");
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  // Ask the server whether an LLM is configured — drives the command-bar badge.
  useEffect(() => {
    getLlmStatus().then(setLlmEnabled);
  }, []);

  const selected = selectedId
    ? (liveTarget && liveTarget.id === selectedId ? liveTarget : TARGETS.find((t) => t.id === selectedId)) ?? null
    : null;

  // Phased, streaming building evaluation (public-data process). Kept intact in
  // the codebase but no longer triggered from the building dock.
  const evalu = useBuildingEvaluation();

  // Offensive-recon pipeline (the second process) — frontend-only visual driven
  // by the Run-recon trigger. Four phases from backend/PHASES.md run in parallel.
  const recon = useReconPipeline();

  // Auto-fill the recon target from the currently selected building.
  useEffect(() => {
    const name = selected?.name;
    if (name) setReconCompany(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, liveTarget]);

  // Request geolocation immediately — used to centre the map and the heatmap
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLocationRef.current = loc;

        if (mapRef.current) {
          mapRef.current.flyTo({ center: loc, zoom: 16.1, pitch: 62, bearing: -20, duration: 1500 });

          // Add / move user location dot
          if (!userMarker.current) {
            const el = document.createElement("div");
            el.className = "user-location-marker";
            userMarker.current = new mapboxgl.Marker(el).setLngLat(loc).addTo(mapRef.current);
          } else {
            userMarker.current.setLngLat(loc);
          }
          scanRadar.current?.setLngLat(loc);
        }
      },
      (err) => console.warn("Geolocation denied or unavailable:", err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Detect this machine's LAN subnet for live CCTV discovery
  useEffect(() => {
    fetch("/api/cctv/subnet")
      .then((r) => r.json())
      .then((d) => {
        if (d.subnet && !reconIpRange) setReconIpRange(d.subnet);
        setHasFfmpeg(!!d.hasFfmpeg);
      })
      .catch(() => {});
  }, []);

  // WebSocket — same origin in dev (Vite mounts relay); port 8787 when using npm run api alone.
  const connectWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(scannerWsUrl());
      setConnectionError(null);

      const timeout = setTimeout(() => {
        ws.close();
        const msg = "Scanner backend not responding — restart dev server (npm run dev)";
        setConnectionError(msg);
        reject(new Error(msg));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        wsRef.current = ws;
        setConnectionError(null);
        resolve(ws);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        const msg = "Could not connect to scanner backend — restart npm run dev";
        setConnectionError(msg);
        reject(new Error(msg));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "scan_update" && mapRef.current) {
            setScannedDevices(
              [...data.devices].sort((a: any, b: any) => b.signal_strength - a.signal_strength),
            );
            updateHeatmapData(
              mapRef.current,
              data.devices,
              userLocationRef.current ?? LONDON_DEFAULT,
            );
          } else if (data.type === "bluetooth_scan_update" && mapRef.current) {
            setBluetoothDevices(
              [...data.devices].sort((a: any, b: any) => b.signal_strength - a.signal_strength),
            );
            updateBluetoothHeatmapData(
              mapRef.current,
              data.devices,
              userLocationRef.current ?? LONDON_DEFAULT,
            );
          } else if (data.type === "scanner_start") {
            setScanning(true);
            setConnecting(false);
          } else if (data.type === "scanner_stop") {
            setScanning(false);
            setConnecting(false);
            setScannedDevices([]);
            setBluetoothDevices([]);
            if (mapRef.current) clearScanHeatmaps(mapRef.current);
          } else if (data.type === "error") {
            console.error("Scanner error:", data.message);
            setScanning(false);
            setConnecting(false);
            // Also clear any in-flight recon/CCTV loading so the panel doesn't hang.
            setReconLoading(false);
            setReconProgress(null);
            setLiveCctv((s) => ({ ...s, scanning: false }));
            if (data.message) setConnectionError(String(data.message));
          } else if (data.type === "recon_progress") {
            setReconProgress(data.message ?? null);
          } else if (data.type === "corporate_recon_result") {
            setCorporateRecon(data.payload);
            setReconLoading(false);
            setReconProgress(null);
            // Cache so a reload shows recon data instantly without re-querying
            // the rate-limited OSINT sources.
            try {
              sessionStorage.setItem("recon:last", JSON.stringify(data.payload));
            } catch {
              /* storage full / disabled — ignore */
            }
            const cams = data.payload?.osint_context?.cctv_cameras || [];
            if (cams.length) {
              setLiveCctv((s) => ({ ...s, cameras: cams, scanning: false, notes: [] }));
            }
          } else if (data.type === "cctv_scan_result") {
            setLiveCctv({
              cameras: data.cameras || [],
              subnet: data.subnet ?? null,
              scanning: false,
              notes: data.notes || [],
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        setScanning(false);
        setConnecting(false);
      };
    });
  }, []);

  const scanCctvLive = useCallback(
    async (opts?: { ipRange?: string; useDemo?: boolean }) => {
      setLiveCctv((s) => ({ ...s, scanning: true }));
      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          await connectWebSocket();
        }
        const range = opts?.ipRange ?? reconIpRange;
        wsRef.current!.send(
          JSON.stringify({
            action: "scan_cctv_live",
            ip_range: range?.trim() ? range.trim() : "auto",
            use_cctv_sample: opts?.useDemo ?? cctvDemo,
          }),
        );
      } catch (e) {
        console.error("CCTV scan error:", e);
        setLiveCctv((s) => ({ ...s, scanning: false }));
      }
    },
    [connectWebSocket, reconIpRange, cctvDemo],
  );

  useEffect(() => {
    if (!liveScanEnabled || cctvDemo) return;
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLocationRef.current = loc;
        if (lastCctvScanLoc.current) {
          if (haversineM(lastCctvScanLoc.current, loc) < 75) return;
        }
        if (cctvScanTimer.current) clearTimeout(cctvScanTimer.current);
        cctvScanTimer.current = setTimeout(() => {
          lastCctvScanLoc.current = loc;
          scanCctvLive();
        }, 2000);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (cctvScanTimer.current) clearTimeout(cctvScanTimer.current);
    };
  }, [liveScanEnabled, cctvDemo, scanCctvLive]);

  useEffect(() => {
    if (reconActive && liveScanEnabled && !cctvDemo) scanCctvLive();
  }, [reconActive, liveScanEnabled, cctvDemo, scanCctvLive]);

  const toggleScanner = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
      }
      wsRef.current!.send(JSON.stringify({ action: scanning ? "stop_scan" : "start_scan" }));
      // scanning state is driven by server responses (scanner_start / scanner_stop)
    } catch (err) {
      console.error("Scanner error:", err);
      setConnecting(false);
    }
  }, [scanning, connecting, connectWebSocket]);

  // Send stop_scan on unmount so the server cleans up the Python process
  useEffect(() => {
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "stop_scan" }));
        wsRef.current.close();
      }
    };
  }, []);

  // Corporate Recon (Phase 1 + Phase 2) — opens panel immediately in loading state
  const runCorporateRecon = useCallback(
    async (opts?: { company?: string; ipRange?: string; useCctvSample?: boolean }) => {
      const name =
        opts?.company || reconCompany.trim() || selected?.name || liveTarget?.name || "Bankside Yards";
      const ipRange = (opts?.ipRange ?? reconIpRange).trim() || DEFAULT_CCTV_RANGE;
      setReconLoading(true);
      setCorporateRecon(null);
      setReconProgress("Connecting to the recon engine…");

      const useDemo = opts?.useCctvSample ?? cctvDemo;

      const msg: Record<string, unknown> = {
        action: "run_corporate_recon",
        company: name,
        ip_range: ipRange,
      };
      if (useDemo) msg.use_cctv_sample = true;

      try {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          await connectWebSocket();
        }
        wsRef.current!.send(JSON.stringify(msg));
      } catch (err) {
        console.error("Recon error:", err);
        setReconLoading(false);
      }
    },
    [selected, liveTarget, reconCompany, connectWebSocket, reconIpRange, cctvDemo],
  );

  // Auto-load the dashboard with data on first mount, so it's never empty and
  // the user never has to "click and wait". Live scans start in the background;
  // recon restores instantly from cache (or runs once for the default target).
  const didAutoLoad = useRef(false);
  useEffect(() => {
    if (didAutoLoad.current || !token) return;
    didAutoLoad.current = true;

    // Instant: show the last recon (cached this session) with no re-query.
    let hadCache = false;
    try {
      const cached = sessionStorage.getItem("recon:last");
      if (cached) {
        setCorporateRecon(JSON.parse(cached));
        hadCache = true;
      }
    } catch {
      /* ignore */
    }

    // Stagger the background work so we don't hammer everything at once.
    // NOTE: no clearTimeout cleanup — StrictMode's dev mount→cleanup→mount would
    // otherwise cancel these before they fire (and the guard blocks rescheduling).
    toggleScanner(); // live WiFi + Bluetooth
    setTimeout(() => scanCctvLive(), 1200); // CCTV on the local subnet
    setTimeout(() => {
      if (!hadCache) runCorporateRecon(); // OSINT for the default target
    }, 2200);
    // Depend only on token; the mount-time closures are exactly what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      // Mapbox Standard (v3) — realtime lighting, ambient occlusion, real 3D
      // landmarks. "dusk" + "monochrome" gives a cinematic, desaturated
      // intelligence look; POI/transit labels off to keep it clean.
      style: "mapbox://styles/mapbox/standard",
      config: {
        basemap: {
          lightPreset: "day",
          showPointOfInterestLabels: false,
          showTransitLabels: false,
        },
      },
      center: userLocationRef.current ?? LONDON_DEFAULT,
      zoom: 16.1,
      pitch: 62,
      bearing: -20,
      antialias: true,
    });

    mapRef.current = map;
    // bottom-right so it never sits under the right-docked building inspector
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("error", (event) => setMapError(event.error?.message || "Mapbox failed to load."));

    // Click ANY building (or anywhere) to pull live intelligence for that exact
    // point — not just the curated markers. Drops a pin, reverse-geocodes a
    // readable name, and selects it so the inspector + Evaluate trigger appear.
    map.on("click", async (e) => {
      // Snap to the nearest building footprint so a click near/on a building
      // selects THAT building rather than the bare point under the cursor.
      const [lng, lat] = snapToBuilding(map, e.point, [e.lngLat.lng, e.lngLat.lat]);
      placeSearchMarker([lng, lat]);
      const geo = token ? await reverseGeocode(lng, lat, token) : null;
      const name = geo?.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const target = buildPlaceTarget(name, geo?.placeName || name, [lng, lat]);
      setLiveTarget(target);
      setSelectedId(target.id);
      setIntelFocus((n) => n + 1); // DetailPanel opens straight to live Intelligence
      setTargetsOpen(false);
    });
    // Signal that the map itself is pickable.
    map.on("load", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("style.load", () => {
      // Re-assert the Standard config in case the constructor didn't apply it.
      try {
        map.setConfigProperty("basemap", "lightPreset", "day");
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels", false);
      } catch {
        /* non-Standard style — ignore */
      }

      // If geolocation already came in before the map loaded, fly there now
      if (userLocationRef.current) {
        map.jumpTo({ center: userLocationRef.current });
        const el = document.createElement("div");
        el.className = "user-location-marker";
        userMarker.current = new mapboxgl.Marker(el).setLngLat(userLocationRef.current).addTo(map);
      }

      // Standard renders its own lit 3D buildings, so we no longer add a custom
      // extrusion layer. Our data layers go into the "top" slot below.

      map.addSource("devices", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer(
        {
          id: "device-heatmap",
          type: "heatmap",
          slot: "top",
          source: "devices",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "signal_strength"], 0, 0, 100, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 3],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(33, 102, 172, 0)",
              0.2, "rgb(103, 169, 207)",
              0.4, "rgb(209, 229, 240)",
              0.6, "rgb(253, 204, 92)",
              0.8, "rgb(240, 59, 32)",
              1, "rgb(178, 10, 28)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 14, 15, 18, 25],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 18, 0.9],
          },
        },
      );

      map.addSource("bluetooth-devices", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer(
        {
          id: "bluetooth-heatmap",
          type: "heatmap",
          slot: "top",
          source: "bluetooth-devices",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "signal_strength"], 0, 0, 100, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 14, 1.1, 18, 3.2],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(88, 28, 135, 0)",
              0.2, "rgb(167, 139, 250)",
              0.5, "rgb(139, 92, 246)",
              0.8, "rgb(109, 40, 217)",
              1, "rgb(76, 29, 149)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 14, 14, 18, 22],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0.55, 18, 0.85],
          },
        },
      );

      // Crime heat — anonymised street-level points from the Intelligence tab
      // (data.police.uk). Distinct red/yellow ramp so it reads apart from the
      // orange WiFi and purple Bluetooth scan layers.
      map.addSource("crime", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "crime-heatmap",
        type: "heatmap",
        slot: "top",
        source: "crime",
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 17, 2.2],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.2, "rgba(254, 224, 144, 0.5)",
            0.45, "rgb(253, 174, 97)",
            0.7, "rgb(244, 109, 67)",
            1, "rgb(215, 25, 28)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 12, 12, 17, 34],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 17, 0.75],
        },
      });

      // Planning-designation overlays — coloured polygons from planning.data.gov.uk
      // (conservation areas, listed-building outlines, Article 4, TPO, green belt…),
      // painted from the Intelligence tab. Fill + outline, coloured per dataset.
      map.addSource("designations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "designation-fill",
        type: "fill",
        slot: "top",
        source: "designations",
        paint: { "fill-color": DESIGNATION_COLOR, "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "designation-line",
        type: "line",
        slot: "top",
        source: "designations",
        paint: { "line-color": DESIGNATION_COLOR, "line-width": 1.6, "line-opacity": 0.85 },
      });

      TARGETS.forEach((target) => {
        const el = document.createElement("button");
        el.className = "building-marker";
        el.type = "button";
        el.title = target.name;
        el.onclick = () => {
          setSelectedId(target.id);
          setTargetsOpen(false);
        };
        markerEls.current[target.id] = el;
        new mapboxgl.Marker(el).setLngLat(target.coords).addTo(map);
      });

      // Ground-aligned radar sweep at the scan origin — the signature "live
      // scan" visual. pitch/rotationAlignment 'map' lays it flat on the ground.
      const radarEl = document.createElement("div");
      radarEl.className = "scan-radar";
      radarEl.innerHTML =
        '<div class="scan-radar__sweep"></div>' +
        '<div class="scan-radar__ring"></div>' +
        '<div class="scan-radar__ring scan-radar__ring--2"></div>' +
        '<div class="scan-radar__ring scan-radar__ring--3"></div>' +
        '<div class="scan-radar__core"></div>';
      scanRadar.current = new mapboxgl.Marker({
        element: radarEl,
        pitchAlignment: "map",
        rotationAlignment: "map",
      })
        .setLngLat(userLocationRef.current ?? LONDON_DEFAULT)
        .addTo(map);
    });

    return () => {
      userMarker.current?.remove();
      userMarker.current = null;
      searchMarker.current?.remove();
      scanRadar.current?.remove();
      scanRadar.current = null;
      markerEls.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    Object.entries(markerEls.current).forEach(([id, el]) =>
      el.classList.toggle("is-selected", id === selectedId),
    );
    if (!selectedId || !mapRef.current) return;
    const t =
      liveTarget && liveTarget.id === selectedId ? liveTarget : TARGETS.find((x) => x.id === selectedId);
    if (t && (t.coords[0] || t.coords[1])) {
      const isShard = t.id === "shard";
      mapRef.current.flyTo({
        center: t.coords,
        zoom: isShard ? 16 : 16.7,
        pitch: isShard ? 62 : 62,
        bearing: isShard ? -25 : -20,
        duration: isShard ? 1500 : 900,
        essential: true,
      });
    }
  }, [selectedId, liveTarget]);

  // Raise / remove the Shard 3D floor-plan schematic when it's (de)selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const isShard = selectedId === "shard";
    const apply = () => {
      // Hide the solid 3D building so the georeferenced floor plan reads clearly
      // on the footprint; restore full opacity otherwise.
      if (map.getLayer("scanner-3d-buildings")) {
        map.setPaintProperty("scanner-3d-buildings", "fill-extrusion-opacity", isShard ? 0 : 0.92);
      }
      if (isShard) showShardSchematic(map, shardFloor).catch(() => {});
      else removeShardSchematic(map);
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    return () => {
      const m = mapRef.current;
      if (!m) return;
      removeShardSchematic(m);
      if (m.getLayer?.("scanner-3d-buildings")) {
        m.setPaintProperty("scanner-3d-buildings", "fill-extrusion-opacity", 0.92);
      }
    };
  }, [selectedId, shardFloor]);

  // Paint the crime heat layer from points the Intelligence tab fetched. Stable
  // identity (no deps) so the panel effect can call it on mount and on cleanup.
  const handleCrimePoints = useCallback((points: { lat: number; lng: number }[] | null) => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) updateCrimeHeatmap(map, points);
    else map.once("load", () => updateCrimeHeatmap(map, points));
  }, []);

  // Same pattern for the planning-designation polygon overlays.
  const handleDesignations = useCallback((fc: DesignationGeometry | null) => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) updateDesignations(map, fc);
    else map.once("load", () => updateDesignations(map, fc));
  }, []);

  function placeSearchMarker(coords: [number, number]) {
    if (!mapRef.current) return;
    searchMarker.current?.remove();
    const el = document.createElement("div");
    el.className = "search-marker";
    searchMarker.current = new mapboxgl.Marker(el).setLngLat(coords).addTo(mapRef.current);
  }

  async function handleCommand(query: string) {
    setRunning(true);
    setCmdError(null);
    setOutcome(null);
    setSelectedId(null);
    try {
      const plan = await interpretCommand(query);
      const geo = token ? await geocode(plan.place, token) : null;

      if (geo && mapRef.current) {
        placeSearchMarker(geo.center);
        mapRef.current.flyTo({
          center: geo.center,
          zoom: 16.2,
          pitch: 62,
          bearing: -20,
          duration: 1500,
          essential: true,
        });
      }

      const knownId = matchKnownTarget(plan.building || plan.place || query);

      // Ask-anything: answer a building question from the live engine. Keep the
      // view CLEAN — the answer card + map overlays are the focus, so we close the
      // heavy dashboard and leave the full Intelligence panel one click away
      // ("Open full intelligence"). We never auto-select a curated target here, so
      // no floor-plan / evidence panels pile up on top.
      if (plan.intent === "intelligence") {
        const coords: [number, number] | null = geo ? geo.center : selected ? selected.coords : null;
        if (!coords) {
          setOutcome({ query, plan, geo, knownId: null, knownName: null, searchUrl: null, note: "Couldn't pin that location — try a more specific address.", answer: null });
          return;
        }
        if (!geo && mapRef.current) {
          mapRef.current.flyTo({ center: coords, zoom: 16.4, pitch: 62, bearing: -20, duration: 1200, essential: true });
        }

        // Anchor a lightweight target so "Open full intelligence" can drill in,
        // but don't select it (keeps the screen clear) and close the dashboard.
        const target = buildPlaceTarget(geo?.name || plan.place, geo?.placeName || plan.building || plan.place, coords);
        setLiveTarget(target);
        setSelectedId(null);
        setDashOpen(false);

        try {
          const data = await fetchBuilding({ address: plan.building || plan.place, lat: coords[1], lng: coords[0] });
          handleCrimePoints(data.safety.crime.points ?? null);
          handleDesignations(data.planning.designationGeometry ?? null);
          const facts = summarizeForAnswer(data);
          const llm = await answerBuilding(query, facts);
          const answer = llm ?? deterministicAnswer(facts);
          const liveCount = data.meta.sources.filter((s) => s.status === "ok").length;
          setOutcome({ query, plan, geo, knownId: target.id, knownName: target.name, searchUrl: null, note: `${liveCount} live public sources`, answer });
        } catch {
          setOutcome({ query, plan, geo, knownId: target.id, knownName: target.name, searchUrl: null, note: "Couldn't load the full record for this location.", answer: null });
        }
        return;
      }

      if (knownId) {
        const knownName = TARGETS.find((t) => t.id === knownId)?.name ?? null;
        setSelectedId(knownId);
        setOutcome({ query, plan, geo, knownId, knownName, searchUrl: null, note: "Curated evidence pack" });
        return;
      }

      if (plan.intent === "investigate") {
        try {
          const near = geo ? { lat: geo.center[1], lng: geo.center[0] } : undefined;
          const apps = await searchPlanning(plan.building || plan.place, near);
          if (apps.length) {
            const top = apps[0];
            const docs = await getDocuments(top.url).catch(() => null);
            const coords: [number, number] =
              top.lng != null && top.lat != null ? [top.lng, top.lat] : geo ? geo.center : [0, 0];
            const live = buildLiveTarget(top, docs?.documents ?? [], coords, docs?.documentsUrl);
            setLiveTarget(live);
            setSelectedId(live.id);
            const note = docs?.documents.length
              ? `${docs.documents.length} documents · ${top.council}`
              : `Found in ${top.council} register`;
            setOutcome({ query, plan, geo, knownId: live.id, knownName: live.name, searchUrl: null, note });
            return;
          }
          setOutcome({
            query, plan, geo,
            knownId: null, knownName: null,
            searchUrl: buildSearchUrl(plan),
            note: "No application matched — search the register",
          });
          return;
        } catch {
          setOutcome({
            query, plan, geo,
            knownId: null, knownName: null,
            searchUrl: buildSearchUrl(plan),
            note: "Live lookup unavailable — search the register",
          });
          return;
        }
      }

      if (plan.intent === "recon") {
        const company = plan.building || plan.place || query;
        if (plan.ipRange) setReconIpRange(plan.ipRange);
        setOutcome({
          query,
          plan,
          geo,
          knownId: null,
          knownName: company,
          searchUrl: null,
          note: "Running corporate OSINT + CCTV discovery + live device correlation…",
        });
        runCorporateRecon({ company, ipRange: plan.ipRange ?? undefined });
        return;
      }

      setOutcome({ query, plan, geo, knownId: null, knownName: null, searchUrl: null, note: null });
    } catch {
      setCmdError("Couldn't run that command. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  const displayCameras =
    liveCctv.cameras.length > 0
      ? liveCctv.cameras
      : (corporateRecon?.osint_context?.cctv_cameras ?? []);
  const cctvCount = displayCameras.length;

  // Results-deck tiles → existing views. Closing the deck (reset) leaves the
  // building selected, so the DetailPanel takes over the right dock again.
  const resultActions: ResultActions = {
    onOpenIntelligence: () => {
      evalu.reset();
      setIntelFocus((n) => n + 1); // DetailPanel jumps to its Intelligence tab
    },
    on3D: () => openSchematic(recon.slug ?? undefined),
    onAsk: () => {
      evalu.reset();
      setIntelFocus((n) => n + 1);
    },
    onRecon: () => {
      const company = evalu.target?.name || selected?.name;
      evalu.reset();
      setDashOpen(true);
      setDashTab("recon");
      if (company) runCorporateRecon({ company });
    },
    onReport: () => {
      evalu.reset();
      setReportOpen(true);
    },
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-canvas text-white">
      {/* Map canvas */}
      {token && !mapError ? (
        // h-full w-full keeps the canvas full-size even though mapbox-gl.css
        // forces .mapboxgl-map { position: relative }, which cancels inset-0.
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,#1a1a1f,#0a0a0c)]">
          <div className="text-center">
            <Radar className="mx-auto size-6 text-white/30" />
            <p className="mt-2 text-xs text-white/40">
              {mapError ?? "Add VITE_MAPBOX_TOKEN to .env.local to load the 3D map."}
            </p>
          </div>
        </div>
      )}

      {/* Top-left — brand + targets */}
      <div className="no-print absolute left-4 top-4 z-20 flex w-[min(17rem,calc(100vw-2rem))] flex-col gap-2">
        <div className="glass flex items-center gap-2 rounded-full px-3.5 py-2">
          <span className="grid size-6 place-items-center rounded-md bg-white text-black">
            <Radar className="size-3.5" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight">Building Scanner</span>
          {token && (
            <button
              onClick={() => setDashOpen((o) => !o)}
              className={cn(
                "ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                dashOpen
                  ? "border-white/20 bg-white/10 text-white/70 hover:bg-white/15"
                  : "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/25",
              )}
              title={dashOpen ? "Hide dashboard" : "Show dashboard"}
            >
              <Network className="size-3 text-cyan-200/70" />
              <span>{dashOpen ? "Hide" : "Dashboard"}</span>
            </button>
          )}
        </div>

        {connectionError ? (
          <div className="glass rounded-xl px-3 py-2 text-[11px] text-amber-200/90 border border-amber-400/30">
            {connectionError}
          </div>
        ) : null}

        <div className="glass overflow-hidden rounded-2xl">
          <button
            onClick={() => setTargetsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
              Targets · {TARGETS.length}
            </span>
            <ChevronDown
              className={cn("size-4 text-white/45 transition-transform", targetsOpen && "rotate-180")}
            />
          </button>
          {targetsOpen ? (
            <div className="space-y-0.5 px-1.5 pb-1.5 animate-fade-in">
              {TARGETS.map((target) => (
                <button
                  key={target.id}
                  onClick={() => {
                    setSelectedId(target.id);
                    setTargetsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    selectedId === target.id ? "bg-white/10" : "hover:bg-white/[0.05]",
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", DOT[target.resolution])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-white/90">
                      {target.name}
                    </span>
                    <span className="block truncate text-[11px] text-white/45">{target.planning}</span>
                  </span>
                  <span className="tnum shrink-0 font-mono text-[11px] text-white/40">
                    {target.confidence}%
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <p className="no-print pointer-events-none absolute left-1/2 top-5 z-10 hidden max-w-md -translate-x-1/2 text-center text-[13px] text-white/45 lg:block">
        Click any building to pull its live record — the planning data shows the inside.
      </p>

      {/* Centered command dashboard — every section in one glass surface. */}
      <ScannerDashboard
        open={dashOpen}
        tab={dashTab}
        onTab={setDashTab}
        onClose={() => setDashOpen(false)}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "wifi", label: "WiFi", badge: scannedDevices.length || null },
          { id: "bt", label: "Bluetooth", badge: bluetoothDevices.length || null },
          { id: "recon", label: "Recon", badge: corporateRecon?.osint_context?.subdomains?.length || null },
          { id: "cctv", label: "CCTV", badge: cctvCount || null },
          { id: "graph", label: "Graph" },
        ]}
      >
        {/* OVERVIEW */}
        {dashTab === "overview" && (
          <div className="space-y-3 p-4 text-[12px]">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "WiFi", value: scannedDevices.length, hint: scanning ? "live" : "idle" },
                { label: "Bluetooth", value: bluetoothDevices.length, hint: scanning ? "live" : "idle" },
                { label: "CCTV", value: cctvCount, hint: liveCctv.scanning ? "scanning…" : liveCctv.subnet || "" },
                {
                  label: "Subdomains",
                  value: corporateRecon?.osint_context?.subdomains?.length || 0,
                  hint: corporateRecon?.company || "",
                },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="tabular-nums text-2xl font-semibold text-white">{c.value}</div>
                  <div className="text-[11px] text-white/55">{c.label}</div>
                  {c.hint && <div className="mt-0.5 truncate text-[10px] text-white/35">{c.hint}</div>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={toggleScanner}
                disabled={connecting}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[12px] font-medium disabled:opacity-60",
                  scanning
                    ? "border-orange-300/40 bg-orange-300/20 text-orange-100"
                    : "border-white/15 bg-white/10 text-white/75 hover:bg-white/15",
                )}
              >
                {scanning ? "Stop scan" : "Start WiFi/BT scan"}
              </button>
              <button
                onClick={() => setDashTab("recon")}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/15"
              >
                Run recon →
              </button>
              <button
                onClick={() => setDashTab("cctv")}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/15"
              >
                Scan CCTV →
              </button>
              {/* Always available so the schematic can be re-opened any time. */}
              <button
                onClick={() => openSchematic(recon.slug ?? undefined)}
                className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/20 px-3 py-1.5 text-[12px] font-medium text-sky-100 hover:bg-sky-500/30"
              >
                <Building2 className="size-3.5" /> Arbor 3D schematic
              </button>
            </div>
            {selected && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/45">Selected building</div>
                <div className="text-[13px] font-medium text-white/90">{selected.name}</div>
                <div className="text-[11px] text-white/50">{selected.planning}</div>
                {selected.id === "arbor" && (
                  <button
                    onClick={() => openSchematic(undefined)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/20 px-3 py-1.5 text-[12px] font-medium text-sky-100 transition-colors hover:bg-sky-500/30"
                  >
                    <Building2 className="size-3.5" /> View 3D schematic
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* WIFI */}
        {dashTab === "wifi" && (
          <div>
            <p className="border-b border-white/[0.06] px-4 py-2 text-[11px] text-white/40">
              {scanning
                ? "Real SSIDs from your machine. Orange map heat = WiFi estimates at your location."
                : "Start a scan to see live WiFi networks around you."}
            </p>
            {scannedDevices.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-white/45">No WiFi yet — hit Start scan.</div>
            ) : (
              scannedDevices.map((device) => {
                const strength = device.signal_strength as number;
                const barColor =
                  strength >= 70 ? "bg-emerald-400" : strength >= 40 ? "bg-amber-400" : "bg-red-400";
                return (
                  <div key={`wifi-${device.mac}`} className="border-b border-white/[0.06] px-4 py-2.5 last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-white/90">{device.ssid}</span>
                      <span className="shrink-0 font-mono text-[11px] text-white/40">{device.rssi} dBm</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${strength}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* BLUETOOTH */}
        {dashTab === "bt" && (
          <div>
            <p className="border-b border-white/[0.06] px-4 py-2 text-[11px] text-white/40">
              Headphones, phones, and beacons near you. Purple map heat = Bluetooth proximity.
            </p>
            {bluetoothDevices.length === 0 ? (
              <div className="p-6 text-center text-[12px] text-white/45">No Bluetooth devices yet — hit Start scan.</div>
            ) : (
              <>
                {bluetoothDevices.slice(0, 40).map((device) => {
                  const strength = device.signal_strength as number;
                  const barColor =
                    strength >= 70 ? "bg-violet-400" : strength >= 40 ? "bg-purple-400" : "bg-fuchsia-500/80";
                  const statusLabel =
                    device.status === "connected"
                      ? "connected"
                      : device.status === "nearby"
                        ? "nearby"
                        : device.status === "paired"
                          ? "paired"
                          : null;
                  return (
                    <div key={`bt-${device.mac}`} className="border-b border-white/[0.06] px-4 py-2.5 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-white/90">
                          {device.name || device.ssid || "Unknown"}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-white/40">{device.rssi} dBm</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] text-white/45">
                          {device.device_type || "Device"}
                          {statusLabel ? ` · ${statusLabel}` : ""}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-white/30">{String(device.mac).slice(0, 13)}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${strength}%` }} />
                      </div>
                    </div>
                  );
                })}
                {bluetoothDevices.length > 40 && (
                  <div className="px-4 py-2 text-center text-[10px] text-white/40">
                    +{bluetoothDevices.length - 40} more — showing the 40 strongest
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* RECON */}
        {dashTab === "recon" && (
          <div className="space-y-3 p-4 text-[12px]">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45">Company or domain</label>
              <div className="mt-1 flex gap-1.5">
                <input
                  type="text"
                  value={reconCompany}
                  onChange={(e) => setReconCompany(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && reconCompany.trim())
                      runCorporateRecon({ ipRange: reconIpRange.trim() || undefined });
                  }}
                  placeholder="e.g. monzo.com or Monzo"
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[12px] text-white/90 placeholder:text-white/30"
                />
                <button
                  type="button"
                  onClick={() => runCorporateRecon({ ipRange: reconIpRange.trim() || undefined })}
                  disabled={reconLoading || !reconCompany.trim()}
                  className="rounded-lg bg-sky-500/25 px-3 py-1.5 text-[12px] font-medium text-sky-100 hover:bg-sky-500/35 disabled:opacity-50"
                >
                  {reconLoading ? "…" : "Profile"}
                </button>
              </div>
            </div>

            {reconLoading ? (
              <div className="p-4 text-center text-white/70">
                <div className="mb-1 animate-pulse">{reconProgress || "Running corporate recon…"}</div>
                <div className="text-[11px] text-white/50">Live OSINT from public records — this can take ~30–60s.</div>
              </div>
            ) : corporateRecon ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {reconSources(corporateRecon).map((s) => (
                    <span
                      key={s.label}
                      title={s.hint}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                        s.live
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.04] text-white/40",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", s.live ? "bg-emerald-400" : "bg-white/30")} />
                      {s.label}
                      {s.live ? ` ·${s.n}` : ""}
                    </span>
                  ))}
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">
                    Subdomains ({corporateRecon.osint_context?.subdomains?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(corporateRecon.osint_context?.subdomains || []).slice(0, 40).map((s: string, i: number) => (
                      <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/80">{s}</span>
                    ))}
                    {(corporateRecon.osint_context?.subdomains || []).length === 0 && (
                      <span className="text-white/50">none discovered</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">Tech stack</div>
                  <div className="flex flex-wrap gap-1">
                    {(corporateRecon.osint_context?.tech_stack || []).map((t: string, i: number) => (
                      <span key={i} className="rounded bg-white/10 px-2 py-0.5 text-[11px]">{t}</span>
                    ))}
                    {(corporateRecon.osint_context?.tech_stack || []).length === 0 && (
                      <span className="text-white/50">unknown</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">Exposed infrastructure</div>
                  <div className="space-y-0.5 text-white/70">
                    {(corporateRecon.osint_context?.exposed_devices || []).slice(0, 6).map((d: any, i: number) => (
                      <div key={i} className="font-mono text-[11px]">
                        {d.ip}:{d.port} — {d.service} <span className="text-white/40">({d.location})</span>
                      </div>
                    ))}
                    {(corporateRecon.osint_context?.exposed_devices || []).length === 0 && (
                      <div className="text-white/50">no public exposures found (needs Shodan/Censys)</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/45">Employees in building now</div>
                  {(corporateRecon.employees_present || []).length === 0 ? (
                    <div className="text-white/50">No high-confidence device matches yet. Start a scan for correlation.</div>
                  ) : (
                    <div className="space-y-1">
                      {(corporateRecon.employees_present || []).map((e: any, i: number) => (
                        <div key={i} className="rounded bg-white/[0.03] px-2 py-1.5">
                          <div className="flex justify-between">
                            <span className="font-medium text-white/90">{e.name}</span>
                            <span className="font-mono text-emerald-400">{Math.round((e.probability || 0) * 100)}%</span>
                          </div>
                          <div className="text-white/50">{e.email} · {e.title}</div>
                          <div className="text-white/60">via {e.device}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {Array.isArray(corporateRecon.osint_context?.notes) &&
                  reconDiagnostics(corporateRecon.osint_context.notes).length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setReconDiagOpen((o) => !o)}
                        className="text-[10px] uppercase tracking-wider text-white/45 hover:text-white/60"
                      >
                        {reconDiagOpen ? "▾" : "▸"} Diagnostics ({reconDiagnostics(corporateRecon.osint_context.notes).length})
                      </button>
                      {reconDiagOpen && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-white/55">
                          {reconDiagnostics(corporateRecon.osint_context.notes).map((n: string, i: number) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
              </div>
            ) : (
              <div className="p-4 text-center text-[12px] text-white/55">
                Enter a company or domain and hit <span className="text-white/80">Profile</span> to pull live OSINT —
                subdomains, tech stack, exposed infrastructure.
              </div>
            )}
          </div>
        )}

        {/* CCTV */}
        {dashTab === "cctv" && (
          <div className="space-y-3 p-4 text-[12px]">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/45">
                Local network {liveCctv.subnet ? `· ${liveCctv.subnet}` : ""}
              </label>
              <div className="mt-1 flex gap-1.5">
                <input
                  type="text"
                  value={reconIpRange}
                  onChange={(e) => setReconIpRange(e.target.value)}
                  placeholder="auto (your WiFi subnet)"
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 font-mono text-[12px] text-white/90 placeholder:text-white/30"
                />
                <button
                  type="button"
                  onClick={() => scanCctvLive({ ipRange: reconIpRange.trim() || "auto" })}
                  disabled={liveCctv.scanning}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-[12px] text-red-200 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {liveCctv.scanning ? "…" : "Scan CCTV"}
                </button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/55">
              <input
                type="checkbox"
                checked={liveScanEnabled}
                onChange={(e) => setLiveScanEnabled(e.target.checked)}
                className="rounded border-white/20"
              />
              Re-scan CCTV when I move (every ~75m)
            </label>
            {!hasFfmpeg && (
              <p className="text-[10px] text-amber-300/80">Install ffmpeg for live video: brew install ffmpeg</p>
            )}

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45">
                <Camera className="size-3" />
                Live CCTV
                {cctvCount > 0 && <span className="normal-case text-red-300">{cctvCount} stream{cctvCount !== 1 ? "s" : ""}</span>}
              </div>
              {liveCctv.scanning ? (
                <div className="animate-pulse p-3 text-center text-white/60">Scanning local network for RTSP cameras…</div>
              ) : cctvCount === 0 ? (
                <div className="space-y-1 text-[11px] text-white/50">
                  <p>No open RTSP cameras reachable on this network.</p>
                  <p>Note: many WiFi networks isolate clients, so LAN cameras can&rsquo;t be reached. Connect to an un-isolated network with cameras.</p>
                  {liveCctv.notes.slice(0, 2).map((n, i) => (
                    <p key={i} className="text-white/40">{n}</p>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayCameras.map((cam: any, i: number) => (
                    <div key={`${cam.ip}-${cam.port}-${i}`} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-white/90">{cam.manufacturer} · {cam.model}</span>
                        <span className="font-mono text-white/45">{cam.ip}:{cam.port}</span>
                      </div>
                      {hasFfmpeg && !cctvDemo ? (
                        <CctvLiveFeed camId={i} label={`${cam.manufacturer} ${cam.ip}`} />
                      ) : (
                        <div className="grid aspect-video place-items-center rounded-lg bg-black/60 text-[10px] text-white/40">
                          {cctvDemo ? "Offline demo data" : "ffmpeg required for live view"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GRAPH */}
        {dashTab === "graph" && (
          <IntelligenceGraph
            selected={selected}
            corporateRecon={corporateRecon}
            scannedDevices={scannedDevices}
            bluetoothDevices={bluetoothDevices}
            cameras={displayCameras}
            cctvSubnet={liveCctv.subnet}
            scanning={scanning}
            reconLoading={reconLoading}
            cctvScanning={liveCctv.scanning}
            onClose={() => setDashTab("overview")}
            onRunRecon={() => {
              const company = selected?.name || liveTarget?.name || corporateRecon?.company;
              if (company) runCorporateRecon({ company, ipRange: reconIpRange.trim() || undefined });
              else setDashTab("recon");
            }}
            onStartScan={() => {
              if (!scanning && !connecting) toggleScanner();
            }}
          />
        )}

      </ScannerDashboard>

      {/* Legacy public-data pipeline / results dock — kept intact, but no longer
          triggered from the building dock (the Run-recon trigger drives the recon
          pipeline instead). Stays dormant unless evalu is started elsewhere. */}
      {evalu.mode !== "idle" && (
        <div className="no-print fixed right-4 top-4 bottom-24 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col">
          <div className="min-h-0 flex-1">
            {evalu.mode === "running" ? (
              <EvaluationPipeline ev={evalu} />
            ) : (
              <EvaluationResults ev={evalu} actions={resultActions} />
            )}
          </div>
        </div>
      )}

      {/* Recon pipeline — takes over the right dock while the four-phase recon
          runs (frontend-only visual). Closing it (reset) falls back to the
          building inspector below. */}
      {recon.mode !== "idle" && (
        <div className="no-print fixed right-4 top-4 bottom-24 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col">
          <div className="min-h-0 flex-1">
            <ReconPipeline recon={recon} />
          </div>
        </div>
      )}

      {/* Post-recon workspace — opens on the LEFT once the pipeline finishes:
          a building-aware chat assistant, an enrichable people roster, OSINT
          findings, and a hand-off to the 3D schematic. Frontend-only, fed by the
          recon target. Closing the right pipeline (reset) tears this down too. */}
      {recon.complete && recon.target && (
        <div className="no-print fixed left-4 top-4 bottom-24 z-30 flex w-[min(26rem,calc(100vw-2rem))] flex-col">
          <div className="min-h-0 flex-1">
            <ReconWorkspace
              building={recon.target.name}
              realPeople={recon.people}
              realOsint={recon.osint}
              onOpen3D={() => openSchematic(recon.slug ?? undefined)}
              onClose={recon.reset}
            />
          </div>
        </div>
      )}

      {/* Building inspector — its OWN docked panel on the right, separate from the
          scan dashboard, so the two never stack on top of each other. Shows for any
          selected building (curated, live planning result, or a chat lookup). */}
      {selected && recon.mode === "idle" && (
        <div className="no-print fixed right-4 top-4 bottom-24 z-30 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
          {/* Primary call to action — big and obvious, right where the eye lands
              after selecting a building. Full recon run or à-la-carte phase subset. */}
          <EvaluationTrigger
            buildingName={selected.name}
            onEvaluate={(keys) =>
              recon.start(
                { name: selected.name, address: selected.address, url: selected.register?.url },
                keys,
              )
            }
          />
          {selected.id === "arbor" && (
            <button
              onClick={() => openSchematic(undefined)}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/20 px-3 py-2.5 text-[13px] font-medium text-sky-100 transition-colors hover:bg-sky-500/30"
            >
              <Building2 className="size-4" /> View 3D schematic
            </button>
          )}
          <div className="min-h-0 flex-1">
            <DetailPanel
              target={selected}
              onClose={() => setSelectedId(null)}
              onExport={() => setReportOpen(true)}
              onCrimePoints={handleCrimePoints}
              onDesignationGeometry={handleDesignations}
              focusIntel={intelFocus}
            />
          </div>
        </div>
      )}

      {/* The Shard — floor-plan switcher (georeferenced overlay) */}
      {selectedId === "shard" && (
        <div className="no-print absolute bottom-24 left-4 z-20 w-[min(15rem,calc(100vw-2rem))] glass rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-sky-300" />
            <span className="text-[13px] font-semibold">The Shard — floor plans</span>
          </div>
          <p className="mt-1 text-[11px] text-white/50">
            Real published plans, pinned to the tower footprint. Pick a level.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SHARD_FLOORS.map((f) => (
              <button
                key={f.level}
                type="button"
                onClick={() => setShardFloor(f.level)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  shardFloor === f.level
                    ? "border-sky-400/50 bg-sky-400/20 text-sky-100"
                    : "border-white/15 bg-white/[0.05] text-white/60 hover:bg-white/10",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <CommandBar
        running={running}
        outcome={outcome}
        error={cmdError}
        llmEnabled={llmEnabled}
        onSubmit={handleCommand}
        onClear={() => {
          setOutcome(null);
          setCmdError(null);
          searchMarker.current?.remove();
          searchMarker.current = null;
          // dismissing the answer also clears its map overlays
          handleCrimePoints(null);
          handleDesignations(null);
        }}
        onOpenTarget={(id) => {
          setOutcome(null); // dismiss the answer card so it doesn't stack with the inspector
          setSelectedId(id);
          // an intelligence place-target opens straight to its Intelligence tab
          if (id.startsWith("intel:")) setIntelFocus((n) => n + 1);
        }}
      />

      {reportOpen && selected ? (
        <EvidenceReport target={selected} onClose={() => setReportOpen(false)} />
      ) : null}

      <SchematicViewer open={schematicOpen} onClose={() => setSchematicOpen(false)} slug={schematicSlug} />
    </main>
  );
}

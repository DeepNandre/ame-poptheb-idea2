import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Building2,
  FileSearch,
  MapPin,
  Radar,
  Route,
  ShieldAlert,
  Wifi,
} from "lucide-react";

const banksideYards: [number, number] = [-0.1048, 51.5084];

const targets = [
  {
    name: "Arbor / Building 3",
    status: "Target",
    ref: "Trace from 12/AP/3940",
    coords: [-0.1048, 51.5084],
  },
  {
    name: "Building 1",
    status: "Docs found",
    ref: "22/AP/2295",
    coords: [-0.1057, 51.5078],
  },
  {
    name: "Ludgate House site",
    status: "Legacy identity",
    ref: "245 Blackfriars Road",
    coords: [-0.1042, 51.509],
  },
];

const signals = [
  {
    icon: MapPin,
    label: "Entrances",
    detail: "Ground-floor access, reception and public approach routes.",
  },
  {
    icon: Route,
    label: "Circulation",
    detail: "Lift cores, stairs, tenant floors and vertical movement.",
  },
  {
    icon: ShieldAlert,
    label: "Back-of-house",
    detail: "Loading, plant, basement servicing and staff/practical zones.",
  },
  {
    icon: FileSearch,
    label: "Public records",
    detail: "Council PDFs, DAS narrative, GA plans and sections.",
  },
];

export function BuildingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  const connectWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.port === "5173" ? "localhost:8787" : window.location.host;
      const ws = new WebSocket(`${protocol}//${host}`);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timeout"));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        wsRef.current = ws;
        resolve(ws);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket connection failed — is the API server running?"));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "scan_update" && mapRef.current) {
            setDeviceCount(data.count);
            updateHeatmapData(mapRef.current, data.devices);
          } else if (data.type === "scanner_start") {
            setScanning(true);
            setConnecting(false);
          } else if (data.type === "scanner_stop") {
            setScanning(false);
            setConnecting(false);
          } else if (data.type === "error") {
            console.error("Scanner error:", data.message);
            setScanning(false);
            setConnecting(false);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        wsRef.current = null;
        setScanning(false);
        setConnecting(false);
      };
    });
  }, []);

  const toggleScanner = useCallback(async () => {
    if (connecting) return;
    setConnecting(true);

    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connectWebSocket();
      }
      wsRef.current!.send(JSON.stringify({
        action: scanning ? "stop_scan" : "start_scan",
      }));
      // scanning state is driven by server responses (scanner_start / scanner_stop)
    } catch (error) {
      console.error("Scanner error:", error);
      setConnecting(false);
    }
  }, [scanning, connecting, connectWebSocket]);

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    setMapError(null);

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: banksideYards,
      zoom: 16.5,
      pitch: 67,
      bearing: -28,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    map.on("error", (event) => {
      const error = event.error;
      setMapError(error?.message || "Mapbox could not load this style or token.");
    });

    map.on("load", () => {
      const layers = map.getStyle().layers;
      const labelLayer = layers?.find(
        (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
      )?.id;

      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["get", "height"],
              0,
              "#1f2937",
              80,
              "#3b82f6",
              180,
              "#f97316",
            ],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.78,
          },
        },
        labelLayer,
      );

      map.addSource("devices", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer(
        {
          id: "device-heatmap",
          type: "heatmap",
          source: "devices",
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "signal_strength"],
              0,
              0,
              100,
              1,
            ],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              1,
              18,
              3,
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(33, 102, 172, 0)",
              0.2,
              "rgb(103, 169, 207)",
              0.4,
              "rgb(209, 229, 240)",
              0.6,
              "rgb(253, 204, 92)",
              0.8,
              "rgb(240, 59, 32)",
              1,
              "rgb(178, 10, 28)",
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              15,
              18,
              25,
            ],
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              0.6,
              18,
              0.9,
            ],
          },
        },
        "3d-buildings",
      );

      targets.forEach((target) => {
        const el = document.createElement("div");
        el.className = "building-marker";
        el.setAttribute("aria-label", target.name);

        new mapboxgl.Marker(el)
          .setLngLat(target.coords as [number, number])
          .setPopup(
            new mapboxgl.Popup({ offset: 22 }).setHTML(
              `<strong>${target.name}</strong><br/><span>${target.status} · ${target.ref}</span>`,
            ),
          )
          .addTo(map);
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Send stop_scan before closing so the server kills the Python process
  useEffect(() => {
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "stop_scan" }));
        wsRef.current.close();
      }
    };
  }, []);

  const buttonLabel = connecting ? "Connecting…" : scanning ? `${deviceCount} devices` : "Start scan";
  const buttonDisabled = !token || mapError !== null || connecting;

  return (
    <section id="map" className="relative overflow-hidden bg-black px-5 py-20 sm:px-8 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.25fr] lg:items-stretch">
        <div className="flex flex-col justify-between gap-10">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <Radar className="h-3.5 w-3.5 text-orange-300" />
                London building scanner
              </div>
              {mapReady && (
                <button
                  onClick={toggleScanner}
                  disabled={buttonDisabled}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    scanning
                      ? "border border-orange-300/50 bg-orange-300/10 text-orange-200"
                      : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Wifi
                    className={`h-3.5 w-3.5 ${
                      scanning || connecting
                        ? "animate-pulse text-orange-300"
                        : "text-white/60"
                    }`}
                  />
                  {buttonLabel}
                </button>
              )}
            </div>
            <h2 className="max-w-xl font-heading text-5xl italic leading-[0.9] tracking-tight text-white md:text-6xl">
              Planning records show the inside.
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-6 text-white/62 md:text-base">
              Search the public register, pin the real planning identity, then project the drawings back onto a 3D city map. Google Maps shows the outside; council PDFs reveal entrances, cores, servicing and circulation.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {signals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <Icon className="mb-4 h-5 w-5 text-orange-300" />
                  <div className="text-sm font-semibold text-white">{signal.label}</div>
                  <div className="mt-2 text-xs leading-5 text-white/55">{signal.detail}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-[#06080b] shadow-2xl shadow-black/50">
          {token && !mapError ? (
            <>
              {/* h-full w-full survives mapbox-gl.css forcing position:relative on .mapboxgl-map */}
              <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/65 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/55 p-3 backdrop-blur-md">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  Bankside Yards
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <Building2 className="h-4 w-4 text-orange-300" />
                  {mapReady ? "3D planning target live" : "Loading 3D map"}
                </div>
              </div>
            </>
          ) : (
            <FallbackMap error={mapError} hasToken={Boolean(token)} />
          )}

          <div className="absolute bottom-4 left-4 right-4 grid gap-2 md:grid-cols-3">
            {targets.map((target) => (
              <div key={target.name} className="rounded-lg border border-white/10 bg-black/60 p-3 backdrop-blur-md">
                <div className="text-xs font-semibold text-white">{target.name}</div>
                <div className="mt-1 text-[11px] text-orange-200">{target.status}</div>
                <div className="mt-1 truncate text-[11px] text-white/45">{target.ref}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function updateHeatmapData(map: mapboxgl.Map, devices: any[]) {
  if (!map || !devices.length) return;

  const features = devices
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
      const uncertainty = Math.max(0.001, (100 - strength) / 1000);
      const offsetLng = (Math.random() - 0.5) * uncertainty;
      const offsetLat = (Math.random() - 0.5) * uncertainty;

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [
            Math.max(-180, Math.min(180, banksideYards[0] + offsetLng)),
            Math.max(-85, Math.min(85, banksideYards[1] + offsetLat)),
          ],
        },
        properties: {
          mac: device.mac,
          ssid: device.ssid || "Hidden",
          rssi: device.rssi ?? -100,
          signal_strength: strength,
        },
      };
    });

  try {
    const source = map.getSource("devices") as mapboxgl.GeoJSONSource;
    source?.setData({ type: "FeatureCollection", features });
  } catch (error) {
    console.error("Failed to update heatmap:", error);
  }
}

function FallbackMap({ error, hasToken }: { error: string | null; hasToken: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(249,115,22,0.24),transparent_28%),linear-gradient(135deg,#05070a,#0b1220_45%,#111827)]" />
      <div className="absolute inset-x-[-20%] bottom-16 h-72 rotate-[-12deg] border-y border-white/10 bg-white/[0.025]" />
      <div className="absolute inset-y-[-10%] left-[38%] w-28 rotate-[24deg] border-x border-white/10 bg-white/[0.025]" />
      <div className="absolute left-[48%] top-[33%] h-48 w-24 rounded-t-sm border border-orange-300/40 bg-orange-300/20 shadow-[0_0_45px_rgba(249,115,22,0.24)]" />
      <div className="absolute left-[35%] top-[44%] h-32 w-20 rounded-t-sm border border-blue-300/25 bg-blue-300/12" />
      <div className="absolute left-[61%] top-[41%] h-28 w-16 rounded-t-sm border border-white/20 bg-white/10" />
      <div className="absolute left-4 top-4 max-w-xs rounded-lg border border-white/10 bg-black/55 p-4 backdrop-blur-md">
        <div className="text-sm font-semibold text-white">
          {hasToken ? "Mapbox token rejected" : "Mapbox token needed"}
        </div>
        <div className="mt-2 text-xs leading-5 text-white/55">
          {error ? (
            <>{error}</>
          ) : (
            <>
              Add <span className="font-mono text-orange-200">VITE_MAPBOX_TOKEN</span> to enable live 3D buildings.
            </>
          )}{" "}
          This fallback keeps the demo layout intact.
        </div>
      </div>
    </div>
  );
}

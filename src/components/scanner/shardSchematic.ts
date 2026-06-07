// The Shard — native Mapbox 3D floor schematic.
//
// Floor-plate outlines were traced from the real published plans (OpenCV) into
// public/floorplans/shard/floors.json. Here we georeference each polygon to the
// tower footprint and render them as stacked `fill-extrusion` slabs at their true
// storey heights — pure native Mapbox, no three.js. The focused floor is
// highlighted and its actual plan image is draped flat below it for detail.
import type { Map as MapboxMap } from "mapbox-gl";

const FILL_ID = "shard-3d-fill";
const SRC_ID = "shard-3d-src";
const PLAN_SRC = "shard-plan-src";
const PLAN_LAYER = "shard-plan-layer";
const BEARING_DEG = 0;

export interface ShardFloor {
  level: number;
  label: string;
}

// Static list for the UI (geometry lives in floors.json).
export const SHARD_FLOORS: ShardFloor[] = [
  { level: 9, label: "Level 9" },
  { level: 10, label: "Level 10" },
  { level: 11, label: "Level 11" },
  { level: 26, label: "Level 26" },
];

interface FloorGeo {
  level: number;
  label: string;
  src: string;
  aspect: number;
  poly: [number, number][];
}
interface FloorsData {
  center: [number, number];
  footprintM: number;
  storeyM: number;
  slabM: number;
  floors: FloorGeo[];
}

let floorsCache: Promise<FloorsData> | null = null;
function loadFloors(): Promise<FloorsData> {
  if (!floorsCache) {
    floorsCache = fetch("/floorplans/shard/floors.json").then((r) => r.json());
  }
  return floorsCache;
}

/** Normalised (0..1, y-down) polygon → ring of [lng,lat] around the footprint. */
function georef(
  poly: [number, number][],
  aspect: number,
  center: [number, number],
  footprintM: number,
): [number, number][] {
  const [lng, lat] = center;
  const wM = footprintM;
  const hM = footprintM / aspect;
  const mLat = 111320;
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const br = (BEARING_DEG * Math.PI) / 180;
  const ring = poly.map(([nx, ny]): [number, number] => {
    const east = (nx - 0.5) * wM;
    const north = -(ny - 0.5) * hM; // image y is down → north is up
    const rx = east * Math.cos(br) - north * Math.sin(br);
    const ry = east * Math.sin(br) + north * Math.cos(br);
    return [lng + rx / mLng, lat + ry / mLat];
  });
  ring.push(ring[0]); // close the ring
  return ring;
}

function planCorners(
  aspect: number,
  center: [number, number],
  footprintM: number,
): [[number, number], [number, number], [number, number], [number, number]] {
  const [lng, lat] = center;
  const hw = footprintM / 2;
  const hh = footprintM / aspect / 2;
  const mLat = 111320;
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return [
    [lng - hw / mLng, lat + hh / mLat],
    [lng + hw / mLng, lat + hh / mLat],
    [lng + hw / mLng, lat - hh / mLat],
    [lng - hw / mLng, lat - hh / mLat],
  ];
}

function focusColor(focus: number) {
  return ["case", ["==", ["get", "level"], focus], "#8fd0ff", "#4a7fb5"] as unknown as string;
}

/** Render (or refocus) the 3D floor stack + the focused floor's ground plan. */
export async function showShardSchematic(map: MapboxMap, focus: number): Promise<void> {
  const data = await loadFloors();
  if (!map.getStyle()) return; // map torn down while loading

  const features = data.floors.map((f) => ({
    type: "Feature" as const,
    properties: {
      level: f.level,
      label: f.label,
      base: f.level * data.storeyM,
      height: f.level * data.storeyM + data.slabM,
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [georef(f.poly, f.aspect, data.center, data.footprintM)],
    },
  }));
  const fc = { type: "FeatureCollection" as const, features };

  // 3D extruded floor slabs.
  const existing = map.getSource(SRC_ID) as { setData?: (d: unknown) => void } | undefined;
  if (existing?.setData) {
    existing.setData(fc);
  } else {
    map.addSource(SRC_ID, { type: "geojson", data: fc });
    map.addLayer({
      id: FILL_ID,
      type: "fill-extrusion",
      source: SRC_ID,
      paint: {
        "fill-extrusion-base": ["get", "base"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.62,
        "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-color": focusColor(focus),
      },
    });
  }
  map.setPaintProperty(FILL_ID, "fill-extrusion-color", focusColor(focus));

  // Focused floor's real plan, draped flat on the footprint as the detail view.
  const f = data.floors.find((fl) => fl.level === focus) ?? data.floors[0];
  const coordinates = planCorners(f.aspect, data.center, data.footprintM);
  if (map.getLayer(PLAN_LAYER)) map.removeLayer(PLAN_LAYER);
  if (map.getSource(PLAN_SRC)) map.removeSource(PLAN_SRC);
  map.addSource(PLAN_SRC, { type: "image", url: f.src, coordinates });
  map.addLayer({
    id: PLAN_LAYER,
    type: "raster",
    source: PLAN_SRC,
    paint: { "raster-opacity": 0.95, "raster-fade-duration": 0, "raster-emissive-strength": 1 },
  });
}

export function removeShardSchematic(map: MapboxMap): void {
  for (const id of [FILL_ID, PLAN_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SRC_ID, PLAN_SRC]) if (map.getSource(id)) map.removeSource(id);
}

export const SHARD_FILL_LAYER = FILL_ID;

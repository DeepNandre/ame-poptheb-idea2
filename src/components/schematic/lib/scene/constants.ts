// Ported verbatim from the original index.html. Colours, layout constants, defaults.
import type { NodeType, ViewerState } from '@/components/schematic/lib/types';

// ── Colour palette ────────────────────────────────────────────────────────────
export const TYPE_COLORS: Record<NodeType, number> = {
  office: 0x4a90d9,
  core: 0x9b9b9b,
  circulation: 0x7ed321,
  plant: 0xf5a623,
  amenity: 0xbd10e0,
  residential: 0x50e3c2,
  external: 0x3a7d34, // outside areas / terraces — green, tied to the floor
  unknown: 0x666677,
};

export function colorForType(type: string): number {
  return (TYPE_COLORS as Record<string, number>)[type] ?? TYPE_COLORS.unknown;
}

export const STAIR_COLOR = 0xff6b4a;
export const LIFT_COLOR = 0xff3df0; // lift shafts: glowing magenta
export const DOOR_COLOR = 0xffffff;
export const ENTRANCE_COLOR = 0x00ff9c; // external portals: bright pulse
export const PARTITION_COLOR = 0xc8ccd8;
export const OUTER_WALL_COLOR = 0x8a94b0; // building envelope
export const BG_COLOR = 0x0a0a0f;
export const FLOOR_FILL_COLOR = 0x000000; // wall-bounded interior slab — black
export const GREEN_COLOR = 0x3a7d34; // site ground + outside areas (terraces)

// ── Layout constants ──────────────────────────────────────────────────────────
export const SCALE_XY = 20; // normalised 0-1 → world units
export const SCALE_Z = 1.0; // z (metres) → world units
export const FLOOR_W = 22; // square reference plate per level
export const PLATE_H = 0.08;
export const SLAB_H = 0.18; // per-room floor tile thickness
export const PARTITION_H = 2.4; // inner wall height
export const WALL_T = 0.07; // wall panel thickness
export const DOOR_H = 2.0;
export const MIN_FOOT = 0.6; // min footprint / wall length
export const GROUND_SIZE = 220; // green site plane around the building

// Lift shaft geometry
export const LIFT_SIZE = 1.1;
export const LIFT_WALL_T = 0.06;
export const LIFT_OVERRUN = 3.7; // bridges the gap between range-sheet segments

// ── Default toggle state ──────────────────────────────────────────────────────
// Plants are clutter → off by default. Labels off. Everything else on.
export const DEFAULT_CATEGORY_ENABLED: Record<string, boolean> = {
  office: true,
  amenity: true,
  core: true,
  circulation: true,
  residential: true,
  external: true,
  unknown: true,
  plant: false,
};

export const DEFAULT_VIEWER_STATE: ViewerState = {
  activeFloor: 'all',
  categoryEnabled: { ...DEFAULT_CATEGORY_ENABLED },
  stairsEnabled: true,
  liftsEnabled: true,
  partitionsEnabled: true,
  outerWallsEnabled: true,
  labelsEnabled: false,
  entrancesEnabled: true,
};

// Type-filter checkboxes shown in the UI (order matters).
export const TYPE_FILTER_ORDER = [
  'office',
  'amenity',
  'circulation',
  'core',
  'plant',
  'external',
  'unknown',
] as const;

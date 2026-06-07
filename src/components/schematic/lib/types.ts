// Single source of truth for all data + scene types.
// Per-file component agents MUST import from here and never redefine these shapes.
//
// Data contracts mirror the Python builders:
//   graph.json    ← graph_builder.py
//   walls.json    ← vector_extract.py
//   building.json ← security_graph_builder.py
//
// NOTE: `floor` is a NUMBER in graph.json but a STRING ("L0a") in building.json.
// Visibility/filtering normalises everything to string via String().

// ── Room / node category ──────────────────────────────────────────────────────
export type NodeType =
  | 'office'
  | 'core'
  | 'circulation'
  | 'plant'
  | 'amenity'
  | 'residential'
  | 'external'
  | 'unknown';

// ── graph.json ────────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  floor: number;
  x: number;
  y: number;
  z: number;
  w?: number;
  h?: number;
}

export type EdgeType = 'intra' | 'inter';

export interface Edge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface Floor {
  level: number;
  z: number;
  label: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: Edge[];
  floors: Floor[];
}

// ── walls.json ────────────────────────────────────────────────────────────────
// A segment is [x1, y1, x2, y2] in normalised 0-1 plan coords.
export type WallSeg = [number, number, number, number];

// New schema: { inner, outer }. Legacy schema: a flat array (treated as inner).
export interface WallsFloorObj {
  inner?: WallSeg[];
  outer?: WallSeg[];
}
export type WallsFloor = WallsFloorObj | WallSeg[];

export interface WallsFile {
  scale?: number;
  schema?: string;
  floors: Record<string, WallsFloor>; // key is the floor level as a string
}

// ── building.json (portal graph) ──────────────────────────────────────────────
export interface BuildingNode {
  id: string;
  kind: string; // 'portal' for entrances/exits
  portal_kind?: string; // 'door' | 'lift' | 'stair' | ...
  is_external?: boolean;
  floor: string; // STRING here, e.g. "L0a"
  x: number;
  y: number;
  z: number;
  w?: number;
  h?: number;
  core_id?: string | null;
  via?: string;
  entrance_depth?: number;
  label?: string;
  type?: string;
}

export interface Building {
  nodes: BuildingNode[];
  edges: Edge[];
  floors?: unknown[];
}

// ── Loaded bundle ─────────────────────────────────────────────────────────────
export interface LoadedData {
  graph: Graph;
  walls: WallsFile | null; // null → fall back to adjacency-derived partitions
  building: Building | null; // null → no entrance beacons
}

// ── Scene unit metadata (drives visibility + interaction) ─────────────────────
export type UnitKind =
  | 'floor' // room slab
  | 'core' // core marker
  | 'stair'
  | 'lift'
  | 'link' // generic vertical link
  | 'entrance'
  | 'partition' // inner wall (adjacency or vector)
  | 'wall' // vector inner wall mesh
  | 'outerwall'
  | 'plate' // per-level reference plate
  | 'label';

export interface UnitMeta {
  id: string; // stable, unique — used by the hide/undo/redo reducer
  kind: UnitKind;
  floorLevel: string; // normalised String(floor)
  label: string;
  type?: NodeType | string; // category for room slabs
  isCore?: boolean;
  isEntrance?: boolean;
  isPartition?: boolean;
  isOuterWall?: boolean;
  isLabel?: boolean;
}

// ── Viewer toggle state ───────────────────────────────────────────────────────
export interface ViewerState {
  activeFloor: string; // 'all' or a level string
  categoryEnabled: Record<string, boolean>;
  stairsEnabled: boolean;
  liftsEnabled: boolean;
  partitionsEnabled: boolean;
  outerWallsEnabled: boolean;
  labelsEnabled: boolean;
  entrancesEnabled: boolean;
}

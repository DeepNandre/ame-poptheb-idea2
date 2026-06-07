// Pure geometry math, ported verbatim from index.html. No Three.js, no React —
// every function returns plain data so it can be unit-tested in isolation.
import type { GraphNode, WallSeg } from '@/components/schematic/lib/types';
import {
  SCALE_XY,
  SCALE_Z,
  PARTITION_H,
  MIN_FOOT,
  LIFT_SIZE,
  LIFT_WALL_T,
  LIFT_OVERRUN,
} from './constants';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A box primitive: full dimensions + centre position. */
export interface Box {
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
}

// ── normalised plan → world XZ ────────────────────────────────────────────────
export function worldXZ(n: { x: number; y: number }): [number, number] {
  return [n.x * SCALE_XY, n.y * SCALE_XY];
}

// ── Outer wall loop → ordered world-XZ polygon ────────────────────────────────
// The `outer` segments of a floor enclose the building envelope. Chain them
// head-to-tail into an ordered ring of [worldX, worldZ] points so the floor slab
// can be filled to "span the walls". Robust to reversed/unordered segments; the
// final duplicate (loop closure) is dropped so THREE.Shape closes it implicitly.
export function outerRing(segs: WallSeg[]): [number, number][] {
  if (segs.length === 0) return [];
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-2;
  const used = new Array(segs.length).fill(false);
  const W = (n: number) => n * SCALE_XY;

  const [s0x, s0y, , ] = segs[0];
  used[0] = true;
  const ring: [number, number][] = [[W(s0x), W(s0y)]];
  let curX = segs[0][2];
  let curY = segs[0][3];

  for (let step = 1; step < segs.length; step++) {
    // Stop before re-appending the start vertex (closed loop).
    if (eq(curX, s0x) && eq(curY, s0y)) break;
    ring.push([W(curX), W(curY)]);

    let found = -1;
    let rev = false;
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const s = segs[i];
      if (eq(s[0], curX) && eq(s[1], curY)) { found = i; rev = false; break; }
      if (eq(s[2], curX) && eq(s[3], curY)) { found = i; rev = true; break; }
    }
    if (found < 0) break;
    used[found] = true;
    const s = segs[found];
    curX = rev ? s[0] : s[2];
    curY = rev ? s[1] : s[3];
  }
  return ring;
}

// ── Switchback stair run for one storey (pa/pb in WORLD space) ────────────────
// Treads are contiguous; each has a riser; a landing joins the two flights.
export function stairSteps(pa: Vec3, pb: Vec3): Box[] {
  const lower = pa.y <= pb.y ? pa : pb;
  const upper = pa.y <= pb.y ? pb : pa;
  const rise = upper.y - lower.y;
  if (rise < 0.01) return [];

  const boxes: Box[] = [];
  const cx = (lower.x + upper.x) / 2;
  const cz = (lower.z + upper.z) / 2;

  const perFlight = 6;
  const flights = 2;
  const total = perFlight * flights;
  const stepRise = rise / total;
  const flightRun = 2.2;
  const treadW = flightRun / perFlight;
  const treadDepth = 0.9;
  const zHalf = treadDepth / 2 + 0.05;
  const treadThick = Math.min(0.07, stepRise * 0.5);

  for (let i = 0; i < total; i++) {
    const flight = Math.floor(i / perFlight);
    const inFlight = i % perFlight;
    const dir = flight % 2 === 0 ? 1 : -1;
    const z = cz + (flight % 2 === 0 ? -zHalf : zHalf);
    const xStart = cx - (dir * flightRun) / 2;
    const x = xStart + dir * (inFlight + 0.5) * treadW;
    const yTop = lower.y + (i + 1) * stepRise;
    // tread
    boxes.push({ w: treadW, h: treadThick, d: treadDepth, x, y: yTop, z });
    // riser
    boxes.push({
      w: treadThick,
      h: stepRise,
      d: treadDepth,
      x: x - (dir * treadW) / 2,
      y: yTop - stepRise / 2,
      z,
    });
  }
  // landing joining the two flights at the turn (top of flight 0)
  const yLand = lower.y + perFlight * stepRise;
  const xTurn = cx + flightRun / 2;
  boxes.push({
    w: treadW,
    h: treadThick,
    d: 2 * zHalf + treadDepth,
    x: xTurn,
    y: yLand,
    z: cz,
  });
  return boxes;
}

// ── Continuous lift shaft (four glassy walls + four edge posts) ───────────────
export interface LiftColumn {
  walls: Box[];
  posts: Box[];
  yc: number;
  h: number;
}
export function liftColumn(
  cx: number,
  cz: number,
  y0: number,
  y1: number
): LiftColumn | null {
  const top = y1 + LIFT_OVERRUN; // motor-room overrun above top served floor
  const h = top - y0;
  if (h < 0.01) return null;
  const yc = (y0 + top) / 2;
  const half = LIFT_SIZE / 2;

  const walls: Box[] = [
    { w: LIFT_SIZE, h, d: LIFT_WALL_T, x: cx, y: yc, z: cz - half }, // front
    { w: LIFT_SIZE, h, d: LIFT_WALL_T, x: cx, y: yc, z: cz + half }, // back
    { w: LIFT_WALL_T, h, d: LIFT_SIZE, x: cx - half, y: yc, z: cz }, // left
    { w: LIFT_WALL_T, h, d: LIFT_SIZE, x: cx + half, y: yc, z: cz }, // right
  ];

  const posts: Box[] = [];
  for (const sx of [-half, half]) {
    for (const sz of [-half, half]) {
      posts.push({ w: 0.05, h, d: 0.05, x: cx + sx, y: yc, z: cz + sz });
    }
  }
  return { walls, posts, yc, h };
}

// ── Group lift cores across floors into continuous columns ────────────────────
export interface LiftBucket {
  key: string;
  cx: number;
  cz: number;
  y0: number;
  y1: number;
}
export function liftBuckets(nodes: GraphNode[]): LiftBucket[] {
  const cols: Record<string, { xs: number[]; ys: number[]; zs: number[] }> = {};
  for (const n of nodes) {
    if (n.type !== 'core') continue;
    if (!(n.label || '').toLowerCase().includes('lift')) continue;
    // coarse bucket (~0.5 world units) so a lift that drifts per floor still merges
    const key = `${Math.round(n.x * 40)}_${Math.round(n.y * 40)}`;
    (cols[key] ||= { xs: [], ys: [], zs: [] });
    cols[key].xs.push(n.x);
    cols[key].ys.push(n.y);
    cols[key].zs.push(n.z * SCALE_Z);
  }
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const out: LiftBucket[] = [];
  for (const [key, col] of Object.entries(cols)) {
    if (col.zs.length < 2) continue; // need at least two floors to be a shaft
    out.push({
      key,
      cx: avg(col.xs) * SCALE_XY,
      cz: avg(col.ys) * SCALE_XY,
      y0: Math.min(...col.zs),
      y1: Math.max(...col.zs),
    });
  }
  return out;
}

// ── Single wall segment (walls.json) → world transform for one mesh ───────────
export interface WallTransform {
  len: number;
  thickness: number;
  height: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
}
export function wallSegTransform(
  seg: [number, number, number, number],
  baseY: number,
  thickness: number
): WallTransform | null {
  const [x1, y1, x2, y2] = seg;
  const ax = x1 * SCALE_XY;
  const az = y1 * SCALE_XY;
  const bx = x2 * SCALE_XY;
  const bz = y2 * SCALE_XY;
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return null;
  return {
    len,
    thickness,
    height: PARTITION_H,
    x: (ax + bx) / 2,
    y: baseY + PARTITION_H / 2,
    z: (az + bz) / 2,
    rotY: -Math.atan2(dz, dx),
  };
}

// ── Adjacency partition placement (fallback when walls.json absent) ───────────
export interface PartitionPlacement {
  orientation: 'x' | 'z'; // axis the wall RUNS along
  xc: number;
  zc: number;
  len: number;
  baseY: number;
}
export function partitionPlacement(
  a: GraphNode,
  b: GraphNode
): PartitionPlacement {
  const ax = a.x * SCALE_XY;
  const az = a.y * SCALE_XY;
  const bx = b.x * SCALE_XY;
  const bz = b.y * SCALE_XY;
  const aw = Math.max((a.w || 0) * SCALE_XY, MIN_FOOT);
  const ad = Math.max((a.h || 0) * SCALE_XY, MIN_FOOT);
  const bw = Math.max((b.w || 0) * SCALE_XY, MIN_FOOT);
  const bd = Math.max((b.h || 0) * SCALE_XY, MIN_FOOT);
  const baseY = a.z * SCALE_Z;
  const dx = bx - ax;
  const dz = bz - az;

  if (Math.abs(dx) >= Math.abs(dz)) {
    // vertical interface → wall runs along Z at x = midpoint
    const x = (ax + bx) / 2;
    const lo = Math.max(az - ad / 2, bz - bd / 2);
    const hi = Math.min(az + ad / 2, bz + bd / 2);
    let len = hi - lo;
    let zc = (lo + hi) / 2;
    if (len < MIN_FOOT) {
      len = Math.min(ad, bd) * 0.8;
      zc = (az + bz) / 2;
    }
    return { orientation: 'z', xc: x, zc, len, baseY };
  } else {
    const z = (az + bz) / 2;
    const lo = Math.max(ax - aw / 2, bx - bw / 2);
    const hi = Math.min(ax + aw / 2, bx + bw / 2);
    let len = hi - lo;
    let xc = (lo + hi) / 2;
    if (len < MIN_FOOT) {
      len = Math.min(aw, bw) * 0.8;
      xc = (ax + bx) / 2;
    }
    return { orientation: 'x', xc, zc: z, len, baseY };
  }
}

// ── Door-gap split for an inner wall of a given length ────────────────────────
// `offset` is along the wall's running axis from its centre.
export interface DoorGap {
  solid: boolean;
  segments: { offset: number; len: number }[];
  door: { width: number } | null;
}
export function doorGap(len: number): DoorGap {
  if (len < 2.0) {
    return { solid: true, segments: [{ offset: 0, len }], door: null };
  }
  const doorW = Math.min(1.4, len * 0.45);
  const seg = (len - doorW) / 2;
  const offs = doorW / 2 + seg / 2;
  return {
    solid: false,
    segments: [
      { offset: -offs, len: seg },
      { offset: offs, len: seg },
    ],
    door: { width: doorW * 0.9 },
  };
}

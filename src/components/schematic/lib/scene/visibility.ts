// Pure visibility model, ported from applyVisibility() in index.html.
// isVisible(meta, state, hidden) → whether a scene unit should render.
import type { UnitMeta, ViewerState } from '@/components/schematic/lib/types';

export function isVisible(
  meta: UnitMeta,
  state: ViewerState,
  hidden: ReadonlySet<string>
): boolean {
  if (hidden.has(meta.id)) return false;

  // Vertical circulation (stairs / lifts / generic links) ignores the floor filter.
  if (meta.isCore) {
    if (meta.kind === 'stair') return state.stairsEnabled;
    if (meta.kind === 'lift') return state.liftsEnabled;
    return state.stairsEnabled || state.liftsEnabled;
  }

  const floorOK =
    state.activeFloor === 'all' || meta.floorLevel === state.activeFloor;
  if (!floorOK) return false;

  if (meta.isEntrance) return state.entrancesEnabled;
  if (meta.isPartition) return state.partitionsEnabled;
  if (meta.isOuterWall) return state.outerWallsEnabled;
  if (meta.isLabel) return state.labelsEnabled;
  if (meta.kind === 'plate') return true;

  // Room slabs / core markers → category filter (missing category defaults to on).
  const cat = meta.type ?? 'unknown';
  return state.categoryEnabled[cat] !== false;
}

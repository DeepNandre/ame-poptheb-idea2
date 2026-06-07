// Shared component contracts. Scene.tsx (composer) and every leaf scene component
// agree on these prop shapes so the per-file fan-out stays consistent.
import type {
  Graph,
  WallsFile,
  Building,
  ViewerState,
  UnitMeta,
} from '@/components/schematic/lib/types';

/** Visibility + interaction wiring every scene unit needs. */
export interface UnitHandlers {
  state: ViewerState;
  hidden: ReadonlySet<string>;
  onHover: (meta: UnitMeta | null) => void;
  onHide: (id: string) => void;
}

export interface GraphProps extends UnitHandlers {
  graph: Graph;
}
export interface WallsProps extends UnitHandlers {
  graph: Graph;
  walls: WallsFile;
}
export interface BuildingProps extends UnitHandlers {
  building: Building;
}

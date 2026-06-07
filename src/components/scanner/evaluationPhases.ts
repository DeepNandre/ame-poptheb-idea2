// Phase definitions for the building-evaluation pipeline.
//
// A "phase" is a user-facing group of one or more backend sources (from the
// aggregator REGISTRY). The pipeline shows each phase as a progress row; its
// sub-steps are the individual sources, which tick off as their SSE events land.
//
// `IDENTITY_STEP` is the address→UPRN resolve that always runs first; the engine
// emits it as an `identity` event (not a `source` event), so it's tracked apart.

import {
  Building2,
  Gauge,
  Home,
  Landmark,
  MapPin,
  ShieldAlert,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";

export const IDENTITY_STEP = "identity";

export interface PhaseStep {
  /** Source name as emitted by the engine, or IDENTITY_STEP. */
  source: string;
  label: string;
}

export interface PhaseDef {
  key: string;
  label: string;
  icon: LucideIcon;
  steps: PhaseStep[];
  /** Synthesis phase — no sources of its own; completes when `done` lands. */
  synth?: boolean;
  /** Always run, regardless of subset selection (locate + risk). */
  always?: boolean;
}

export const PHASES: PhaseDef[] = [
  {
    key: "locate",
    label: "Locate & identity",
    icon: MapPin,
    always: true,
    steps: [
      { source: IDENTITY_STEP, label: "Resolve address → UPRN" },
      { source: "osLinkedIds", label: "OS linked IDs (TOID · USRN)" },
    ],
  },
  {
    key: "safety",
    label: "Crime & safety",
    icon: ShieldAlert,
    steps: [
      { source: "police", label: "Street-level crime (police.uk)" },
      { source: "foodHygiene", label: "Food hygiene ratings (FSA)" },
      { source: "cqc", label: "Care Quality Commission" },
    ],
  },
  {
    key: "environment",
    label: "Environment & ground",
    icon: Waves,
    steps: [
      { source: "flood", label: "Flood risk & live warnings (EA)" },
      { source: "groundStability", label: "Ground stability (BGS GeoSure)" },
      { source: "deprivation", label: "Deprivation (IMD)" },
    ],
  },
  {
    key: "planning",
    label: "Planning & heritage",
    icon: Landmark,
    steps: [
      { source: "planningApps", label: "Planning applications" },
      { source: "planningData", label: "Designations & listings" },
    ],
  },
  {
    key: "property",
    label: "Ownership & property",
    icon: Home,
    steps: [
      { source: "landRegistry", label: "Sales history (Land Registry)" },
      { source: "epc", label: "Energy performance (EPC)" },
      { source: "voa", label: "Council tax & rates (VOA)" },
    ],
  },
  {
    key: "occupants",
    label: "Occupants & transport",
    icon: Users,
    steps: [
      { source: "companiesHouse", label: "Companies at address" },
      { source: "charities", label: "Registered charities" },
      { source: "tfl", label: "Transport connectivity (TfL)" },
    ],
  },
  {
    key: "risk",
    label: "Risk synthesis",
    icon: Gauge,
    synth: true,
    always: true,
    steps: [{ source: "__risk__", label: "Compute explainable risk index" }],
  },
];

/** Phases the user can pick à la carte in the "Ask specific" dropdown. */
export const SELECTABLE_PHASES = PHASES.filter((p) => !p.always);

/** Icon for the floating-window header. */
export { Building2 as EvaluateIcon };

/** Resolve a set of selected phase keys to the phases that will actually run. */
export function resolvePhases(selectedKeys: string[] | null): PhaseDef[] {
  if (!selectedKeys || selectedKeys.length === 0) return PHASES; // full evaluate
  const chosen = new Set(selectedKeys);
  return PHASES.filter((p) => p.always || chosen.has(p.key));
}

/** The backend `only` list: every real source across the resolved phases. */
export function sourcesFor(phases: PhaseDef[]): string[] {
  const out: string[] = [];
  for (const p of phases) {
    if (p.synth) continue;
    for (const s of p.steps) {
      if (s.source !== IDENTITY_STEP) out.push(s.source);
    }
  }
  return out;
}

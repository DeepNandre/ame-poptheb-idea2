// Phase definitions for the offensive-recon pipeline (the "second process",
// distinct from the public-data building evaluation in evaluationPhases.ts).
//
// Source of truth: building-scanner/backend/PHASES.md. Four top-level phases:
//   A — Schematic discovery & 3D   (A0 discovery → A1 ingestion/3D)
//   B — People research            (parallel with A)
//   C — OSINT                      (parallel with A + B)
//   D — Ingestion & memory         (gated: runs after A + B + C)
//
// This is PURELY a frontend visual — no backend/SSE. Each step's `ms` is the
// simulated duration the pipeline animation ticks through.

import { Boxes, Brain, Cctv, Users, type LucideIcon } from "lucide-react";

export interface ReconStep {
  label: string;
  /** Simulated duration (ms) — drives the visual progress timing. */
  ms: number;
}

export interface ReconPhaseDef {
  key: string;
  label: string;
  icon: LucideIcon;
  steps: ReconStep[];
  /** Phase keys that must finish before this one starts (gating). */
  after?: string[];
}

export const RECON_PHASES: ReconPhaseDef[] = [
  {
    key: "schematic",
    label: "Schematic discovery & 3D",
    icon: Boxes,
    steps: [
      { label: "Search planning portals · FOI · hire packs", ms: 900 },
      { label: "Locate floor plans & architectural docs", ms: 1300 },
      { label: "Ingest docs · extract spatial features", ms: 1700 },
      { label: "Build floor-by-floor 3D model", ms: 2100 },
    ],
  },
  {
    key: "people",
    label: "People research",
    icon: Users,
    steps: [
      { label: "Scout organisation website", ms: 800 },
      { label: "Search LinkedIn for staff", ms: 1400 },
      { label: "Enrich each person via API", ms: 2000 },
    ],
  },
  {
    key: "osint",
    label: "OSINT",
    icon: Cctv,
    steps: [
      { label: "Cameras · Shodan & public feeds", ms: 1000 },
      { label: "Access control · RFID/NFC signals", ms: 1500 },
      { label: "Internet-exposed services", ms: 1900 },
    ],
  },
  {
    key: "memory",
    label: "Ingestion & memory",
    icon: Brain,
    after: ["schematic", "people", "osint"],
    steps: [
      { label: "Ingest schematic · people · OSINT findings", ms: 700 },
      { label: "Build building memory graph", ms: 1200 },
      { label: "Surface suggested leads & next steps", ms: 1600 },
    ],
  },
];

/** Every phase is selectable à la carte in the dropdown. */
export const SELECTABLE_RECON = RECON_PHASES;

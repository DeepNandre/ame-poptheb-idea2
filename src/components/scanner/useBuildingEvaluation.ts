// State machine + stream lifecycle for the building-evaluation pipeline.
//
// start(target, selectedKeys) opens an SSE evaluation, folds each source event
// into per-phase progress, and (on completion) primes the building memo so the
// results deck opens its intelligence instantly. Honest progress: every step is
// genuinely "pending" until its real event arrives — nothing is faked.

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { primeBuilding, type SectionStatus, type UnifiedBuilding } from "@/lib/building";
import { streamEvaluation } from "@/lib/buildingStream";
import { IDENTITY_STEP, resolvePhases, sourcesFor, type PhaseDef } from "./evaluationPhases";

export type StepStatus = "pending" | SectionStatus;
export type PhaseStatus = "running" | "done";
export type EvalMode = "idle" | "running" | "results";

export interface StepState {
  source: string;
  label: string;
  status: StepStatus;
  ms?: number;
}

export interface PhaseState {
  key: string;
  label: string;
  icon: LucideIcon;
  synth: boolean;
  status: PhaseStatus;
  steps: StepState[];
}

export interface EvalTarget {
  name: string;
  address?: string;
  coords: [number, number]; // [lng, lat]
}

const settled = (s: StepStatus) => s !== "pending";

function initPhases(defs: PhaseDef[]): PhaseState[] {
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    icon: d.icon,
    synth: !!d.synth,
    status: "running",
    steps: d.steps.map((s) => ({ source: s.source, label: s.label, status: "pending" as StepStatus })),
  }));
}

export function useBuildingEvaluation() {
  const [mode, setMode] = useState<EvalMode>("idle");
  const [phases, setPhases] = useState<PhaseState[]>([]);
  const [building, setBuilding] = useState<UnifiedBuilding | null>(null);
  const [target, setTarget] = useState<EvalTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const cancelRef = useRef<(() => void) | null>(null);
  const startedAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // Mark a single step's outcome and recompute its phase's done state.
  const settleStep = useCallback((source: string, status: StepStatus, ms?: number) => {
    setPhases((prev) =>
      prev.map((p) => {
        if (!p.steps.some((s) => s.source === source)) return p;
        const steps = p.steps.map((s) =>
          s.source === source ? { ...s, status, ms } : s,
        );
        const allDone = steps.every((s) => settled(s.status));
        return { ...p, steps, status: allDone ? "done" : "running" };
      }),
    );
  }, []);

  const reset = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    stopTimer();
    setMode("idle");
    setPhases([]);
    setBuilding(null);
    setTarget(null);
    setError(null);
    setComplete(false);
    setElapsed(0);
  }, [stopTimer]);

  const start = useCallback(
    (t: EvalTarget, selectedKeys: string[] | null) => {
      cancelRef.current?.();
      stopTimer();

      const defs = resolvePhases(selectedKeys);
      setTarget(t);
      setPhases(initPhases(defs));
      setBuilding(null);
      setError(null);
      setComplete(false);
      setMode("running");

      startedAt.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }, 250);

      const q = { lat: t.coords[1], lng: t.coords[0], address: t.address };

      cancelRef.current = streamEvaluation(q, sourcesFor(defs), {
        onIdentity: () => settleStep(IDENTITY_STEP, "ok"),
        onSource: (ev) => settleStep(ev.name, ev.status, ev.ms),
        onDone: (b) => {
          setBuilding(b);
          primeBuilding(q, b);
          // Synthesis phase resolves the moment the full object lands.
          settleStep("__risk__", b.risk?.status ?? "ok");
          setComplete(true);
          stopTimer();
        },
        onError: (msg) => {
          setError(msg);
          stopTimer();
        },
      });
    },
    [settleStep, stopTimer],
  );

  const showResults = useCallback(() => setMode("results"), []);

  useEffect(() => () => {
    cancelRef.current?.();
    stopTimer();
  }, [stopTimer]);

  return {
    mode,
    phases,
    building,
    target,
    error,
    complete,
    elapsed,
    start,
    reset,
    showResults,
  };
}

export type Evaluation = ReturnType<typeof useBuildingEvaluation>;

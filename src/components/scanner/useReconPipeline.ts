// Frontend-only state machine for the offensive-recon pipeline. No SSE, no
// backend — phases tick through their steps on timers. A · B · C run in
// parallel from t=0; D ("Ingestion & memory") is gated and only starts once its
// in-run prerequisites have finished. Selecting a subset runs just those phases
// (and re-bases D's gate onto whichever prerequisites are present).

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { RECON_PHASES, type ReconPhaseDef } from "./reconPhases";

export type ReconMode = "idle" | "running";
export type ReconStepStatus = "pending" | "ok";
export type ReconPhaseStatus = "queued" | "running" | "done";

export interface ReconStepState {
  label: string;
  status: ReconStepStatus;
  ms?: number;
}

export interface ReconPhaseState {
  key: string;
  label: string;
  icon: LucideIcon;
  status: ReconPhaseStatus;
  steps: ReconStepState[];
}

export interface ReconTarget {
  name: string;
}

function resolve(selected: string[] | null): ReconPhaseDef[] {
  if (!selected || selected.length === 0) return RECON_PHASES;
  const set = new Set(selected);
  return RECON_PHASES.filter((p) => set.has(p.key));
}

export function useReconPipeline() {
  const [mode, setMode] = useState<ReconMode>("idle");
  const [phases, setPhases] = useState<ReconPhaseState[]>([]);
  const [target, setTarget] = useState<ReconTarget | null>(null);
  const [complete, setComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setMode("idle");
    setPhases([]);
    setTarget(null);
    setComplete(false);
    setElapsed(0);
  }, [clearAll]);

  const start = useCallback(
    (t: ReconTarget, selected: string[] | null) => {
      clearAll();
      const defs = resolve(selected);
      const present = new Set(defs.map((d) => d.key));

      // A phase runs its steps sequentially → total = sum of step durations.
      const phaseDur = (d: ReconPhaseDef) => d.steps.reduce((a, s) => a + s.ms, 0);
      // Gated phases start after the slowest in-run prerequisite finishes.
      const startOffset = (d: ReconPhaseDef) => {
        const prereqs = (d.after ?? []).filter((k) => present.has(k));
        if (!prereqs.length) return 0;
        return Math.max(...defs.filter((x) => prereqs.includes(x.key)).map(phaseDur));
      };

      setTarget(t);
      setComplete(false);
      setMode("running");
      setPhases(
        defs.map((d) => ({
          key: d.key,
          label: d.label,
          icon: d.icon,
          status: startOffset(d) === 0 ? "running" : "queued",
          steps: d.steps.map((s) => ({ label: s.label, status: "pending" as ReconStepStatus })),
        })),
      );

      startedAt.current = Date.now();
      setElapsed(0);
      tick.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }, 250);

      let finishAt = 0;
      for (const d of defs) {
        const base = startOffset(d);
        // Flip a gated phase queued → running the moment its wait ends.
        if (base > 0) {
          timers.current.push(
            setTimeout(() => {
              setPhases((prev) =>
                prev.map((p) =>
                  p.key === d.key && p.status === "queued" ? { ...p, status: "running" } : p,
                ),
              );
            }, base),
          );
        }
        let acc = base;
        d.steps.forEach((s, i) => {
          acc += s.ms;
          const at = acc;
          finishAt = Math.max(finishAt, at);
          timers.current.push(
            setTimeout(() => {
              setPhases((prev) =>
                prev.map((p) => {
                  if (p.key !== d.key) return p;
                  const steps = p.steps.map((st, j) =>
                    j === i ? { ...st, status: "ok" as ReconStepStatus, ms: s.ms } : st,
                  );
                  const allDone = steps.every((st) => st.status === "ok");
                  return { ...p, steps, status: allDone ? "done" : "running" };
                }),
              );
            }, at),
          );
        });
      }

      timers.current.push(
        setTimeout(() => {
          setComplete(true);
          if (tick.current) {
            clearInterval(tick.current);
            tick.current = null;
          }
        }, finishAt + 150),
      );
    },
    [clearAll],
  );

  useEffect(() => () => clearAll(), [clearAll]);

  return { mode, phases, target, complete, elapsed, start, reset };
}

export type Recon = ReturnType<typeof useReconPipeline>;

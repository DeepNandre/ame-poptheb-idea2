// Drives the offensive-recon pipeline against the real Python backends.
//
//   schematic → pipeline_app.py  POST /buildings → /discover → /ingest   (poll)
//   people    → pipeline_app.py  /occupants → /people                     (poll)
//   osint     → api.py           GET /health → POST /scan (VPN-gated, sync)
//   memory    → no backend — gated, simulated on timers as a visual cap-off
//
// schematic · people · osint run in parallel from t=0; memory waits for whichever
// of them are present in the run, then ticks through on timers. A · B · C each
// degrade to a "skipped" (n/a) state rather than failing the whole run when their
// backend isn't reachable / configured (no docs, no postcode, VPN down, no URL).

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { RECON_PHASES, type ReconPhaseDef } from "./reconPhases";
import {
  addBuilding,
  runPipelinePhase,
  runScan,
  scanHealth,
  ReconHttpError,
  type JobStatus,
} from "./reconApi";

export type ReconMode = "idle" | "running";
export type ReconStepStatus = "pending" | "running" | "ok" | "skipped" | "error";
export type ReconPhaseStatus = "queued" | "running" | "done" | "skipped" | "error";

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
  note?: string;
  steps: ReconStepState[];
}

export interface ReconTarget {
  name: string;
  /** Postal address — drives the blueprint/occupancy pipeline (slug + postcode). */
  address?: string;
  /** Company URL — drives the VPN-gated OSINT scan. Optional; OSINT skips without it. */
  url?: string;
}

function resolve(selected: string[] | null): ReconPhaseDef[] {
  if (!selected || selected.length === 0) return RECON_PHASES;
  const set = new Set(selected);
  return RECON_PHASES.filter((p) => set.has(p.key));
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });

export function useReconPipeline() {
  const [mode, setMode] = useState<ReconMode>("idle");
  const [phases, setPhases] = useState<ReconPhaseState[]>([]);
  const [target, setTarget] = useState<ReconTarget | null>(null);
  const [complete, setComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const abort = useRef<AbortController | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stopClock = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    stopClock();
    setMode("idle");
    setPhases([]);
    setTarget(null);
    setComplete(false);
    setElapsed(0);
  }, [stopClock]);

  const start = useCallback(
    (t: ReconTarget, selected: string[] | null) => {
      abort.current?.abort();
      stopClock();
      const ctl = new AbortController();
      abort.current = ctl;
      const signal = ctl.signal;

      const defs = resolve(selected);
      const present = new Set(defs.map((d) => d.key));

      setTarget(t);
      setComplete(false);
      setMode("running");
      setPhases(
        defs.map((d) => ({
          key: d.key,
          label: d.label,
          icon: d.icon,
          // memory is gated; everything else starts immediately.
          status: d.after?.some((k) => present.has(k)) ? "queued" : "running",
          steps: d.steps.map((s) => ({ label: s.label, status: "pending" as ReconStepStatus })),
        })),
      );

      startedAt.current = Date.now();
      setElapsed(0);
      tick.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }, 250);

      // ── state mutators (closed over setPhases) ──────────────────────────────
      const setStep = (key: string, i: number, status: ReconStepStatus, ms?: number) =>
        setPhases((prev) =>
          prev.map((p) =>
            p.key === key
              ? {
                  ...p,
                  steps: p.steps.map((st, j) =>
                    j === i ? { ...st, status, ...(ms != null ? { ms } : {}) } : st,
                  ),
                }
              : p,
          ),
        );
      const setStepsFrom = (key: string, from: number, status: ReconStepStatus) =>
        setPhases((prev) =>
          prev.map((p) =>
            p.key === key
              ? { ...p, steps: p.steps.map((st, j) => (j >= from ? { ...st, status } : st)) }
              : p,
          ),
        );
      const setPhase = (key: string, status: ReconPhaseStatus, note?: string) =>
        setPhases((prev) =>
          prev.map((p) => (p.key === key ? { ...p, status, ...(note ? { note } : {}) } : p)),
        );

      // 422 (no data: no docs/postcode/org-IP) and 503 (key/VPN missing) are
      // "can't run here", not "broke" — show as skipped. Anything else is an error.
      const degrade = (key: string, e: unknown, runningFromStep = 0) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        const soft = e instanceof ReconHttpError && (e.status === 422 || e.status === 503);
        setStepsFrom(key, runningFromStep, soft ? "skipped" : "error");
        setPhase(key, soft ? "skipped" : "error", soft ? "unavailable" : "failed");
      };

      // ── A: schematic discovery & 3D (discover → ingest) ─────────────────────
      const runSchematic = async (slug: string) => {
        try {
          setStep("schematic", 0, "running");
          const dis = await runPipelinePhase(slug, "discover", {
            signal,
            onTick: (j: JobStatus) => {
              if (((j.docs_found as number) ?? 0) > 0) setStep("schematic", 0, "ok");
            },
          });
          if (dis.status === "failed") return degrade("schematic", new Error(dis.error || ""), 1);
          const docs = (dis.docs_found as number) ?? 0;
          setStep("schematic", 0, "ok");
          setStep("schematic", 1, docs > 0 ? "ok" : "skipped");
          if (docs === 0) {
            setStep("schematic", 2, "skipped");
            setStep("schematic", 3, "skipped");
            return setPhase("schematic", "skipped", "no blueprints found");
          }
          setStep("schematic", 2, "running");
          const ing = await runPipelinePhase(slug, "ingest", {
            signal,
            onTick: (j: JobStatus) => {
              if (((j.docs_processed as number) ?? 0) > 0) setStep("schematic", 2, "ok");
            },
          });
          if (ing.status === "failed") {
            setStep("schematic", 2, "error");
            setStep("schematic", 3, "error");
            return setPhase("schematic", "error", "ingest failed");
          }
          setStep("schematic", 2, "ok");
          setStep("schematic", 3, "ok");
          setPhase("schematic", "done");
        } catch (e) {
          degrade("schematic", e);
        }
      };

      // ── B: people research (occupants → people) ─────────────────────────────
      const runPeople = async (slug: string) => {
        try {
          setStep("people", 0, "running");
          const occ = await runPipelinePhase(slug, "occupants", {
            signal,
            startBody: { active_only: true },
            onTick: (j: JobStatus) => {
              if (j.company_count != null) setStep("people", 0, "ok");
            },
          });
          if (occ.status === "failed") return degrade("people", new Error(occ.error || ""), 1);
          setStep("people", 0, "ok");
          setStep("people", 1, "ok"); // companies located
          setStep("people", 2, "running");
          const ppl = await runPipelinePhase(slug, "people", {
            signal,
            startBody: { enrich: true },
          });
          if (ppl.status === "failed") {
            setStep("people", 2, "error");
            return setPhase("people", "error", "enrich failed");
          }
          setStep("people", 2, "ok", undefined);
          setPhase("people", "done", `${(ppl.people_count as number) ?? 0} people`);
        } catch (e) {
          degrade("people", e);
        }
      };

      // ── C: OSINT (VPN-gated synchronous scan) ───────────────────────────────
      const runOsint = async () => {
        if (!t.url) {
          setStepsFrom("osint", 0, "skipped");
          return setPhase("osint", "skipped", "no company URL");
        }
        try {
          const health = await scanHealth().catch(() => null);
          if (!health?.vpn_up) {
            setStepsFrom("osint", 0, "skipped");
            return setPhase("osint", "skipped", "VPN down");
          }
          setStepsFrom("osint", 0, "running");
          const res = await runScan(t.url);
          // One synchronous call returns everything; light each category step.
          setStep("osint", 0, "ok");
          setStep("osint", 1, "ok");
          setStep("osint", 2, "ok");
          setPhase("osint", "done", `${res.devices.length} devices`);
        } catch (e) {
          degrade("osint", e);
        }
      };

      // ── D: memory — simulated, gated on the present real phases ──────────────
      const runMemory = async (def: ReconPhaseDef) => {
        setPhase("memory", "running");
        for (let i = 0; i < def.steps.length; i++) {
          await sleep(def.steps[i].ms, signal);
          setStep("memory", i, "ok", def.steps[i].ms);
        }
        setPhase("memory", "done");
      };

      // ── orchestrate ─────────────────────────────────────────────────────────
      (async () => {
        try {
          const realRunners: Promise<void>[] = [];

          const needsSlug = present.has("schematic") || present.has("people");
          let slug: string | null = null;
          if (needsSlug) {
            if (!t.address) {
              // Can't run address-driven phases without an address — skip them.
              if (present.has("schematic")) {
                setStepsFrom("schematic", 0, "skipped");
                setPhase("schematic", "skipped", "no address");
              }
              if (present.has("people")) {
                setStepsFrom("people", 0, "skipped");
                setPhase("people", "skipped", "no address");
              }
            } else {
              try {
                slug = (await addBuilding(t.address)).id;
              } catch (e) {
                if (present.has("schematic")) degrade("schematic", e);
                if (present.has("people")) degrade("people", e);
              }
            }
          }

          if (slug && present.has("schematic")) realRunners.push(runSchematic(slug));
          if (slug && present.has("people")) realRunners.push(runPeople(slug));
          if (present.has("osint")) realRunners.push(runOsint());

          await Promise.allSettled(realRunners);

          const memoryDef = defs.find((d) => d.key === "memory");
          if (memoryDef) await runMemory(memoryDef);

          if (!signal.aborted) {
            setComplete(true);
            stopClock();
          }
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) {
            // Unexpected — still let the user close the panel.
            setComplete(true);
            stopClock();
          }
        }
      })();
    },
    [stopClock],
  );

  useEffect(() => () => abort.current?.abort(), []);

  return { mode, phases, target, complete, elapsed, start, reset };
}

export type Recon = ReturnType<typeof useReconPipeline>;

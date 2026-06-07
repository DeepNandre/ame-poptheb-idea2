import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  Minus,
  Radar,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Evaluation, PhaseState, StepState, StepStatus } from "./useBuildingEvaluation";

function pctOf(p: PhaseState): number {
  const total = p.steps.length || 1;
  const done = p.steps.filter((s) => s.status !== "pending").length;
  return Math.round((done / total) * 100);
}

/** Honest step glyph — pending spins, ok ticks, anything else (unavailable /
 *  error / partial) shows a muted warning rather than a false success. */
function StepGlyph({ status }: { status: StepStatus }) {
  if (status === "pending")
    return <Loader2 className="size-3 shrink-0 animate-spin text-white/35" />;
  if (status === "ok")
    return <Check className="size-3 shrink-0 text-emerald-400" />;
  if (status === "partial")
    return <Check className="size-3 shrink-0 text-amber-400" />;
  return <Minus className="size-3 shrink-0 text-white/30" />;
}

function PhaseRow({ phase }: { phase: PhaseState }) {
  const [open, setOpen] = useState(false);
  const Icon = phase.icon;
  const pct = pctOf(phase);
  const running = phase.status === "running";
  // A synth phase with no sub-progress shows an indeterminate shimmer, not a lie.
  const indeterminate = running && phase.synth;

  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-md border",
            phase.status === "done"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-white/15 bg-white/[0.04] text-white/55",
          )}
        >
          {phase.status === "done" ? (
            <Check className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-white/90">{phase.label}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {running && <Loader2 className="size-3 animate-spin text-white/40" />}
              <span className="font-mono text-[11px] tabular-nums text-white/45">
                {indeterminate ? "···" : `${pct}%`}
              </span>
            </span>
          </span>
          {/* progress bar */}
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10">
            {indeterminate ? (
              <span className="block h-full w-1/3 animate-pulse rounded-full bg-cyan-300/70" />
            ) : (
              <span
                className={cn(
                  "block h-full rounded-full transition-all duration-500",
                  phase.status === "done" ? "bg-emerald-400/80" : "bg-cyan-300/70",
                )}
                style={{ width: `${pct}%` }}
              />
            )}
          </span>
        </span>

        <ChevronRight
          className={cn("size-3.5 shrink-0 text-white/35 transition-transform", open && "rotate-90")}
        />
      </button>

      {open && (
        <ul className="space-y-1 px-3.5 pb-2.5 pl-12 animate-fade-in">
          {phase.steps.map((s: StepState) => (
            <li key={s.source} className="flex items-center gap-2 text-[11px]">
              <StepGlyph status={s.status} />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  s.status === "pending" ? "text-white/45" : "text-white/70",
                )}
              >
                {s.label}
              </span>
              {s.status === "pending" ? (
                <span className="shrink-0 text-[10px] text-white/30">…</span>
              ) : (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/30">
                  {s.status === "ok" || s.status === "partial"
                    ? s.ms != null
                      ? `${s.ms}ms`
                      : ""
                    : s.status === "unavailable"
                      ? "n/a"
                      : "err"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Right-docked evaluation pipeline. Renders only the phases this run produces,
 * each as a tap-style progress row that expands to its live sub-steps. The
 * footer button lights up once every phase has settled.
 */
export function EvaluationPipeline({ ev }: { ev: Evaluation }) {
  const doneCount = ev.phases.filter((p) => p.status === "done").length;
  const total = ev.phases.length;

  return (
    <div className="glass flex max-h-full min-h-0 w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl text-white animate-fade-in">
      {/* header */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-white text-black">
              <Radar className="size-3.5" />
            </span>
            <span className="truncate text-[14px] font-semibold tracking-tight">
              Evaluating · {ev.target?.name}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-white/45">
            {ev.error ? (
              <span className="text-amber-300">{ev.error}</span>
            ) : (
              <>
                {doneCount} of {total} phases complete · {ev.elapsed}s
                {ev.complete && <span className="text-emerald-300"> · done</span>}
              </>
            )}
          </div>
        </div>
        <button
          onClick={ev.reset}
          title="Cancel"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* phases */}
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {ev.phases.map((p) => (
          <PhaseRow key={p.key} phase={p} />
        ))}
        {ev.error && (
          <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-amber-300/90">
            <AlertTriangle className="size-4 shrink-0" /> Evaluation hit an error — partial results may
            still be available.
          </div>
        )}
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          onClick={ev.showResults}
          disabled={!ev.complete}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
            ev.complete
              ? "border border-cyan-300/40 bg-cyan-300/20 text-cyan-50 hover:bg-cyan-300/30"
              : "cursor-not-allowed border border-white/10 bg-white/[0.04] text-white/35",
          )}
        >
          {ev.complete ? (
            <>
              View extraction results
              <ChevronRight className="size-4" />
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Extracting…
            </>
          )}
        </button>
      </div>
    </div>
  );
}

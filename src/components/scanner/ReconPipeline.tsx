import { useState } from "react";
import { Check, ChevronRight, Crosshair, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recon, ReconPhaseState, ReconStepState } from "./useReconPipeline";

function pctOf(p: ReconPhaseState): number {
  const total = p.steps.length || 1;
  const done = p.steps.filter((s) => s.status === "ok").length;
  return Math.round((done / total) * 100);
}

function PhaseRow({ phase }: { phase: ReconPhaseState }) {
  const [open, setOpen] = useState(false);
  const Icon = phase.icon;
  const pct = pctOf(phase);
  const running = phase.status === "running";
  const queued = phase.status === "queued";

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
              : queued
                ? "border-white/10 bg-white/[0.02] text-white/30"
                : "border-white/15 bg-white/[0.04] text-white/55",
          )}
        >
          {phase.status === "done" ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-[13px] font-medium",
                queued ? "text-white/45" : "text-white/90",
              )}
            >
              {phase.label}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {running && <Loader2 className="size-3 animate-spin text-white/40" />}
              <span className="font-mono text-[11px] tabular-nums text-white/45">
                {queued ? "queued" : `${pct}%`}
              </span>
            </span>
          </span>
          {/* progress bar */}
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10">
            <span
              className={cn(
                "block h-full rounded-full transition-all duration-500",
                phase.status === "done" ? "bg-emerald-400/80" : "bg-cyan-300/70",
              )}
              style={{ width: queued ? "0%" : `${pct}%` }}
            />
          </span>
        </span>

        <ChevronRight
          className={cn("size-3.5 shrink-0 text-white/35 transition-transform", open && "rotate-90")}
        />
      </button>

      {open && (
        <ul className="space-y-1 px-3.5 pb-2.5 pl-12 animate-fade-in">
          {phase.steps.map((s: ReconStepState, i) => (
            <li key={i} className="flex items-center gap-2 text-[11px]">
              {s.status === "ok" ? (
                <Check className="size-3 shrink-0 text-emerald-400" />
              ) : queued ? (
                <span className="size-3 shrink-0 rounded-full border border-white/20" />
              ) : (
                <Loader2 className="size-3 shrink-0 animate-spin text-white/35" />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  s.status === "ok" ? "text-white/70" : "text-white/45",
                )}
              >
                {s.label}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/30">
                {s.status === "ok" && s.ms != null ? `${s.ms}ms` : queued ? "" : "…"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Right-docked recon pipeline. Mirrors the public-data EvaluationPipeline visual
 * but is driven entirely frontend-side (useReconPipeline) — schematic, people,
 * and OSINT run in parallel; ingestion/memory gates until they settle.
 */
export function ReconPipeline({ recon }: { recon: Recon }) {
  const doneCount = recon.phases.filter((p) => p.status === "done").length;
  const total = recon.phases.length;

  return (
    <div className="glass flex max-h-full min-h-0 w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl text-white animate-fade-in">
      {/* header */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-cyan-400 text-black">
              <Crosshair className="size-3.5" />
            </span>
            <span className="truncate text-[14px] font-semibold tracking-tight">
              Recon · {recon.target?.name}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-white/45">
            {doneCount} of {total} phases complete · {recon.elapsed}s
            {recon.complete && <span className="text-emerald-300"> · done</span>}
          </div>
        </div>
        <button
          onClick={recon.reset}
          title="Cancel"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* phases */}
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {recon.phases.map((p) => (
          <PhaseRow key={p.key} phase={p} />
        ))}
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          onClick={recon.reset}
          disabled={!recon.complete}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
            recon.complete
              ? "border border-cyan-300/40 bg-cyan-300/20 text-cyan-50 hover:bg-cyan-300/30"
              : "cursor-not-allowed border border-white/10 bg-white/[0.04] text-white/35",
          )}
        >
          {recon.complete ? (
            <>
              Recon complete — close
              <ChevronRight className="size-4" />
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Running recon…
            </>
          )}
        </button>
      </div>
    </div>
  );
}

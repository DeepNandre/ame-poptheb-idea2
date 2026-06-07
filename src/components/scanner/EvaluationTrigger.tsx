import { useState } from "react";
import { ChevronDown, Crosshair, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELECTABLE_PHASES } from "./evaluationPhases";

/**
 * Floating trigger for the evaluation pipeline. Lives in the left rail under the
 * targets card whenever a building is selected. "Evaluate building" runs the full
 * pipeline; "Ask specific" opens a checklist so the user runs only the phases
 * they care about — the pipeline then shows ONLY those phases.
 */
export function EvaluationTrigger({
  buildingName,
  onEvaluate,
}: {
  buildingName: string;
  /** keys === null → full evaluation; otherwise the selected phase subset. */
  onEvaluate: (keys: string[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="glass shrink-0 overflow-hidden rounded-2xl ring-1 ring-cyan-300/40 animate-fade-in">
      <div className="flex items-center gap-2 px-3.5 pt-2.5">
        <Crosshair className="size-3.5 text-cyan-300" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-white/55">
          {buildingName}
        </span>
      </div>

      <div className="flex gap-2 p-2.5">
        <button
          onClick={() => onEvaluate(null)}
          className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-cyan-400 px-4 py-3 text-[15px] font-bold text-black shadow-[0_0_22px_-4px_rgba(34,211,238,0.7)] transition-all hover:bg-cyan-300 hover:shadow-[0_0_28px_-2px_rgba(34,211,238,0.9)]"
        >
          {/* sweeping shine to draw the eye */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <Zap className="size-4 fill-black" /> Evaluate building
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Run specific phases"
          className={cn(
            "flex items-center gap-1 rounded-xl border px-3 py-3 text-[12px] font-medium transition-colors",
            open
              ? "border-white/20 bg-white/15 text-white"
              : "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/10",
          )}
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="space-y-0.5 px-2 pb-2 animate-fade-in">
          {SELECTABLE_PHASES.map((p) => {
            const on = picked.has(p.key);
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => toggle(p.key)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors",
                  on ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded border",
                    on ? "border-cyan-300/60 bg-cyan-300/25" : "border-white/20",
                  )}
                >
                  {on && <span className="size-1.5 rounded-[2px] bg-cyan-200" />}
                </span>
                <Icon className="size-3.5 shrink-0 text-white/45" />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
              </button>
            );
          })}
          <button
            disabled={picked.size === 0}
            onClick={() => onEvaluate([...picked])}
            className="mt-1 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/15 disabled:opacity-40"
          >
            Run {picked.size || ""} selected {picked.size === 1 ? "phase" : "phases"}
          </button>
        </div>
      )}
    </div>
  );
}

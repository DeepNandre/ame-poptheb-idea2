import {
  Box,
  Building2,
  FileText,
  Gauge,
  MessageCircleQuestion,
  RotateCw,
  Route,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedBuilding } from "@/lib/building";
import type { Evaluation } from "./useBuildingEvaluation";

export interface ResultActions {
  onOpenIntelligence: () => void;
  on3D: () => void;
  onAsk: () => void;
  onRecon: () => void;
  onReport: () => void;
}

interface Tile {
  key: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick: () => void;
  accent?: boolean;
}

function bandColor(band?: string): string {
  switch (band) {
    case "High":
      return "text-red-300";
    case "Elevated":
      return "text-orange-300";
    case "Moderate":
      return "text-amber-300";
    default:
      return "text-emerald-300";
  }
}

/**
 * The "plans" deck shown once extraction completes. Each tile routes to a real,
 * working view — nothing here is a dead end. Hints surface a fact pulled live
 * from the evaluation so the deck reads as evidence, not chrome.
 */
export function EvaluationResults({ ev, actions }: { ev: Evaluation; actions: ResultActions }) {
  const b: UnifiedBuilding | null = ev.building;
  const liveSources = b?.meta?.sources?.filter((s) => s.status === "ok").length ?? 0;
  const totalSources = b?.meta?.sources?.length ?? 0;

  const tiles: Tile[] = [
    {
      key: "intel",
      icon: Gauge,
      title: "Risk & intelligence",
      hint: b ? `Risk ${b.risk.score}/100 · ${b.risk.band}` : "Full record",
      onClick: actions.onOpenIntelligence,
      accent: true,
    },
    {
      key: "3d",
      icon: Box,
      title: "3D schematic",
      hint: "Georeferenced floor plans",
      onClick: actions.on3D,
    },
    {
      key: "ask",
      icon: MessageCircleQuestion,
      title: "Ask a question",
      hint: "Focused Q&A on this record",
      onClick: actions.onAsk,
    },
    {
      key: "recon",
      icon: Building2,
      title: "Corporate recon",
      hint: b?.occupants?.companies?.length
        ? `${b.occupants.companies.length} companies here`
        : "OSINT on the occupier",
      onClick: actions.onRecon,
    },
    {
      key: "access",
      icon: Route,
      title: "Access & transport",
      hint:
        b?.transport?.nearbyStops?.[0]?.name
          ? `Nearest: ${b.transport.nearbyStops[0].name}`
          : "Approach routes & stops",
      onClick: actions.onOpenIntelligence,
    },
    {
      key: "report",
      icon: FileText,
      title: "Evidence report",
      hint: "Export the full pack",
      onClick: actions.onReport,
    },
  ];

  return (
    <div className="glass flex max-h-full min-h-0 w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl text-white animate-fade-in">
      {/* header */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold tracking-tight">{ev.target?.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/45">
            {b && (
              <span className={cn("font-medium", bandColor(b.risk.band))}>
                Risk {b.risk.score}/100 · {b.risk.band}
              </span>
            )}
            <span>· {liveSources}/{totalSources} live sources</span>
          </div>
        </div>
        <button
          onClick={ev.reset}
          title="Close"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* tile deck */}
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={t.onClick}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                  t.accent
                    ? "border-cyan-300/30 bg-cyan-300/10 hover:bg-cyan-300/20"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]",
                )}
              >
                <Icon className={cn("size-4", t.accent ? "text-cyan-200" : "text-white/65")} />
                <span className="text-[13px] font-medium leading-tight text-white/90">{t.title}</span>
                <span className="text-[10px] leading-snug text-white/45">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          onClick={() => ev.target && ev.start(ev.target, null)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10"
        >
          <RotateCw className="size-3.5" /> Re-evaluate
        </button>
      </div>
    </div>
  );
}

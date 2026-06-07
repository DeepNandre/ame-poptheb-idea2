import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CornerDownLeft,
  FileText,
  Loader2,
  Navigation,
  ScanSearch,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CommandPlan } from "@/lib/agent";
import type { GeoResult } from "@/lib/geocode";

export interface CommandOutcome {
  query: string;
  plan: CommandPlan;
  geo: GeoResult | null;
  knownId: string | null;
  knownName: string | null;
  searchUrl: string | null;
  note: string | null;
  /** Grounded natural-language answer for an "intelligence" query. */
  answer?: string | null;
}

const EXAMPLES = [
  "Take me to the Shard",
  "Fly to Canary Wharf",
  "Show me Arbor, Bankside Yards",
  "Floor plans of 22 Bishopsgate",
  "Corporate recon for the building",
  "Who works here right now?",
];

export function CommandBar({
  running,
  outcome,
  error,
  llmEnabled,
  onSubmit,
  onClear,
  onOpenTarget,
}: {
  running: boolean;
  outcome: CommandOutcome | null;
  error: string | null;
  llmEnabled: boolean;
  onSubmit: (query: string) => void;
  onClear: () => void;
  onOpenTarget: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const expanded = focused || hovered || running || !!outcome || !!error || value.length > 0;
  const showChips = expanded && !outcome && !error && !running && value.trim() === "";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") inputRef.current?.blur();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || running) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      {/* One hover surface for the whole cluster — moving between the pills and
          the input no longer crosses a dead gap, so it stays expanded. */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="pointer-events-auto flex w-fit flex-col items-center gap-2.5"
      >
        {(outcome || error) && !running ? (
          <ResultCard outcome={outcome} error={error} onClear={onClear} onOpenTarget={onOpenTarget} />
        ) : null}

        {showChips ? (
          <div className="flex max-w-[min(40rem,calc(100vw-2rem))] flex-wrap justify-center gap-1.5 animate-fade-in">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => submit(ex)}
                className="glass glass-hover rounded-full px-3 py-1.5 text-xs text-white/75 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
          className={cn(
            "glass flex items-center gap-2.5 rounded-full py-2 pl-4 pr-2 transition-[width,box-shadow] duration-300 ease-out",
            expanded ? "w-[min(40rem,calc(100vw-2rem))]" : "w-[min(22rem,calc(100vw-2rem))]",
            focused && "ring-1 ring-white/20",
          )}
        >
          <span className="grid size-5 shrink-0 place-items-center text-white/55">
            {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          </span>

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={running ? "Scanning the record…" : "Ask anything — “take me to the Shard”"}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />

          {expanded ? (
            <button
              type="submit"
              disabled={running || value.trim() === ""}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-black transition-opacity disabled:opacity-40"
            >
              Run <CornerDownLeft className="size-3.5" />
            </button>
          ) : (
            <kbd className="mr-1.5 shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/45">
              ⌘K
            </kbd>
          )}
        </form>

        <p className="text-[10.5px] text-white/30">
          {llmEnabled
            ? "Natural-language search · OpenRouter + live planning data"
            : "Keyword search · add an OpenRouter key for natural language"}
        </p>
      </div>
    </div>
  );
}

function ResultCard({
  outcome,
  error,
  onClear,
  onOpenTarget,
}: {
  outcome: CommandOutcome | null;
  error: string | null;
  onClear: () => void;
  onOpenTarget: (id: string) => void;
}) {
  if (error) {
    return (
      <div className="glass w-[min(40rem,calc(100vw-2rem))] rounded-2xl p-3.5 text-white animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] text-red-300">{error}</p>
          <CloseBtn onClick={onClear} />
        </div>
      </div>
    );
  }
  if (!outcome) return null;

  const { plan, geo, knownId, knownName, searchUrl, note, answer } = outcome;
  const investigate = plan.intent === "investigate";
  const intelligence = plan.intent === "intelligence";
  const badge = intelligence
    ? { variant: "emerald" as const, Icon: Sparkles, label: "Intelligence" }
    : investigate
      ? { variant: "amber" as const, Icon: ScanSearch, label: "Investigate" }
      : { variant: "sky" as const, Icon: Navigation, label: "Navigate" };

  return (
    <div className="glass w-[min(40rem,calc(100vw-2rem))] rounded-2xl p-3.5 text-white animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={badge.variant}>
              <badge.Icon className="!size-3" />
              {badge.label}
            </Badge>
            <Badge variant="outline">{plan.source === "llm" ? "AI" : "keyword"}</Badge>
            {plan.council ? <span className="text-[11px] text-white/45">{plan.council}</span> : null}
          </div>

          <div className="mt-2 truncate text-[15px] font-semibold tracking-tight">
            {geo ? geo.placeName : plan.place}
          </div>
          {answer ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/90">{answer}</p>
          ) : (
            <p className="mt-0.5 text-xs leading-relaxed text-white/55">{plan.rationale}</p>
          )}
          {note ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-300/90">
              <FileText className="size-3" /> {note}
            </p>
          ) : null}
          {!geo ? (
            <p className="mt-1 text-[11px] text-amber-300/80">
              Couldn’t pin that on the map — try a more specific address.
            </p>
          ) : null}

          {(knownId || (investigate && searchUrl)) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {knownId ? (
                <Button
                  size="sm"
                  className="h-7 bg-white text-black hover:bg-white/90"
                  onClick={() => onOpenTarget(knownId)}
                >
                  {intelligence ? "Open full intelligence" : `Open ${knownName ?? "evidence"}`}
                </Button>
              ) : null}
              {investigate && !knownId && searchUrl ? (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  <a href={searchUrl} target="_blank" rel="noreferrer">
                    Search the register <ArrowUpRight className="!size-3.5" />
                  </a>
                </Button>
              ) : null}
            </div>
          )}
        </div>
        <CloseBtn onClick={onClear} />
      </div>
    </div>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid size-6 shrink-0 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
    >
      <X className="size-3.5" />
    </button>
  );
}

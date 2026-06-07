import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Compass,
  Download,
  DoorOpen,
  Route,
  Search,
  Server,
  Wrench,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntelligencePanel } from "./IntelligencePanel";
import type { DesignationGeometry } from "@/lib/building";
import type { ClassifiedDoc, Resolution, Target, TraceStatus } from "./data";

const RESOLUTION: Record<Resolution, { label: string; variant: "emerald" | "amber" | "sky" }> = {
  analogue: { label: "Resolved", variant: "emerald" },
  unresolved: { label: "Pending", variant: "amber" },
  anchor: { label: "Anchor", variant: "sky" },
};

const TRACE_DOT: Record<TraceStatus, string> = {
  done: "bg-white border-white",
  active: "bg-transparent border-white ring-2 ring-white/20",
  open: "bg-transparent border-white/35",
};

const LOGIC_GROUPS: { key: keyof Target["insideLogic"]; title: string; icon: typeof DoorOpen }[] = [
  { key: "entrances", title: "Entrances", icon: DoorOpen },
  { key: "cores", title: "Cores", icon: Compass },
  { key: "publicRoutes", title: "Public routes", icon: Route },
  { key: "serviceRoutes", title: "Service routes", icon: Wrench },
  { key: "plant", title: "Plant / back-of-house", icon: Server },
];

export function DetailPanel({
  target,
  onClose,
  onExport,
  onCrimePoints,
  onDesignationGeometry,
  focusIntel,
}: {
  target: Target;
  onClose: () => void;
  onExport: () => void;
  /** Bubble crime snap-points up so the map can paint a heat layer. */
  onCrimePoints?: (points: { lat: number; lng: number }[] | null) => void;
  /** Bubble designation polygons up so the map can draw coloured overlays. */
  onDesignationGeometry?: (geometry: DesignationGeometry | null) => void;
  /** Incrementing nonce — when it changes, jump to the Intelligence tab (chat-driven). */
  focusIntel?: number;
}) {
  const [tab, setTab] = useState("evidence");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(target.documents[0]?.id ?? null);

  // A chat "intelligence" answer focuses this tab so the detail backs up the answer.
  useEffect(() => {
    if (focusIntel) setTab("intel");
  }, [focusIntel]);
  const res = RESOLUTION[target.resolution];
  const logicCount = LOGIC_GROUPS.reduce((s, g) => s + target.insideLogic[g.key].length, 0);

  return (
    <div className="glass flex max-h-full min-h-0 w-[min(24rem,calc(100vw-2rem))] flex-col rounded-2xl text-white animate-fade-in">
      {/* header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">{target.name}</h2>
            <Badge variant={res.variant}>{res.label}</Badge>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-white/45">{target.planning}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onExport}
            title="Export report"
            className="grid h-7 w-7 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="size-4" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-3 flex min-h-0 flex-1 flex-col">
        <div className="scroll-quiet overflow-x-auto border-b border-white/10 px-4">
          <TabsList className="gap-4">
            <TabsTrigger value="evidence">
              Evidence <Count>{target.documents.length}</Count>
            </TabsTrigger>
            <TabsTrigger value="logic">
              Inside logic <Count>{logicCount}</Count>
            </TabsTrigger>
            <TabsTrigger value="trace">
              Trace <Count>{target.trace.length}</Count>
            </TabsTrigger>
            <TabsTrigger value="intel">Intelligence</TabsTrigger>
          </TabsList>
        </div>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="evidence" className="mt-0">
            <EvidenceTab
              target={target}
              expandedDoc={expandedDoc}
              onToggle={(id) => setExpandedDoc((cur) => (cur === id ? null : id))}
            />
          </TabsContent>
          <TabsContent value="logic" className="mt-0">
            <LogicTab target={target} count={logicCount} />
          </TabsContent>
          <TabsContent value="trace" className="mt-0">
            <TraceTab target={target} />
          </TabsContent>
          <TabsContent value="intel" className="mt-0">
            <IntelligencePanel
              target={target}
              onCrimePoints={onCrimePoints}
              onDesignationGeometry={onDesignationGeometry}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ---------------- Evidence ---------------- */

function EvidenceTab({
  target,
  expandedDoc,
  onToggle,
}: {
  target: Target;
  expandedDoc: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-white/50">
          {target.register.authority} · {target.register.system}
          {target.register.docCount ? ` · ${target.register.docCount} on file` : ""}
        </p>
        {target.register.url ? (
          <Button asChild variant="outline" size="sm" className="h-7 border-white/15 bg-white/5 text-white hover:bg-white/10">
            <a href={target.register.url} target="_blank" rel="noreferrer">
              Register <ArrowUpRight className="!size-3.5" />
            </a>
          </Button>
        ) : null}
      </div>

      {target.documents.length === 0 ? (
        <EmptyState
          title="No drawing set resolved yet"
          body="Identity is confirmed, but the detailed GA set still has to be pulled from the masterplan chain. See the Trace tab."
        />
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          <div className="divide-y divide-white/8">
            {target.documents.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                open={expandedDoc === doc.id}
                onToggle={() => onToggle(doc.id)}
                registerUrl={target.register.url}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocRow({
  doc,
  open,
  onToggle,
  registerUrl,
}: {
  doc: ClassifiedDoc;
  open: boolean;
  onToggle: () => void;
  registerUrl?: string;
}) {
  return (
    <div className={cn(open && "bg-white/[0.04]")}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[12px] font-medium text-white/90">{doc.file}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
            <Badge variant="outline" className="font-mono text-[10px]">
              {doc.docType}
            </Badge>
            {doc.level ? <span>{doc.level}</span> : null}
            <span className="tnum text-white/35">· {doc.confidence}%</span>
          </div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-white/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 px-3 pb-3.5 pt-0.5">
          <div>
            <FieldLabel>Classifier basis</FieldLabel>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{doc.basis}</p>
          </div>
          <div>
            <FieldLabel>Reveals</FieldLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {doc.reveals.map((r) => (
                <Badge key={r} variant="outline" className="text-white/75">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white" style={{ width: `${doc.confidence}%` }} />
            </div>
            {doc.url ?? registerUrl ? (
              <a
                href={doc.url ?? registerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-white/80 hover:text-white"
              >
                {doc.url ? "Open" : "Source"} <ArrowUpRight className="size-3" />
              </a>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Inside logic ---------------- */

function LogicTab({ target, count }: { target: Target; count: number }) {
  if (count === 0) {
    return (
      <EmptyState
        title="Interior reads pending"
        body="Inside logic is extracted from the GA plans and the Design & Access Statement. None are in hand for this target yet."
      />
    );
  }
  return (
    <div className="space-y-5">
      {LOGIC_GROUPS.map((group) => {
        const items = target.insideLogic[group.key];
        if (items.length === 0) return null;
        const Icon = group.icon;
        return (
          <div key={group.key}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="size-3.5 text-white/45" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {group.title}
              </span>
              <span className="tnum font-mono text-[11px] text-white/30">{items.length}</span>
            </div>
            <div className="space-y-2.5 border-l border-white/12 pl-3.5">
              {items.map((item) => (
                <div key={item.label}>
                  <div className="text-[13px] font-medium leading-snug text-white/90">{item.label}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-white/55">{item.detail}</div>
                  <div className="mt-1 font-mono text-[10.5px] text-white/35">{item.source}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Trace ---------------- */

function TraceTab({ target }: { target: Target }) {
  return (
    <div>
      <ol>
        {target.trace.map((step, i) => {
          const last = i === target.trace.length - 1;
          return (
            <li key={step.title} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className={cn("size-2.5 shrink-0 rounded-full border", TRACE_DOT[step.status])} />
                {!last && <span className="my-1 w-px flex-1 bg-white/12" />}
              </div>
              <div className={last ? "pb-1" : "pb-5"}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-white/90">{step.title}</span>
                  {step.status === "active" && <Badge variant="amber">active</Badge>}
                  {step.status === "open" && <Badge variant="outline">open</Badge>}
                </div>
                {step.ref ? <div className="mt-0.5 font-mono text-[11px] text-white/55">{step.ref}</div> : null}
                <div className="mt-1 text-xs leading-relaxed text-white/55">{step.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <Separator className="my-4 bg-white/10" />

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
          The uncomfortable bit
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-white/55">
          No control was defeated to build this trace. Public planning systems, once aggregated and
          classified, reveal the internal logic of major buildings — the only skill required is
          knowing the name on the door is rarely the name on the application.
        </p>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{children}</span>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="tnum font-mono text-[11px] text-white/35">{children}</span>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center">
      <Search className="mx-auto size-5 text-white/25" />
      <div className="mt-3 text-[13px] font-medium text-white/85">{title}</div>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-xs leading-relaxed text-white/45">{body}</p>
    </div>
  );
}

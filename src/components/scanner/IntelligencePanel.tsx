import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  Copy,
  Check,
  FileText,
  Landmark,
  Layers,
  Loader2,
  MapPin,
  Mountain,
  ShieldAlert,
  Train,
  Users,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  fetchBuilding,
  type SectionStatus,
  type UnifiedBuilding,
  type CrimeData,
  type DesignationGeometry,
} from "@/lib/building";
import type { Target } from "./data";

/* --------------------------------- status --------------------------------- */

const DOT: Record<SectionStatus, string> = {
  ok: "bg-emerald-400",
  partial: "bg-amber-400",
  unavailable: "bg-white/25",
  error: "bg-red-400",
};

function statusLabel(status: SectionStatus): { variant: "emerald" | "amber" | "outline" | "red"; text: string } {
  switch (status) {
    case "ok":
      return { variant: "emerald", text: "Live" };
    case "partial":
      return { variant: "amber", text: "Partial" };
    case "error":
      return { variant: "red", text: "Error" };
    default:
      return { variant: "outline", text: "Unavailable" };
  }
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

function epcVariant(rating: string | null): "emerald" | "amber" | "red" | "outline" {
  const r = (rating || "").toUpperCase();
  if (r === "A" || r === "B") return "emerald";
  if (r === "C" || r === "D") return "amber";
  if (r) return "red";
  return "outline";
}

/* -------------------------------- section -------------------------------- */

function Section({
  title,
  icon: Icon,
  status,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  icon: typeof MapPin;
  status: SectionStatus;
  count?: number | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const lbl = statusLabel(status);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", DOT[status])} />
        <Icon className="size-3.5 shrink-0 text-white/45" />
        <span className="flex-1 text-[12px] font-semibold text-white/85">{title}</span>
        {count != null && count > 0 ? (
          <span className="tnum font-mono text-[11px] text-white/35">{count}</span>
        ) : null}
        <Badge variant={lbl.variant} className="text-[10px]">
          {lbl.text}
        </Badge>
        <ChevronDown className={cn("size-4 shrink-0 text-white/35 transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-white/8 px-3 py-3">{children}</div> : null}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] leading-relaxed text-white/45">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] italic leading-relaxed text-white/40">{children}</p>;
}

/* --------------------------------- crime --------------------------------- */

function Crime({ crime }: { crime: CrimeData }) {
  if (crime.status === "error") return <Note>Crime lookup failed — {crime.note}</Note>;
  const cats = crime.byCategory ?? [];
  const max = cats[0]?.count || 1;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <span className="tnum text-xl font-semibold text-white">{crime.total ?? 0}</span>
        <span className="text-[11px] text-white/50">
          crimes within {crime.radiusMiles ?? 1} mile{crime.month ? ` · ${crime.month}` : ""}
        </span>
      </div>
      {cats.length === 0 ? (
        <Empty>No street-level crime reported for this period.</Empty>
      ) : (
        <div className="space-y-1.5">
          {cats.slice(0, 8).map((c) => (
            <div key={c.category} className="flex items-center gap-2">
              <span className="w-[8.5rem] shrink-0 truncate text-[11px] text-white/65">{c.category}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400/70 to-red-400/80"
                  style={{ width: `${Math.max(4, (c.count / max) * 100)}%` }}
                />
              </div>
              <span className="tnum w-7 shrink-0 text-right font-mono text-[11px] text-white/45">{c.count}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-white/30">Source: data.police.uk · anonymised to street level</p>
    </div>
  );
}

/* ------------------------------ food hygiene ------------------------------ */

function ratingVariant(n: number | null): "emerald" | "amber" | "red" | "outline" {
  if (n == null) return "outline";
  if (n >= 4) return "emerald";
  if (n >= 2) return "amber";
  return "red";
}

function Food({ food }: { food: UnifiedBuilding["safety"]["foodHygiene"] }) {
  if (food.status === "error") return <Note>FSA lookup failed — {food.note}</Note>;
  const list = food.establishments ?? [];
  if (list.length === 0) return <Empty>No food businesses rated near this address.</Empty>;
  return (
    <div className="space-y-1.5">
      {list.slice(0, 10).map((e, i) => (
        <div key={`${e.name}-${i}`} className="flex items-center gap-2">
          <Badge variant={ratingVariant(e.ratingNumeric)} className="w-8 shrink-0 justify-center font-mono">
            {e.ratingNumeric ?? e.rating ?? "—"}
          </Badge>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-white/85">{e.name}</span>
            <span className="block truncate text-[10px] text-white/40">
              {e.businessType}
              {e.ratingDate ? ` · ${e.ratingDate}` : ""}
            </span>
          </span>
        </div>
      ))}
      <p className="text-[10px] text-white/30">Source: Food Standards Agency (0–5 hygiene rating)</p>
    </div>
  );
}

/* --------------------------------- CQC --------------------------------- */

function Cqc({ cqc }: { cqc: UnifiedBuilding["safety"]["cqc"] }) {
  if (cqc.status === "unavailable") return <Note>{cqc.note}</Note>;
  if (cqc.status === "error") return <Note>CQC lookup failed — {cqc.note}</Note>;
  const locs = cqc.locations ?? [];
  if (locs.length === 0) return <Empty>No registered care/health locations at this postcode.</Empty>;
  return (
    <div className="space-y-1.5">
      {locs.map((l, i) => (
        <div key={`${l.name}-${i}`} className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-white/85">{l.name}</span>
            <span className="block truncate text-[10px] text-white/40">{l.type}</span>
          </span>
          {l.rating ? <Badge variant="sky">{l.rating}</Badge> : null}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- designations ----------------------------- */

function DesigBadge({
  variant,
  icon: Icon,
  label,
  sub,
  href,
}: {
  variant: "amber" | "sky" | "outline" | "emerald";
  icon: typeof MapPin;
  label: string;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <Badge variant={variant} className="max-w-full">
      <Icon className="size-3 shrink-0" />
      <span className="truncate">
        {label}
        {sub ? <span className="text-white/55"> · {sub.slice(0, 44)}</span> : null}
      </span>
    </Badge>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full">
      {inner}
    </a>
  ) : (
    inner
  );
}

function Designations({ planning }: { planning: UnifiedBuilding["planning"] }) {
  const { listed, conservationArea, designations } = planning;
  const others = designations.filter(
    (d) => d.dataset !== "listed-building-outline" && d.dataset !== "conservation-area",
  );
  if (!listed && !conservationArea && others.length === 0) {
    return <Empty>No statutory planning designations at this point.</Empty>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {listed ? (
        <DesigBadge
          variant="amber"
          icon={Landmark}
          label={listed.grade ? `Grade ${listed.grade} listed` : "Listed building"}
          sub={listed.grade ? listed.name : undefined}
          href={listed.url}
        />
      ) : null}
      {conservationArea ? (
        <DesigBadge variant="sky" icon={Building2} label="Conservation area" sub={conservationArea} />
      ) : null}
      {others.map((d, i) => (
        <DesigBadge
          key={`${d.dataset}-${i}`}
          variant="outline"
          icon={MapPin}
          label={d.type}
          sub={d.name && d.name !== d.type ? d.name : undefined}
          href={d.url}
        />
      ))}
    </div>
  );
}

function Applications({ apps }: { apps: UnifiedBuilding["planning"]["applications"] }) {
  if (apps.length === 0) return <Empty>No planning applications found at this location.</Empty>;
  return (
    <div className="space-y-0.5">
      {apps.slice(0, 10).map((a) => (
        <LinkRow
          key={a.ref}
          title={a.description?.slice(0, 90) || a.ref}
          sub={`${a.ref}${a.state ? ` · ${a.state}` : ""}${a.council ? ` · ${a.council}` : ""}`}
          href={a.url}
        />
      ))}
    </div>
  );
}

/* ------------------------------ link rows ------------------------------ */

function LinkRow({ title, sub, href }: { title: string; sub?: string; href?: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-white/85">{title}</span>
        {sub ? <span className="block truncate text-[10px] text-white/40">{sub}</span> : null}
      </span>
      {href ? <ArrowUpRight className="size-3.5 shrink-0 text-white/40" /> : null}
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.05]"
    >
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-2 px-1 py-1">{body}</div>
  );
}

/* --------------------------------- FOIA --------------------------------- */

function FoiaRow({ stub }: { stub: UnifiedBuilding["foia"][number] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(stub.template);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-white/12 px-2.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-white/80">{stub.field}</span>
        {stub.authority ? <span className="block text-[10px] text-white/40">via {stub.authority}</span> : null}
      </span>
      <button
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10.5px] text-white/70 transition-colors hover:bg-white/10"
        title="Copy a ready-to-send FOIA request"
      >
        {copied ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "FOIA"}
      </button>
    </div>
  );
}

/* ------------------------- ownership / EPC / transport ------------------------- */

function Sales({ ownership }: { ownership: UnifiedBuilding["ownership"] }) {
  if (ownership.status === "error") return <Note>Land Registry lookup failed — {ownership.note}</Note>;
  const sales = ownership.salesHistory;
  if (sales.length === 0) {
    return (
      <Empty>
        No recorded sales for this postcode. (HM Land Registry covers England &amp; Wales; some commercial
        transactions aren’t published.)
      </Empty>
    );
  }
  return (
    <div className="space-y-1.5">
      {ownership.scope === "postcode" ? (
        <p className="text-[10px] text-white/40">
          Postcode-level — the exact unit couldn’t be matched from the address.
        </p>
      ) : null}
      {sales.slice(0, 12).map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="tnum w-[4.5rem] shrink-0 font-mono text-[12px] text-white/85">
            {s.price != null ? GBP.format(s.price) : "—"}
          </span>
          <span className="w-16 shrink-0 font-mono text-[10px] text-white/40">{s.date}</span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-white/55">{s.address}</span>
          {s.sameBuilding ? (
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" title="Same building" />
          ) : null}
        </div>
      ))}
      <p className="text-[10px] text-white/30">Source: HM Land Registry Price Paid Data</p>
    </div>
  );
}

function Epc({ building }: { building: UnifiedBuilding["building"] }) {
  if (building.status === "unavailable") return <Note>{building.note}</Note>;
  if (building.status === "error") return <Note>EPC lookup failed — {building.note}</Note>;
  if (!building.epcRating && building.floorArea == null) {
    return <Empty>{building.note || "No EPC lodged for this property."}</Empty>;
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {building.epcRating ? (
          <Badge variant={epcVariant(building.epcRating)} className="w-7 justify-center text-[13px] font-bold">
            {building.epcRating}
          </Badge>
        ) : null}
        {building.potentialRating ? (
          <span className="text-[10px] text-white/45">potential {building.potentialRating}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Field label="Floor area" value={building.floorArea != null ? `${building.floorArea} m²` : null} />
        <Field label="Property type" value={building.propertyType} />
        <Field label="Built form" value={building.builtForm} />
        <Field label="Inspected" value={building.inspectionDate} />
      </div>
      <p className="text-[10px] text-white/30">Source: EPC register{building.register ? ` (${building.register})` : ""}</p>
    </div>
  );
}

function Transport({ transport }: { transport: UnifiedBuilding["transport"] }) {
  if (transport.status === "error") return <Note>TfL lookup failed — {transport.note}</Note>;
  if (transport.nearbyStops.length === 0) return <Empty>{transport.note || "No stops nearby."}</Empty>;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="tnum text-xl font-semibold text-white">{transport.connectivityScore}</span>
        <span className="text-[11px] text-white/50">
          connectivity · {transport.stopCount} stops within 800 m
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {transport.modes.map((m) => (
          <Badge key={m} variant="sky" className="capitalize">
            {m.replace(/-/g, " ")}
          </Badge>
        ))}
      </div>
      <div className="space-y-1">
        {transport.nearbyStops.slice(0, 8).map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-11 shrink-0 text-right font-mono text-[10px] text-white/40">
              {s.distanceM != null ? `${s.distanceM}m` : ""}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">{s.name}</span>
            <span className="shrink-0 truncate text-[10px] text-white/40">{s.lines.slice(0, 3).join(" · ")}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/30">
        Source: Transport for London. Score = mode mix + route breadth + proximity (not step-free access).
      </p>
    </div>
  );
}

function Financial({ financial }: { financial: UnifiedBuilding["financial"] }) {
  return (
    <div className="space-y-2">
      <Note>{financial.note}</Note>
      <div className="flex flex-col gap-1.5">
        {financial.lookups.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11.5px] text-white/80 transition-colors hover:bg-white/10"
          >
            <ArrowUpRight className="size-3.5 shrink-0" /> {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- risk --------------------------------- */

function riskVariant(band: string): "red" | "amber" | "sky" | "emerald" {
  return band === "High" ? "red" : band === "Elevated" ? "amber" : band === "Moderate" ? "sky" : "emerald";
}
function riskBar(score: number): string {
  return score >= 75
    ? "bg-red-400/80"
    : score >= 50
      ? "bg-amber-400/80"
      : score >= 25
        ? "bg-sky-400/70"
        : "bg-emerald-400/70";
}

function RiskCard({ risk }: { risk: UnifiedBuilding["risk"] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <span className="tnum text-3xl font-semibold leading-none text-white">{risk.score}</span>
        <span className="text-[11px] text-white/35">/100</span>
        <Badge variant={riskVariant(risk.band)}>{risk.band} risk</Badge>
        <span className="ml-auto text-[9.5px] font-semibold uppercase tracking-wider text-white/40">
          Risk index
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {risk.factors.map((f) => (
          <div key={f.key}>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-28 shrink-0 truncate text-white/70">{f.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <div className={cn("h-full rounded-full", riskBar(f.score))} style={{ width: `${f.score}%` }} />
              </div>
              <span className="tnum w-6 shrink-0 text-right font-mono text-white/45">{f.score}</span>
              <span className="w-7 shrink-0 text-right text-[9.5px] text-white/30">w{f.weight}</span>
            </div>
            <div className="mt-0.5 pl-[7.5rem] text-[10px] leading-tight text-white/35">{f.basis}</div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[10px] leading-relaxed text-white/30">{risk.note}</p>
    </div>
  );
}

/* --------------------------- ground stability --------------------------- */

function sevVariant(sev: number): "red" | "amber" | "emerald" {
  return sev >= 3 ? "red" : sev === 2 ? "amber" : "emerald";
}
function sevChip(sev: number): string {
  return sev >= 3
    ? "border-red-400/30 bg-red-400/10 text-red-300"
    : sev === 2
      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
      : "border-white/15 bg-white/5 text-white/55";
}

function GroundHazard({ ground }: { ground: UnifiedBuilding["ground"] }) {
  if (!ground.available || !ground.overall) {
    return <Note>{ground.note || "Ground-stability data not available at this location."}</Note>;
  }
  const ov = ground.overall;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={sevVariant(ov.severity)}>{ov.label}</Badge>
        <span className="text-[11px] text-white/70">{ov.name}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.values(ground.hazards || {}).map((h) => (
          <span key={h.name} className={cn("rounded-full border px-2 py-0.5 text-[10px]", sevChip(h.severity))}>
            {h.name.replace(/\s*\(.*\)/, "")} · {h.label}
          </span>
        ))}
        {ground.mining && ground.mining.severity > 0 ? (
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", sevChip(ground.mining.severity))}>
            Mining · {ground.mining.label}
          </span>
        ) : null}
      </div>
      {ground.radon ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/55">Radon</span>
          <Badge variant={sevVariant(ground.radon.severity)} className="text-[10px]">
            {ground.radon.label}
          </Badge>
          <span className="text-[10px] text-white/35">of homes above the action level</span>
        </div>
      ) : null}
      <p className="text-[10px] text-white/30">
        Sources: BGS GeoSure · Mining hazard · Radon atlas (OGL){ground.distanceKm != null ? ` · nearest hex ${ground.distanceKm} km` : ""}
      </p>
    </div>
  );
}

/* ----------------------------- similar sites ----------------------------- */

function SimilarSites({ similar }: { similar: UnifiedBuilding["similar"] }) {
  if (!similar?.enabled || !similar.matches.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="size-3.5 text-white/45" />
        <span className="text-[12px] font-semibold text-white/85">Similar sites assessed</span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {similar.matches.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {similar.matches.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">{m.address}</span>
            {m.council ? <span className="shrink-0 text-[10px] text-white/35">{m.council}</span> : null}
            {m.riskScore != null ? (
              <Badge variant={m.riskBand ? riskVariant(m.riskBand) : "outline"}>{m.riskScore}</Badge>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/30">Cross-building recall · ranked by risk-factor similarity</p>
    </div>
  );
}

/* ------------------------------- skeleton ------------------------------- */

function Skeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
      ))}
    </div>
  );
}

/* ------------------------------- main panel ------------------------------- */

export function IntelligencePanel({
  target,
  onCrimePoints,
  onDesignationGeometry,
}: {
  target: Target;
  /** Bubble the crime snap-points up so the map can paint a heat layer. */
  onCrimePoints?: (points: { lat: number; lng: number }[] | null) => void;
  /** Bubble designation polygons up so the map can draw coloured overlays. */
  onDesignationGeometry?: (geometry: DesignationGeometry | null) => void;
}) {
  const [data, setData] = useState<UnifiedBuilding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const [lng, lat] = target.coords;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    return {
      address: target.address || target.name || undefined,
      lat: hasCoords ? lat : undefined,
      lng: hasCoords ? lng : undefined,
    };
  }, [target.coords, target.address, target.name]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setData(null);
    fetchBuilding(query)
      .then((b) => {
        if (!live) return;
        setData(b);
        onCrimePoints?.(b.safety.crime.points ?? null);
        onDesignationGeometry?.(b.planning.designationGeometry ?? null);
      })
      .catch((e) => live && setError(String(e?.message || e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
      onCrimePoints?.(null);
      onDesignationGeometry?.(null);
    };
    // callbacks intentionally omitted — they're stable callbacks from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (loading) {
    return (
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-white/50">
          <Loader2 className="size-3.5 animate-spin" /> Aggregating public records…
        </div>
        <Skeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] px-4 py-6 text-center">
        <ShieldAlert className="mx-auto size-5 text-red-300/70" />
        <p className="mt-2 text-[12px] text-white/70">Couldn’t resolve this building.</p>
        <p className="mt-1 text-[11px] text-white/45">{error}</p>
      </div>
    );
  }

  const { identity, risk, similar, safety, planning, occupants, environment, ground, ownership, building, financial, transport, foia } = data;
  const liveCount = data.meta.sources.filter((s) => s.status === "ok").length;

  return (
    <div className="space-y-2.5">
      {/* Identity card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-3.5 text-white/45" />
          <span className="flex-1 truncate text-[12px] font-medium text-white/90">
            {identity.address || target.name}
          </span>
          {identity.uprn ? (
            <Badge variant="sky" className="font-mono text-[10px]">
              UPRN {identity.uprn}
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Field label="Postcode" value={identity.postcode} />
          <Field label="Council" value={identity.council} />
          <Field label="Ward" value={identity.ward} />
          <Field label="Classification" value={identity.classification} />
          {identity.toid ? <Field label="OS TOID" value={identity.toid} /> : null}
          {identity.usrn ? <Field label="Street USRN" value={identity.usrn} /> : null}
        </div>
        {identity.note ? <p className="mt-2 text-[10px] leading-relaxed text-white/35">{identity.note}</p> : null}
        <p className="mt-2 text-[10px] text-white/30">
          {liveCount} live source{liveCount === 1 ? "" : "s"} · aggregated{" "}
          {new Date(data.meta.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Headline risk index — synthesised from the real signals below. */}
      <RiskCard risk={risk} />

      {/* Cross-building recall (only when SUPERMEMORY_API_KEY is set). */}
      <SimilarSites similar={similar} />

      <Section title="Safety" icon={ShieldAlert} status={safety.status} defaultOpen>
        <div className="space-y-3">
          <Crime crime={safety.crime} />
          <Sub icon={UtensilsCrossed} title="Food hygiene">
            <Food food={safety.foodHygiene} />
          </Sub>
          <Sub icon={Building2} title="Care & health (CQC)">
            <Cqc cqc={safety.cqc} />
          </Sub>
        </div>
      </Section>

      <Section
        title="Planning"
        icon={FileText}
        status={planning.status}
        count={planning.applications.length + planning.designations.length}
        defaultOpen={planning.applications.length + planning.designations.length > 0}
      >
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Landmark className="size-3 text-white/40" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Designations</span>
            </div>
            <Designations planning={planning} />
            <p className="mt-2 text-[10px] text-white/30">Source: planning.data.gov.uk (MHCLG)</p>
          </div>
          <Sub icon={FileText} title="Applications">
            <Applications apps={planning.applications} />
          </Sub>
        </div>
      </Section>

      <Section
        title="Occupants"
        icon={Users}
        status={occupants.status}
        count={occupants.companies.length + occupants.charities.length}
        defaultOpen={occupants.companies.length + occupants.charities.length > 0}
      >
        {occupants.status === "unavailable" ? (
          <Note>{occupants.sources.find((s) => s.note)?.note}</Note>
        ) : occupants.companies.length === 0 && occupants.charities.length === 0 ? (
          <Empty>No companies or charities registered at this postcode.</Empty>
        ) : (
          <div className="space-y-0.5">
            {occupants.companies.slice(0, 12).map((c) => (
              <LinkRow key={c.number} title={c.name} sub={`${c.number} · ${c.status}`} href={c.url} />
            ))}
            {occupants.charities.map((c) => (
              <LinkRow key={c.number} title={c.name} sub={`Charity ${c.number}`} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Environment"
        icon={Waves}
        status={environment.status}
        count={environment.floodWarnings.length}
        defaultOpen={environment.floodWarnings.length > 0 || !!environment.floodZone}
      >
        {environment.floodZone ? (
          <div className="mb-2 flex items-center gap-2">
            <Badge
              variant={environment.floodZone.zone === "3" ? "red" : environment.floodZone.zone === "2" ? "amber" : "sky"}
            >
              Flood Zone {environment.floodZone.zone}
            </Badge>
            {environment.floodZone.type ? (
              <span className="text-[11px] text-white/55">{environment.floodZone.type}</span>
            ) : null}
          </div>
        ) : null}
        <p className="text-[12px] text-white/75">{environment.summary || "Flood status resolved."}</p>
        {environment.floodWarnings.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {environment.floodWarnings.map((w, i) => (
              <div key={i} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.05] px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant={w.severityLevel === 1 ? "red" : w.severityLevel === 2 ? "amber" : "sky"}>
                    {w.severity}
                  </Badge>
                  <span className="truncate text-[11px] text-white/70">{w.area}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[10px] text-white/30">
          Sources: planning.data.gov.uk (statutory zone) · Environment Agency (live warnings)
        </p>
        <Sub icon={Mountain} title="Ground & geological hazard">
          <GroundHazard ground={ground} />
        </Sub>
      </Section>

      <Section
        title="Ownership & sales"
        icon={Landmark}
        status={ownership.status}
        count={ownership.salesHistory.length}
        defaultOpen={ownership.salesHistory.length > 0}
      >
        <Sales ownership={ownership} />
      </Section>

      <Section
        title="Energy & floor area (EPC)"
        icon={Building2}
        status={building.status}
        defaultOpen={!!building.epcRating || building.floorArea != null}
      >
        <Epc building={building} />
      </Section>

      <Section
        title="Transport"
        icon={Train}
        status={transport.status}
        count={transport.stopCount ?? transport.nearbyStops.length}
        defaultOpen={transport.nearbyStops.length > 0}
      >
        <Transport transport={transport} />
      </Section>

      <Section title="Council tax & rates" icon={Landmark} status={financial.status}>
        <Financial financial={financial} />
      </Section>

      {/* FOIA — data that provably exists but isn't centralised. */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
        <div className="mb-2 flex items-center gap-2">
          <FileText className="size-3.5 text-white/45" />
          <span className="text-[12px] font-semibold text-white/85">Request via FOIA</span>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {foia.length} fields
          </Badge>
        </div>
        <div className="space-y-1.5">
          {foia.map((s) => (
            <FoiaRow key={s.field} stub={s} />
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-white/30">
          These records exist but aren’t published live. Each button copies a ready-to-send Freedom of Information
          request naming the authority and this property.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <span className="text-[9.5px] uppercase tracking-wider text-white/35">{label}</span>
      <div className="truncate text-[11.5px] text-white/80">{value || "—"}</div>
    </div>
  );
}

function Sub({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/8 pt-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="size-3 text-white/40" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{title}</span>
      </div>
      {children}
    </div>
  );
}

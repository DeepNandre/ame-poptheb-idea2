import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ShieldCheck,
  Building2,
  Radar,
  PoundSterling,
  TrendingUp,
  ArrowDown,
} from "lucide-react";
import type { Status, Source, SourceKind } from "./evidenceData";
import {
  thesis,
  kpis,
  claims,
  features,
  productNote,
  loi,
  pricingSummary,
  pricingReport,
  dataCostBase,
  externalSources,
  sourcesNote,
  fieldLog,
  fieldFootage,
  interviews,
  insight,
  significance,
  verifySteps,
  pendingEvidence,
  buildInPublic,
} from "./evidenceData";

const ORANGE = "#ff5400";

function DogLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} style={style} aria-hidden>
      <path
        d="M20 6c-3.2 0-5.8 1.6-7.4 4.2-1 1.6-1.5 3.4-1.5 5.3 0 1 .2 2 .5 2.9-2.2.8-4.1 2.3-5.2 4.4-1.3 2.3-1.4 5-.3 7.3 1.5 2.8 4.4 4.6 7.5 4.9-.4 1.5-.3 3.1.5 4.5 1 1.9 3 3 5.2 3h1.5c2.2 0 4.2-1.1 5.2-3 .8-1.4.9-3 .5-4.5 3.1-.3 6-2.1 7.5-4.9 1.1-2.3 1-5-.3-7.3-1.1-2.1-3-3.6-5.2-4.4.3-.9.5-1.9.5-2.9 0-1.9-.5-3.7-1.5-5.3C25.8 7.6 23.2 6 20 6Z"
        fill="currentColor"
      />
      <ellipse cx="15" cy="16.5" rx="1.6" ry="2" fill="white" />
      <ellipse cx="25" cy="16.5" rx="1.6" ry="2" fill="white" />
      <path d="M16 21.5c2 1.6 4.5 1.6 6.5 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 6v-1.5M14 8l-1.2-1.2M26 8l1.2-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  self: { label: "Our log", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  pending: { label: "Pending", cls: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${m.cls}`}
    >
      {status === "verified" && <CheckCircle2 className="size-3" />}
      {m.label}
    </span>
  );
}

const KIND_META: Record<SourceKind, { label: string; cls: string }> = {
  independent: { label: "Independent", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  vendor: { label: "Vendor", cls: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  secondary: { label: "Secondary", cls: "bg-slate-100 text-slate-600 ring-slate-500/20" },
};

function KindChip({ kind }: { kind: SourceKind }) {
  const m = KIND_META[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function SourceLink({ source }: { source?: Source }) {
  if (!source) return null;
  const inner = (
    <>
      {source.label}
      {source.dated && <span className="text-[#999]"> · {source.dated}</span>}
      {source.href && <ExternalLink className="size-3 shrink-0" />}
    </>
  );
  if (!source.href) return <span className="inline-flex items-center gap-1 text-[12px] text-[#888]">{inner}</span>;
  const external = source.href.startsWith("http");
  return (
    <a
      href={source.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#666] underline decoration-[#ccc] underline-offset-2 hover:text-black hover:decoration-black"
    >
      {inner}
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#999]">{children}</p>
  );
}

export function EvidenceDashboard() {
  return (
    <div className="min-h-screen bg-white font-inter text-[#111] antialiased">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#eee] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-6 py-3.5 md:px-10">
          <a href="/" className="flex shrink-0 items-center gap-2">
            <DogLogo className="size-8 shrink-0" style={{ color: ORANGE }} />
            <span
              className="font-serif text-[1.2rem] font-bold leading-none tracking-[-0.01em]"
              style={{ color: ORANGE }}
            >
              German Shepherd
            </span>
          </a>
          <div className="flex items-center gap-3">
            <Link to="/app" className="hidden text-[14px] font-medium text-[#444] hover:text-black sm:inline">
              Live product
            </Link>
            <a
              href="/evidence/bolttech-loi.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-semibold text-white"
              style={{ backgroundColor: ORANGE }}
            >
              <FileText className="size-4" />
              View the LOI
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-6 pb-24 md:px-10">
        {/* Thesis */}
        <section className="border-b border-[#eee] py-12 md:py-16">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: ORANGE }}
            >
              {thesis.kicker}
            </span>
            <span className="text-[11px] text-[#bbb]">· as of {thesis.asOf}</span>
          </div>
          <h1 className="mt-4 max-w-[860px] text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.08] tracking-[-0.025em]">
            German Shepherd has{" "}
            <span className="font-serif font-bold italic" style={{ color: ORANGE }}>
              real, paid demand
            </span>{" "}
            from the insurance market.
          </h1>
          <p className="mt-5 max-w-[640px] text-[15px] leading-[1.7] text-[#555]">{thesis.sub}</p>
        </section>

        {/* KPIs */}
        <section className="py-10">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#eee] lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-none tracking-[-0.02em]">
                    {k.value}
                  </span>
                  <StatusBadge status={k.status} />
                </div>
                <p className="mt-3 text-[13px] font-semibold text-[#222]">{k.label}</p>
                {k.sub && <p className="mt-1 text-[12px] leading-snug text-[#888]">{k.sub}</p>}
                {k.source && (
                  <div className="mt-3">
                    <SourceLink source={k.source} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Claims ledger */}
        <section className="py-10">
          <SectionLabel>Claims ledger — every headline traces to a source</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-[#eee]">
            {claims.map((c, i) => (
              <div
                key={c.id}
                className={`grid gap-4 p-5 md:grid-cols-[1.1fr_1.4fr] md:p-6 ${
                  i > 0 ? "border-t border-[#eee]" : ""
                }`}
              >
                <div>
                  <div className="flex items-start gap-2">
                    <StatusBadge status={c.status} />
                  </div>
                  <h3 className="mt-2.5 text-[16px] font-semibold leading-snug tracking-[-0.01em]">
                    {c.claim}
                  </h3>
                  <div className="mt-2.5">
                    <SourceLink source={c.source} />
                  </div>
                </div>
                <div className="space-y-3 text-[13.5px] leading-[1.6] text-[#555]">
                  <p>{c.evidence}</p>
                  <p className="rounded-lg bg-[#fafafa] px-3 py-2 text-[12.5px] text-[#666]">
                    <span className="font-semibold text-[#333]">How to verify · </span>
                    {c.verify}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Product capabilities */}
        <section className="py-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionLabel>Product capabilities — verified live at /app</SectionLabel>
            <a
              href="/app"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#666] underline decoration-[#ccc] underline-offset-2 hover:text-black"
            >
              Open the live product <ArrowUpRight className="size-3.5" />
            </a>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl bg-[#eee] sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-5">
                <div className="flex items-start gap-2.5">
                  <Radar className="mt-0.5 size-4 shrink-0" style={{ color: ORANGE }} />
                  <div>
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{f.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-[1.55] text-[#666]">{f.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-[1.55] text-[#999]">{productNote}</p>
        </section>

        {/* Featured LOI */}
        <section className="py-10">
          <SectionLabel>Featured artifact</SectionLabel>
          <div className="grid gap-px overflow-hidden rounded-2xl bg-[#eee] lg:grid-cols-[1fr_1.1fr]">
            {/* Left: the headline terms */}
            <div className="bg-[#0f0f0f] p-7 text-white md:p-9">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-white/50">
                <ShieldCheck className="size-3.5" style={{ color: ORANGE }} />
                Letter of Intent · {loi.reference}
              </div>
              <p className="mt-5 text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold leading-none">
                {loi.company}
              </p>
              <p className="mt-2 text-[14px] text-white/60">{loi.type} · {loi.date}</p>

              <dl className="mt-7 space-y-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-white/40">Pilot value</dt>
                  <dd className="text-[1.5rem] font-semibold" style={{ color: ORANGE }}>
                    {loi.pilotValue}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-white/40">Access granted</dt>
                  <dd className="text-[14px] text-white/90">{loi.access}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-white/40">Signed by</dt>
                  <dd className="text-[14px] font-medium text-white">{loi.signatory}</dd>
                  <dd className="text-[12px] leading-snug text-white/55">{loi.signatoryRole}</dd>
                </div>
              </dl>

              <a
                href={loi.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white"
                style={{ backgroundColor: ORANGE }}
              >
                <FileText className="size-4" />
                Open the signed document
                <ArrowUpRight className="size-4" />
              </a>
            </div>

            {/* Right: terms + deliverables */}
            <div className="bg-white p-7 md:p-9">
              <p className="text-[13px] font-semibold text-[#222]">Key terms</p>
              <ul className="mt-3 space-y-2.5">
                {loi.terms.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[13px] leading-[1.55] text-[#555]">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: ORANGE }} />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[13px] font-semibold text-[#222]">Agreed deliverables</p>
              <ul className="mt-3 space-y-1.5">
                {loi.deliverables.map((d) => (
                  <li key={d} className="flex gap-2.5 text-[12.5px] leading-[1.5] text-[#777]">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#ccc]" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Pricing — Part 1: the brief */}
        <section className="py-10">
          <SectionLabel>{pricingSummary.kicker} — the short version</SectionLabel>
          <h2 className="max-w-[760px] text-[clamp(1.5rem,3vw,2.2rem)] font-semibold leading-[1.12] tracking-[-0.02em]">
            {pricingSummary.headline}
          </h2>
          <p className="mt-4 max-w-[720px] text-[14px] leading-[1.7] text-[#555]">{pricingSummary.lede}</p>
          <div className="mt-7 grid gap-px overflow-hidden rounded-2xl bg-[#eee] sm:grid-cols-2">
            {pricingSummary.points.map((p) => (
              <div key={p.label} className="bg-white p-5">
                <div className="flex items-start gap-2.5">
                  <PoundSterling className="mt-0.5 size-4 shrink-0" style={{ color: ORANGE }} />
                  <div>
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{p.label}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#666]">{p.body}</p>
                    <div className="mt-2.5">
                      <SourceLink source={p.source} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <a
            href={pricingSummary.reportAnchor}
            className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#444] hover:text-black"
          >
            Read the full cost breakdown & growth path <ArrowDown className="size-4" style={{ color: ORANGE }} />
          </a>
        </section>

        {/* Pricing — Part 2: the larger report */}
        <section id={pricingReport.anchorId} className="scroll-mt-20 py-10">
          <SectionLabel>{pricingReport.kicker}</SectionLabel>
          <h2 className="max-w-[820px] text-[clamp(1.5rem,3vw,2.2rem)] font-semibold leading-[1.12] tracking-[-0.02em]">
            {pricingReport.headline}
          </h2>
          <p className="mt-4 max-w-[760px] text-[14px] leading-[1.7] text-[#555]">{pricingReport.intro}</p>

          {/* (a) Cost stack */}
          <div className="mt-8">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{pricingReport.costStack.label}</h3>
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-[1.6] text-[#777]">{pricingReport.costStack.intro}</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#eee]">
              {pricingReport.costStack.lines.map((l, i) => (
                <div
                  key={l.item}
                  className={`grid gap-3 p-5 md:grid-cols-[1.3fr_1fr] md:p-6 ${i > 0 ? "border-t border-[#eee]" : ""}`}
                >
                  <div>
                    <h4 className="text-[14px] font-semibold leading-snug tracking-[-0.01em]">{l.item}</h4>
                    <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#666]">{l.whatItIs}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[13px] font-semibold text-[#222]">{l.marketRate}</p>
                    {l.source && (
                      <div className="mt-1.5 md:flex md:justify-end">
                        <SourceLink source={l.source} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-[#fafafa] px-4 py-3 text-[13px] leading-[1.6] text-[#444]">
              <span className="font-semibold" style={{ color: ORANGE }}>
                Bottom line ·{" "}
              </span>
              {pricingReport.costStack.takeaway}
            </p>
          </div>

          {/* (a.2) Data cost base & moat */}
          <div className="mt-10">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{dataCostBase.label}</h3>
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-[1.6] text-[#777]">{dataCostBase.intro}</p>
            <p className="mt-4 rounded-xl bg-[#0f0f0f] px-4 py-3.5 text-[13.5px] leading-[1.6] text-white/90">
              <span className="font-semibold" style={{ color: ORANGE }}>
                The point ·{" "}
              </span>
              {dataCostBase.headline}
            </p>
            <div className="mt-5 space-y-5">
              {dataCostBase.groups.map((g) => (
                <div key={g.category}>
                  <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#aaa]">{g.category}</p>
                  <div className="overflow-hidden rounded-2xl border border-[#eee]">
                    {g.items.map((it, i) => (
                      <div
                        key={it.provider}
                        className={`grid gap-2 p-4 md:grid-cols-[1.5fr_1fr] md:items-center md:p-5 ${
                          i > 0 ? "border-t border-[#eee]" : ""
                        }`}
                      >
                        <div>
                          <a
                            href={it.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[13.5px] font-semibold tracking-[-0.01em] underline decoration-[#ddd] underline-offset-2 hover:decoration-black"
                          >
                            {it.provider}
                            <ExternalLink className="size-3 shrink-0 text-[#bbb]" />
                          </a>
                          <p className="mt-1 text-[12.5px] leading-[1.5] text-[#777]">{it.what}</p>
                        </div>
                        <p className="text-[12.5px] font-medium text-[#222] md:text-right">{it.price}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-xl bg-[#fafafa] px-4 py-3 text-[13px] leading-[1.6] text-[#444]">
              <span className="font-semibold" style={{ color: ORANGE }}>
                Moat ·{" "}
              </span>
              {dataCostBase.takeaway}
            </p>
          </div>

          {/* (b) Loss context */}
          <div className="mt-10">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{pricingReport.lossContext.label}</h3>
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-[1.6] text-[#777]">
              {pricingReport.lossContext.intro}
            </p>
            <div className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-[#eee] sm:grid-cols-2 lg:grid-cols-3">
              {pricingReport.lossContext.rows.map((r) => (
                <div key={r.stat} className="bg-white p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold leading-none tracking-[-0.02em]">
                      {r.stat}
                    </span>
                    <KindChip kind={r.kind} />
                  </div>
                  <p className="mt-3 text-[12.5px] leading-[1.55] text-[#666]">{r.detail}</p>
                  <div className="mt-2.5">
                    <SourceLink source={r.source} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* (c) ROI model */}
          <div className="mt-10">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{pricingReport.roi.label}</h3>
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-[1.6] text-[#777]">{pricingReport.roi.intro}</p>
            <div className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-[#eee] lg:grid-cols-[1fr_1fr]">
              {/* assumptions */}
              <div className="bg-white p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#999]">Assumptions (conservative)</p>
                <ul className="mt-3 space-y-2">
                  {pricingReport.roi.assumptions.map((a) => (
                    <li key={a} className="flex gap-2.5 text-[12.5px] leading-[1.55] text-[#555]">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ backgroundColor: ORANGE }} />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              {/* scenario table */}
              <div className="bg-white p-6">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#999]">
                  Return on a 1,000-policy book
                </p>
                <div className="mt-3 overflow-hidden rounded-xl border border-[#eee]">
                  <div className="grid grid-cols-[1.6fr_1fr_0.9fr] bg-[#fafafa] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#888]">
                    <span>Scenario</span>
                    <span className="text-right">Saved/yr</span>
                    <span className="text-right">ROI</span>
                  </div>
                  {pricingReport.roi.rows.map((r, i) => (
                    <div
                      key={r.scenario}
                      className={`grid grid-cols-[1.6fr_1fr_0.9fr] px-3 py-2.5 text-[12.5px] ${
                        i > 0 ? "border-t border-[#eee]" : ""
                      }`}
                    >
                      <span className="text-[#444]">{r.scenario}</span>
                      <span className="text-right font-medium text-[#222]">{r.saved}</span>
                      <span className="text-right font-semibold" style={{ color: ORANGE }}>
                        {r.roi}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <p className="rounded-xl bg-[#0f0f0f] px-4 py-3 text-[13px] leading-[1.6] text-white/90">
                <span className="font-semibold" style={{ color: ORANGE }}>
                  One claim ·{" "}
                </span>
                {pricingReport.roi.singleClaim}
              </p>
              <p className="rounded-xl bg-[#fafafa] px-4 py-3 text-[13px] leading-[1.6] text-[#444]">
                <span className="font-semibold" style={{ color: ORANGE }}>
                  Break-even ·{" "}
                </span>
                {pricingReport.roi.breakEven}
              </p>
            </div>
          </div>

          {/* (d) Growth */}
          <div className="mt-10">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{pricingReport.growth.label}</h3>
            <p className="mt-1.5 max-w-[760px] text-[13px] leading-[1.6] text-[#777]">{pricingReport.growth.intro}</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#eee]">
              {pricingReport.growth.tiers.map((t, i) => (
                <div
                  key={t.stage}
                  className={`grid gap-3 p-5 md:grid-cols-[1fr_1fr_1.3fr] md:items-center md:p-6 ${
                    i > 0 ? "border-t border-[#eee]" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: i === 0 ? ORANGE : "#bbb" }}
                      >
                        {i}
                      </span>
                      <h4 className="text-[14px] font-semibold tracking-[-0.01em]">{t.stage}</h4>
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                  <p className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: i === 0 ? ORANGE : "#222" }}>
                    {t.price}
                  </p>
                  <div className="text-[12.5px] leading-[1.55] text-[#666]">
                    <p className="text-[#444]">{t.scope}</p>
                    <p className="mt-1 text-[#999]">{t.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-px overflow-hidden rounded-2xl bg-[#eee] sm:grid-cols-3">
              {pricingReport.growth.marketBackdrop.map((b) => (
                <div key={b.stat} className="bg-white p-5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 shrink-0" style={{ color: ORANGE }} />
                    <span className="text-[15px] font-semibold tracking-[-0.01em]">{b.stat}</span>
                  </div>
                  <p className="mt-2 text-[12px] leading-[1.5] text-[#666]">{b.detail}</p>
                  <div className="mt-2">
                    <SourceLink source={b.source} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sources & methodology */}
          <div className="mt-10">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Sources & methodology</h3>
            <p className="mt-1.5 max-w-[820px] text-[12.5px] leading-[1.6] text-[#777]">{sourcesNote}</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#eee]">
              {externalSources.map((s, i) => (
                <div
                  key={s.id}
                  className={`grid gap-2 p-4 md:grid-cols-[1.7fr_1fr_auto] md:items-center md:p-5 ${
                    i > 0 ? "border-t border-[#eee]" : ""
                  }`}
                >
                  <p className="text-[12.5px] leading-[1.5] text-[#444]">{s.label}</p>
                  <div className="text-[12px] text-[#777]">
                    <a
                      href={s.href}
                      target={s.href.startsWith("http") ? "_blank" : undefined}
                      rel={s.href.startsWith("http") ? "noreferrer" : undefined}
                      className="inline-flex items-center gap-1 font-medium underline decoration-[#ccc] underline-offset-2 hover:text-black"
                    >
                      {s.publisher}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                    <span className="text-[#aaa]"> · {s.dated}</span>
                  </div>
                  <div className="md:justify-self-end">
                    <KindChip kind={s.kind} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Field validation log */}
        <section id="field-log" className="scroll-mt-20 py-10">
          <SectionLabel>Field validation — 24-hour demand-discovery method</SectionLabel>
          <p className="-mt-1 mb-4 max-w-[760px] text-[13px] leading-[1.6] text-[#777]">
            The sprint ran on two tracks. The <span className="font-semibold text-[#444]">consent-based research</span>{" "}
            below — interviews, footage, and the LOI — is the rigorous evidence. The playful{" "}
            <span className="font-semibold text-[#444]">“break-in” posts</span> in{" "}
            <a href="#build-in-public" className="underline decoration-[#ccc] underline-offset-2 hover:text-black">
              Build in public
            </a>{" "}
            are build-in-public energy, kept separate from the proof.
          </p>
          <div className="rounded-2xl border border-[#eee] p-6 md:p-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {fieldLog.map((f, i) => (
                <div key={f.action} className="relative">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: ORANGE }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#aaa]">
                      {f.when}
                    </span>
                  </div>
                  <h4 className="mt-3 text-[14px] font-semibold leading-snug">{f.action}</h4>
                  <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[#777]">{f.detail}</p>
                </div>
              ))}
            </div>

            {/* Primary-source footage */}
            <div className="mt-7 grid gap-5 border-t border-[#eee] pt-7 md:grid-cols-[1.4fr_1fr] md:items-center">
              <video
                src={fieldFootage.src}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl border border-[#eee] bg-black"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#999]">
                    Primary-source footage
                  </span>
                  <StatusBadge status={fieldFootage.status} />
                </div>
                <p className="mt-3 text-[13.5px] leading-[1.6] text-[#555]">{fieldFootage.caption}</p>
                <p className="mt-2 text-[12px] text-[#aaa]">Captured {fieldFootage.dated}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Field research — interviews */}
        <section id="field-research" className="scroll-mt-20 py-10">
          <SectionLabel>Field research — consent-based frontline interviews</SectionLabel>
          <div className="grid gap-5 md:grid-cols-2">
            {interviews.map((iv) => (
              <div key={iv.name} className="rounded-2xl border border-[#eee] p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{iv.name}</h3>
                    <p className="text-[12.5px] text-[#888]">{iv.role}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                      iv.confidence === "high"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                        : iv.confidence === "medium"
                          ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                          : "bg-slate-100 text-slate-600 ring-slate-500/20"
                    }`}
                  >
                    {iv.confidence} confidence
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[#999]">
                  <span>{iv.locationType}</span>
                  <span>·</span>
                  <span>{iv.consent}</span>
                  <span>·</span>
                  <span>{iv.dated}</span>
                </div>

                {iv.quote && (
                  <blockquote
                    className="mt-4 border-l-2 pl-3 text-[13.5px] italic leading-[1.6] text-[#444]"
                    style={{ borderColor: ORANGE }}
                  >
                    “{iv.quote}”
                  </blockquote>
                )}

                <dl className="mt-4 space-y-3 text-[12.5px] leading-[1.55]">
                  <div>
                    <dt className="font-semibold text-[#333]">Key incident</dt>
                    <dd className="text-[#666]">{iv.keyIncident}</dd>
                  </div>
                  {iv.existingControls && (
                    <div>
                      <dt className="font-semibold text-[#333]">Existing controls</dt>
                      <dd className="text-[#666]">{iv.existingControls}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-semibold text-[#333]">Pain point</dt>
                    <dd className="text-[#666]">{iv.painPoint}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#333]">Opportunity</dt>
                    <dd className="text-[#666]">{iv.opportunity}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* What we learned — insight, not a pivot */}
          <div className="mt-5 rounded-2xl border-l-2 bg-[#fafafa] p-6 md:p-7" style={{ borderColor: ORANGE }}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#999]">{insight.label}</p>
            <p className="mt-2.5 max-w-[820px] text-[15px] leading-[1.6] text-[#333]">{insight.body}</p>
          </div>
        </section>

        {/* Significance */}
        <section className="py-10">
          <SectionLabel>Why the truth matters — market significance</SectionLabel>
          <div className="rounded-2xl border border-[#eee] bg-[#fafafa] p-6 md:p-8">
            <p className="flex items-start gap-3 text-[17px] font-medium leading-[1.5] tracking-[-0.01em] text-[#222]">
              <Building2 className="mt-1 size-5 shrink-0" style={{ color: ORANGE }} />
              <span>
                <span className="font-serif italic" style={{ color: ORANGE }}>
                  We insure the insurer.
                </span>{" "}
                {significance.narrative.split(": ")[1] ?? significance.narrative}
              </span>
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {significance.points.map((p) => (
                <li
                  key={p}
                  className="flex gap-2.5 rounded-xl bg-white p-4 text-[13px] leading-[1.55] text-[#555] shadow-card"
                >
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0" style={{ color: ORANGE }} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Verify + Build-in-public + Pending */}
        <section className="grid gap-6 py-10 lg:grid-cols-3">
          {/* How to verify */}
          <div className="rounded-2xl border border-[#eee] p-6">
            <SectionLabel>How a judge verifies this</SectionLabel>
            <ol className="space-y-2.5">
              {verifySteps.map((s, i) => (
                <li key={s} className="flex gap-2.5 text-[13px] leading-[1.5] text-[#555]">
                  <span className="font-mono text-[11px] font-bold" style={{ color: ORANGE }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {/* Build in public */}
          <div id="build-in-public" className="scroll-mt-20 rounded-2xl border border-[#eee] p-6">
            <SectionLabel>Build in public</SectionLabel>
            <ul className="space-y-3">
              {buildInPublic.map((post) => (
                <li key={post.href}>
                  <a
                    href={post.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-lg border border-[#eee] p-3 hover:border-[#ddd]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[#333]">{post.platform}</span>
                      <span className="text-[11px] text-[#aaa]">{post.dated}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-[1.5] text-[#777] group-hover:text-[#555]">
                      {post.summary}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Pending — honesty */}
          <div className="rounded-2xl border border-dashed border-[#ddd] bg-[#fafafa] p-6">
            <SectionLabel>Pending evidence — honestly flagged</SectionLabel>
            <ul className="space-y-3">
              {pendingEvidence.map((p) => (
                <li key={p.label} className="flex gap-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-[#bbb]" />
                  <span className="text-[12.5px] leading-[1.5] text-[#666]">
                    <span className="font-semibold text-[#444]">{p.label} — </span>
                    {p.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-[#eee] pt-8 text-[12px] text-[#999] sm:flex-row sm:items-center">
          <span>
            German Shepherd · Validation evidence pack · Every claim above is sourced and
            independently checkable.
          </span>
          <Link to="/" className="font-medium text-[#666] hover:text-black">
            ← Back to site
          </Link>
        </footer>
      </main>
    </div>
  );
}

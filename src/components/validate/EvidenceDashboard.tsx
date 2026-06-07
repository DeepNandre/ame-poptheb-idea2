import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ShieldCheck,
  Building2,
} from "lucide-react";
import type { Status, Source } from "./evidenceData";
import {
  thesis,
  kpis,
  claims,
  loi,
  fieldLog,
  fieldFootage,
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

        {/* Field validation log */}
        <section id="field-log" className="scroll-mt-20 py-10">
          <SectionLabel>Field validation — 24-hour demand-discovery method</SectionLabel>
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
          <div className="rounded-2xl border border-[#eee] p-6">
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

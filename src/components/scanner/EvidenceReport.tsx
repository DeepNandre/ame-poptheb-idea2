import { Printer, X } from "lucide-react";
import type { Target } from "./data";

const RESOLUTION_LABEL: Record<Target["resolution"], string> = {
  analogue: "Resolved · study analogue",
  unresolved: "Identity resolved · set pending",
  anchor: "Identity anchor",
};

const LOGIC_GROUPS: { key: keyof Target["insideLogic"]; title: string }[] = [
  { key: "entrances", title: "Entrances" },
  { key: "cores", title: "Cores" },
  { key: "publicRoutes", title: "Public routes" },
  { key: "serviceRoutes", title: "Service routes" },
  { key: "plant", title: "Plant / back-of-house" },
];

// The report is intentionally a LIGHT document, independent of the app's dark
// theme, so it reads and prints like a clean PDF.
export function EvidenceReport({ target, onClose }: { target: Target; onClose: () => void }) {
  const logicCount = LOGIC_GROUPS.reduce((sum, g) => sum + target.insideLogic[g.key].length, 0);

  return (
    <div className="print-report fixed inset-0 z-50 overflow-auto bg-neutral-100 text-neutral-900">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-5 py-3 backdrop-blur">
        <span className="text-[13px] text-neutral-500">
          Evidence report — <span className="text-neutral-900">{target.name}</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-neutral-900 px-3 text-[13px] font-medium text-white hover:bg-neutral-800"
          >
            <Printer className="size-4" /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-[13px] text-neutral-700 hover:bg-neutral-50"
          >
            <X className="size-4" /> Close
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-3xl bg-white px-8 py-12 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Building Scanner · Evidence pack
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{target.name}</h1>
        <div className="mt-2 text-sm text-neutral-500">
          {target.address} · Planning {target.planning} · {RESOLUTION_LABEL[target.resolution]}
        </div>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-neutral-700">{target.summary}</p>

        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            { k: "Documents classified", v: String(target.documents.length) },
            { k: "Interior reads", v: String(logicCount) },
            { k: "Confidence", v: `${target.confidence}%` },
          ].map((stat) => (
            <div key={stat.k} className="rounded-lg border border-neutral-200 p-4">
              <div className="tnum text-3xl font-semibold tracking-tight">{stat.v}</div>
              <div className="mt-1 text-xs text-neutral-500">{stat.k}</div>
            </div>
          ))}
        </div>

        <Section title="Source register">
          <div className="rounded-lg border border-neutral-200 p-4 text-sm">
            <Row label="Authority" value={target.register.authority} />
            <Row label="System" value={target.register.system} />
            <Row label="Reference" value={target.register.ref} />
            {target.register.docCount ? (
              <Row label="Documents on file" value={String(target.register.docCount)} />
            ) : null}
            {target.register.url ? <Row label="Public URL" value={target.register.url} mono /> : null}
          </div>
        </Section>

        {target.documents.length > 0 && (
          <Section title="Classified documents">
            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2 font-medium">Sheet</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">What it reveals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {target.documents.map((doc) => (
                    <tr key={doc.id} className="align-top">
                      <td className="px-3 py-2 font-mono text-xs">{doc.file}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {doc.docType}
                        {doc.level ? <span className="text-neutral-400"> · {doc.level}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{doc.reveals.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {logicCount > 0 && (
          <Section title="Inside logic">
            <div className="space-y-5">
              {LOGIC_GROUPS.map((group) => {
                const items = target.insideLogic[group.key];
                if (items.length === 0) return null;
                return (
                  <div key={group.key}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      {group.title}
                    </div>
                    <ul className="mt-2 space-y-2 border-l border-neutral-200 pl-4">
                      {items.map((item) => (
                        <li key={item.label} className="text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-mono text-xs text-neutral-400"> · {item.source}</span>
                          <div className="text-neutral-600">{item.detail}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Investigation trace">
          <ol className="space-y-3">
            {target.trace.map((step, i) => (
              <li key={step.title} className="flex gap-3 text-sm">
                <span className="tnum font-mono text-xs text-neutral-400">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {step.title}
                    {step.ref ? (
                      <span className="font-mono text-xs text-neutral-400">{step.ref}</span>
                    ) : null}
                    {step.status !== "done" ? (
                      <span className="rounded-full border border-neutral-300 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">
                        {step.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-neutral-600">{step.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <div className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-600">
          <span className="font-medium text-neutral-900">Method &amp; scope. </span>
          Built entirely from the public planning record. No access control was bypassed and no
          non-public construction set was used — the boundary is the drawings the council itself
          publishes for permission. That is precisely the point: Google Maps shows the outside, the
          planning record shows the inside.
        </div>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 border-b border-neutral-200 pb-2 text-base font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-1.5 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className={mono ? "break-all text-right font-mono text-xs" : "text-right"}>{value}</span>
    </div>
  );
}

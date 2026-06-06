import { ShieldCheck, Database, FileText, type LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

interface Principle {
  icon: LucideIcon;
  title: string;
  body: string;
}

const PRINCIPLES: Principle[] = [
  {
    icon: ShieldCheck,
    title: "Public + passive only",
    body: "Public planning records and passively-observed signals. No traffic interception, no exploitation, no defeating access controls.",
  },
  {
    icon: Database,
    title: "Real data or nothing",
    body: "A missing source is shown as a skipped chip — never filled with synthetic data. What you see is what was actually found.",
  },
  {
    icon: FileText,
    title: "Audit-ready",
    body: "Every finding links back to its source, so the picture stands up in an underwriting file or a dispute.",
  },
];

export function Scope() {
  return (
    <section
      id="scope"
      className="relative scroll-mt-24 border-t border-white/5 bg-[#060607] px-6 py-24 md:px-12 md:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="Scope & ethics"
            title="Built to be defensible."
            subtitle="Spectre exists to reduce risk, not create it. The boundary is the product."
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-white/10 bg-black p-7">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/5 text-sky-400">
                    <Icon size={20} strokeWidth={1.6} />
                  </div>
                  <h3 className="text-lg font-medium text-white">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{p.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { FileSearch, LayoutGrid, Scale, Wrench, type LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

interface UseCase {
  icon: LucideIcon;
  title: string;
  body: string;
}

const USE_CASES: UseCase[] = [
  {
    icon: FileSearch,
    title: "Pre-bind site intelligence",
    body: "See a risk's real exposure before you quote it — the same view an attacker would build, in minutes instead of a survey.",
  },
  {
    icon: LayoutGrid,
    title: "Portfolio exposure",
    body: "Sweep a book of policyholders for the obvious openings and rank them, so remediation effort lands where it counts.",
  },
  {
    icon: Scale,
    title: "Claims & disputes",
    body: "Evidence-backed context for what was exposed and when — every finding traceable to a public or passively-observed source.",
  },
  {
    icon: Wrench,
    title: "Risk engineering",
    body: "Hand insureds a prioritized, public-data-based list of what to close — measurable risk reduction they can act on.",
  },
];

export function ForInsurers() {
  return (
    <section
      id="insurers"
      className="relative scroll-mt-24 border-t border-white/5 bg-black px-6 py-24 md:px-12 md:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="For insurers"
            title="Underwrite what attackers can already see."
            subtitle="Spectre gives underwriting, claims, and risk-engineering teams the exposure picture they can't get from a questionnaire."
          />
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {USE_CASES.map((uc, i) => {
            const Icon = uc.icon;
            return (
              <Reveal key={uc.title} delay={(i % 2) * 90}>
                <div className="flex h-full gap-5 rounded-2xl border border-white/10 bg-[#0a0a0b] p-7 transition-colors hover:border-white/20">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sky-400">
                    <Icon size={20} strokeWidth={1.6} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">{uc.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{uc.body}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

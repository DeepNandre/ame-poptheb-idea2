import { MapPin, Layers, FileCheck, type LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

interface Step {
  icon: LucideIcon;
  step: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: MapPin,
    step: "01",
    title: "Enter an address",
    body: "Point Spectre at a policyholder's site. It geocodes the location and drops it onto a full-screen dark 3D map.",
  },
  {
    icon: Layers,
    step: "02",
    title: "Spectre assembles",
    body: "It pulls the public planning record and corporate OSINT, and — on the ground — passively captures the Wi-Fi and Bluetooth signals in range.",
  },
  {
    icon: FileCheck,
    step: "03",
    title: "You get evidence",
    body: "An exposure picture with every claim linked to its source and every gap shown honestly. No fabricated data, ever.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="relative scroll-mt-24 border-t border-white/5 bg-[#060607] px-6 py-24 md:px-12 md:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="From address to evidence in one pass."
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.step} delay={i * 100}>
                <div className="liquid-glass h-full rounded-2xl border border-white/10 p-7">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sky-400">
                      <Icon size={20} strokeWidth={1.6} />
                    </div>
                    <span className="text-sm font-medium tracking-widest text-white/30">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-medium text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

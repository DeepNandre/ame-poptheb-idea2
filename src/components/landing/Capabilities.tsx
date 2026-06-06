import {
  Layers,
  Globe,
  Wifi,
  Bluetooth,
  Radar,
  Fingerprint,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

interface Capability {
  icon: LucideIcon;
  title: string;
  body: string;
}

const CAPABILITIES: Capability[] = [
  {
    icon: Layers,
    title: "Inside the building",
    body: "The public UK planning record — floor plans, sections, access and service routes — geocoded and parsed into a structured evidence panel.",
  },
  {
    icon: Globe,
    title: "Corporate OSINT",
    body: "Subdomains, exposed infrastructure (live Shodan), and tech stack for the tenants. Real data only, with honest source chips — live or skipped.",
  },
  {
    icon: Wifi,
    title: "Live Wi-Fi scan",
    body: "Real SSIDs and signal strength observed on-site, streamed live over a WebSocket from the machine on the ground.",
  },
  {
    icon: Bluetooth,
    title: "Nearby Bluetooth",
    body: "A live scan of the BLE devices in range — real RSSI and vendor labels — reflecting what is around you now, not paired history.",
  },
  {
    icon: Radar,
    title: "Signal heatmap",
    body: "An RSSI path-loss estimate of where the signals concentrate around a location, rendered over the 3D map.",
  },
  {
    icon: Fingerprint,
    title: "Device correlation",
    body: "Observed wireless devices matched to OSINT-identified people, each with a confidence score you can interrogate.",
  },
  {
    icon: Terminal,
    title: "Natural-language command bar",
    body: "Ask in plain English. Spectre routes to navigate, investigate, or recon — with a deterministic keyword fallback when offline.",
  },
];

export function Capabilities() {
  return (
    <section
      id="capabilities"
      className="relative scroll-mt-24 border-t border-white/5 bg-black px-6 py-24 md:px-12 md:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="Capabilities"
            title="One address. The whole exposure picture."
            subtitle="Spectre fuses public records with passively-observed signals into a single, evidence-backed view of a policyholder's site."
          />
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <Reveal key={cap.title} delay={(i % 3) * 80} className="bg-black">
                <div className="group h-full bg-[#0a0a0b] p-7 transition-colors hover:bg-[#0f0f12]">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sky-400 transition-colors group-hover:border-sky-400/30">
                    <Icon size={20} strokeWidth={1.6} />
                  </div>
                  <h3 className="text-lg font-medium text-white">{cap.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{cap.body}</p>
                </div>
              </Reveal>
            );
          })}
          {/* Filler cell to complete the grid edge on lg (7 cards → 9 slots). */}
          <div className="hidden bg-[#0a0a0b] lg:col-span-2 lg:block">
            <div className="flex h-full flex-col justify-center p-7">
              <p className="text-lg font-medium text-white">
                Every finding is sourced.
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-400">
                No capability fabricates data. A source is either live and cited, or shown as a
                skipped chip — so an underwriter can trust the picture end to end.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

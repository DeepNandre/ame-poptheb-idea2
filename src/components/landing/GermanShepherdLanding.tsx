import { useState } from "react";
import "./german-shepherd.css";
import { DemoModal } from "./DemoModal";
import iconSeed from "../../assets/german-shepherd/icon-seed.png";
import iconPlant from "../../assets/german-shepherd/icon-plant.png";
import iconTree from "../../assets/german-shepherd/icon-tree.png";
import iconHands from "../../assets/german-shepherd/icon-hands.png";

// Hero is a static asset served from /public.
const HERO = "/german-shepherd/hero.png";

const logos = [
  "Ordnance Survey",
  "HM Land Registry",
  "Companies House",
  "Historic England",
  "Environment Agency",
  "planning.data.gov.uk",
  "Police.uk",
  "EPC Register",
];

const packages = [
  {
    icon: iconSeed,
    name: "Underwriting",
    blurb: "Pre-bind exposure profiling for any insured address.",
    policies: ["Building profile", "Tenant recon", "Risk score"],
  },
  {
    icon: iconPlant,
    name: "Portfolio Sweeps",
    blurb: "Continuously scan an entire book of insured locations.",
    policies: ["Bulk scan", "Drift alerts", "Concentration risk"],
  },
  {
    icon: iconTree,
    name: "Claims Context",
    blurb: "Reconstruct the attacker-view of a site at time of loss.",
    policies: ["Timeline", "Evidence pack", "Sourced findings"],
  },
  {
    icon: iconHands,
    name: "Risk Engineering",
    blurb: "Hand policyholders a remediation list they can actually use.",
    policies: ["Exposure map", "Fix list", "Audit trail"],
  },
];

const streams = [
  { name: "Planning record", blurb: "Geocode → PlanIt/Idox → drawings, floor plans, history. What's actually inside the building." },
  { name: "Building Intelligence Engine", blurb: "Police crime, food hygiene, EA flood, conservation area, listed grade, Article 4, TPO, green belt — keyless and live." },
  { name: "Corporate OSINT", blurb: "Company → domain → subdomains via cert transparency + passive DNS, tech stack, exposed infra, employees." },
  { name: "Live wireless", blurb: "Passive WiFi + Bluetooth of the surrounding RF environment. Real SSIDs, signal heatmap, device-to-employee correlation." },
  { name: "CCTV discovery", blurb: "Surfaces RTSP cameras visible on the local network and streams them in-browser for site walk-throughs." },
  { name: "3D schematics", blurb: "Lazy-loaded react-three-fiber viewer for floorplate context, opened as a dark overlay on the dashboard." },
];

const traditional = [
  "Postcode-level averages",
  "Stale third-party scores",
  "Black-box risk grades",
  "Address ≠ building ≠ tenant",
  "Manual broker questionnaires",
  "Synthetic or modelled signals",
];
const ours = [
  "Building-level, tenant-level intelligence",
  "Live public sources, re-pulled on demand",
  "Every finding cites its source",
  "One address → one unified profile",
  "Natural-language command bar",
  "Real data or an honest gap — never synthetic",
];

export function GermanShepherdLanding() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

  return (
    <div className="gs-landing min-h-screen bg-background text-foreground">
      {/* Announcement bar */}
      <button
        onClick={openDemo}
        className="block w-full bg-primary text-primary-foreground text-sm py-2.5 text-center px-4 hover:opacity-95"
      >
        <span className="font-medium">New</span> · Public + passive intelligence for insurers — request access →
      </button>

      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-display text-2xl text-primary">German Shepherd</span>
          </a>
          <ul className="hidden md:flex items-center gap-8 text-sm text-foreground/80">
            <li><a href="#product" className="hover:text-foreground">Product</a></li>
            <li><a href="#streams" className="hover:text-foreground">Intelligence streams</a></li>
            <li><a href="#principle" className="hover:text-foreground">Principles</a></li>
            <li><a href="#use-cases" className="hover:text-foreground">Use cases</a></li>
            <li><a href="#demo" className="hover:text-foreground">Book a demo</a></li>
          </ul>
          <div className="flex items-center gap-2">
            <a href="/app" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90">
              Launch platform →
            </a>
            <button onClick={openDemo} className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">Book a demo</button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section id="top" className="relative w-full">
        <img src={HERO} alt="See your policyholders the way attackers do" className="w-full h-auto block" />
      </section>

      {/* Launch CTA */}
      <section className="bg-background py-8 text-center">
        <div className="max-w-3xl mx-auto px-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="/app"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90"
          >
            Launch the platform →
          </a>
          <button
            onClick={openDemo}
            className="inline-flex items-center gap-2 rounded-full border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-secondary"
          >
            Book a demo
          </button>
        </div>
      </section>

      {/* Logo marquee */}
      <section className="border-y border-border/60 bg-background py-10 overflow-hidden">
        <p className="text-center text-xs uppercase tracking-[0.18em] text-muted-foreground mb-6">
          Built for underwriters, risk engineers, and claims teams
        </p>
        <div className="relative">
          <div className="flex gap-16 animate-marquee whitespace-nowrap w-max">
            {[...logos, ...logos, ...logos].map((l, i) => (
              <span key={i} className="font-display text-2xl text-foreground/40">{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Product pitch */}
      <section id="product" className="max-w-5xl mx-auto px-6 py-24 md:py-32 text-center">
        <h2 className="text-4xl md:text-6xl leading-tight">
          Any insured address becomes an{" "}
          <em className="text-primary font-display italic">intelligence surface.</em>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
          German Shepherd reconstructs the same picture an attacker would build about a site and the
          company inside it — assembled entirely from public records and passively-observed signals.
          So an underwriter can price and reduce that risk before it becomes a claim.
        </p>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="bg-secondary/50 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <h2 className="text-4xl md:text-5xl leading-tight">Built for the <em className="font-display italic text-primary">insurance stack.</em></h2>
            <p className="mt-4 text-lg text-muted-foreground">The buyer is the insurer. The subject is their policyholder's building and the company inside it.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {packages.map((p) => (
              <div key={p.name} className="group bg-card rounded-3xl p-7 border border-border/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                <img src={p.icon} alt="" width={120} height={120} loading="lazy" className="w-24 h-24 object-contain mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl mb-2">{p.name}</h3>
                <p className="text-sm text-muted-foreground mb-5">{p.blurb}</p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {p.policies.map((pol) => (
                    <span key={pol} className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary text-xs font-medium text-secondary-foreground border border-border/60">{pol}</span>
                  ))}
                </div>
                <a href="#demo" className="mt-auto text-sm font-semibold text-primary hover:underline">See it on your book →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence streams */}
      <section id="streams" className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="max-w-2xl mb-16">
          <h2 className="text-4xl md:text-5xl leading-tight">Six streams, <em className="font-display italic text-primary">one unified profile.</em></h2>
          <p className="mt-4 text-lg text-muted-foreground">A frosted-glass command dashboard with a natural-language command bar fuses every signal into one picture of the site.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams.map((s) => (
            <div key={s.name} className="bg-card rounded-2xl p-7 border border-border/60">
              <h3 className="text-xl mb-2 text-primary font-display">{s.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Principle */}
      <section id="principle" className="max-w-5xl mx-auto px-6 py-24 md:py-32">
        <div className="rounded-3xl bg-accent p-10 md:p-16 text-center">
          <p className="text-2xl md:text-4xl leading-snug font-display italic text-ink">
            "Public + passive only. Real data, or an honest gap — never synthetic. Every finding is
            sourced; a missing key shows up as a skipped chip, not fake data."
          </p>
          <div className="mt-8 text-sm text-muted-foreground">
            The ethics boundary and the selling point. Audit-ready for the underwriting file.
          </div>
        </div>
      </section>

      {/* Advantage / comparison */}
      <section id="advantage" className="bg-secondary/50 py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl text-center mb-16">Why insurers choose <em className="font-display italic text-primary">German Shepherd.</em></h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card rounded-3xl p-8 border border-border/60">
              <h3 className="text-2xl mb-4 text-muted-foreground">Traditional risk data</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {traditional.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="text-destructive mt-0.5">✕</span> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-3xl p-8 border-2 border-primary shadow-xl shadow-primary/10">
              <h3 className="text-2xl mb-4 text-primary">German Shepherd</h3>
              <ul className="space-y-3 text-sm">
                {ours.map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">✓</span> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">
                We unify planning, building, corporate OSINT, RF, and CCTV into one pane — so
                underwriters price the actual risk, not a postcode proxy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section id="demo" className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <h2 className="text-4xl md:text-5xl text-center mb-16">See it run against your <em className="font-display italic text-primary">own book.</em></h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-3xl p-10 bg-card border border-border/60">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">Demo</div>
            <h3 className="text-3xl mb-3">Bring one address. We'll show you everything.</h3>
            <p className="text-muted-foreground mb-6">Give us a single insured location. We'll run the full unified profile live on the call — planning record, building intelligence, corporate OSINT, RF, and CCTV discovery — every finding sourced.</p>
            <p className="text-sm text-muted-foreground mb-8"><strong className="text-foreground">Best for:</strong> Underwriters and risk engineers who want to see attacker-view intelligence on a real risk.</p>
            <button onClick={openDemo} className="inline-flex items-center px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">Book a demo →</button>
          </div>
          <div className="rounded-3xl p-10 bg-foreground text-background">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">Portfolio sweep</div>
            <h3 className="text-3xl mb-3 text-background">Run it across your full book.</h3>
            <p className="text-background/70 mb-6">Bulk-profile thousands of locations. Surface concentration risk, exposed infrastructure, and drift since bind — all from public + passive sources, all audit-ready.</p>
            <p className="text-sm text-background/70 mb-8"><strong className="text-background">Best for:</strong> Portfolio managers and reinsurers who need exposure visibility across the book.</p>
            <button onClick={openDemo} className="inline-flex items-center px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90">Talk to us →</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-display text-xl text-primary">German Shepherd</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} German Shepherd. Public + passive intelligence for insurers.</p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

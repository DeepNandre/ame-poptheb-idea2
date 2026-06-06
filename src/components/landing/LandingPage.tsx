import { useEffect, useState } from "react";
import { Hero } from "./Hero";
import { Thesis } from "./Thesis";
import { Capabilities } from "./Capabilities";
import { HowItWorks } from "./HowItWorks";
import { ForInsurers } from "./ForInsurers";
import { Scope } from "./Scope";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { DemoModal } from "./DemoModal";

/**
 * Spectre marketing landing — attack-surface intelligence for insurers.
 *
 * Visiting with `?demo` (e.g. from an email or ad) opens the demo form straight
 * away.
 */
export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo") || params.has("access")) setDemoOpen(true);
  }, []);

  const openDemo = () => setDemoOpen(true);

  return (
    <div className="font-inter min-h-screen overflow-x-hidden bg-black text-white">
      <Hero onBookDemo={openDemo} />
      <Thesis />
      <Capabilities />
      <HowItWorks />
      <ForInsurers />
      <Scope />
      <FinalCta onBookDemo={openDemo} />
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Hero } from "./Hero";
import { EarlyAccessModal } from "./EarlyAccessModal";

/**
 * Stealth teaser landing — full-screen hero video with an early-access form.
 * Deliberately does not reveal the underlying product.
 *
 * Visiting with `?access` (e.g. from an email or social link) opens the
 * early-access form straight away.
 */
export function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("access")) {
      setModalOpen(true);
    }
  }, []);

  return (
    <div className="font-inter min-h-screen bg-black">
      <Hero onRequestAccess={() => setModalOpen(true)} />
      <EarlyAccessModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

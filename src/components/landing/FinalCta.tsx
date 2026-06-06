import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

interface FinalCtaProps {
  onBookDemo: () => void;
}

export function FinalCta({ onBookDemo }: FinalCtaProps) {
  return (
    <section id="demo" className="relative scroll-mt-24 border-t border-white/5 bg-black px-6 py-28 md:px-12 lg:px-16">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <h2
            className="text-3xl font-normal md:text-4xl lg:text-5xl"
            style={{ letterSpacing: "-0.03em" }}
          >
            See what attackers see &mdash; before they do.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-gray-400 md:text-lg">
            Bring us an address. We&rsquo;ll show you the exposure picture Spectre builds from
            public records and passive signals alone.
          </p>
          <div className="mt-9 flex justify-center">
            <button
              onClick={onBookDemo}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 font-medium text-black transition-colors hover:bg-gray-100"
            >
              Book a demo
              <ArrowRight size={18} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

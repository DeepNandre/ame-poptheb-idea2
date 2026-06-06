import { Reveal } from "./Reveal";

export function Thesis() {
  return (
    <section className="relative border-t border-white/5 bg-black px-6 py-24 md:px-12 md:py-32 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-2xl font-light leading-snug tracking-tight text-white md:text-4xl lg:text-5xl">
            Google Maps shows the outside.
            <br />
            <span className="text-gray-500">The planning record shows the inside.</span>
          </p>
        </Reveal>
        <Reveal delay={120}>
          <p className="mt-8 max-w-3xl text-base text-gray-400 md:text-lg">
            Every building is an intelligence surface. Spectre reads the public planning record,
            the corporate footprint of its tenants, and the wireless signals in the air around it
            &mdash; then assembles the same picture an attacker would. All from data that is
            already public or passively observable, never intercepted.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

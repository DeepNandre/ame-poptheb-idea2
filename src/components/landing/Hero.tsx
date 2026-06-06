import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { FadeIn } from "./FadeIn";
import { AnimatedHeading } from "./AnimatedHeading";
import { LandingNavbar } from "./LandingNavbar";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

interface HeroProps {
  onBookDemo: () => void;
}

export function Hero({ onBookDemo }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const play = () => video.play().catch(() => {});
    if (video.readyState >= 2) play();
    else video.addEventListener("loadeddata", play, { once: true });
    return () => video.removeEventListener("loadeddata", play);
  }, []);

  return (
    <section id="top" className="font-inter relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        src={HERO_VIDEO}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Just enough scrim at the edges to keep text legible over any frame. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      <LandingNavbar onBookDemo={onBookDemo} />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-end px-6 pb-16 pt-28 md:px-12 lg:px-16 lg:pb-24">
        <FadeIn delay={150} duration={900}>
          <div className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sky-300 sm:text-xs sm:tracking-[0.18em]">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            Attack-surface intelligence for insurers
          </div>
        </FadeIn>

        <AnimatedHeading
          text={"We show insurers what attackers\nalready know about their policyholders."}
          className="max-w-5xl text-4xl font-normal md:text-5xl lg:text-6xl xl:text-[4.25rem] xl:leading-[1.05]"
          style={{ letterSpacing: "-0.04em" }}
          charDelay={14}
          duration={450}
        />

        <FadeIn delay={900} duration={1000}>
          <p className="mt-6 max-w-2xl text-base text-gray-300 md:text-lg">
            Spectre turns any insured address into an attacker&rsquo;s-eye picture &mdash;
            assembled only from public records and passively-observed signals. Quantify the
            exposure before it becomes a claim.
          </p>
        </FadeIn>

        <FadeIn delay={1200} duration={1000}>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={onBookDemo}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3 font-medium text-black transition-colors hover:bg-gray-100"
            >
              Book a demo
              <ArrowRight size={18} />
            </button>
            <a
              href="#how"
              className="liquid-glass rounded-lg border border-white/20 px-7 py-3 font-medium text-white transition-colors hover:bg-white hover:text-black"
            >
              See how it works
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={1500} duration={1000}>
          <p className="mt-8 text-sm text-gray-400">
            Public records + passive signals only. Real data or an honest gap &mdash; never synthetic.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

import { useEffect, useRef } from "react";
import { FadeIn } from "./FadeIn";
import { AnimatedHeading } from "./AnimatedHeading";
import { LandingNavbar } from "./LandingNavbar";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4";

interface HeroProps {
  onRequestAccess: () => void;
}

export function Hero({ onRequestAccess }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Some browsers refuse autoplay until the muted flag is set in JS; kick it
  // off as soon as enough data is available.
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
    <section className="font-inter relative h-screen w-full overflow-hidden bg-black text-white">
      {/* Raw full-screen background video — no overlay, no dimming. */}
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

      {/* Foreground: navbar at top, content pinned to bottom. */}
      <div className="relative z-10 flex h-full flex-col">
        <LandingNavbar onRequestAccess={onRequestAccess} />

        <div className="flex flex-1 flex-col justify-end px-6 pb-12 md:px-12 lg:px-16 lg:pb-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-end">
            {/* Left column — main content */}
            <div>
              <AnimatedHeading
                text={"Shaping tomorrow\nwith vision and action."}
                className="mb-4 text-4xl font-normal md:text-5xl lg:text-6xl xl:text-7xl"
                style={{ letterSpacing: "-0.04em" }}
              />

              <FadeIn delay={800} duration={1000}>
                <p className="mb-5 max-w-xl text-base text-gray-300 md:text-lg">
                  We back visionaries and craft ventures that define what comes next.
                </p>
              </FadeIn>

              <FadeIn delay={1200} duration={1000}>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={onRequestAccess}
                    className="rounded-lg bg-white px-8 py-3 font-medium text-black transition-colors hover:bg-gray-100"
                  >
                    Start a Chat
                  </button>
                  <button
                    onClick={onRequestAccess}
                    className="liquid-glass rounded-lg border border-white/20 px-8 py-3 font-medium text-white transition-colors hover:bg-white hover:text-black"
                  >
                    Explore Now
                  </button>
                </div>
              </FadeIn>
            </div>

            {/* Right column — tag, bottom-right on large screens */}
            <div className="mt-8 flex items-end justify-start lg:mt-0 lg:justify-end">
              <FadeIn delay={1400} duration={1000}>
                <div className="liquid-glass rounded-xl border border-white/20 px-6 py-3">
                  <span className="text-lg font-light md:text-xl lg:text-2xl">
                    Investing. Building. Advisory.
                  </span>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

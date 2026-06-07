import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Link } from "react-router-dom";

const ORANGE = "#ff5400";

function DogLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} style={style} aria-hidden>
      <path
        d="M20 6c-3.2 0-5.8 1.6-7.4 4.2-1 1.6-1.5 3.4-1.5 5.3 0 1 .2 2 .5 2.9-2.2.8-4.1 2.3-5.2 4.4-1.3 2.3-1.4 5-.3 7.3 1.5 2.8 4.4 4.6 7.5 4.9-.4 1.5-.3 3.1.5 4.5 1 1.9 3 3 5.2 3h1.5c2.2 0 4.2-1.1 5.2-3 .8-1.4.9-3 .5-4.5 3.1-.3 6-2.1 7.5-4.9 1.1-2.3 1-5-.3-7.3-1.1-2.1-3-3.6-5.2-4.4.3-.9.5-1.9.5-2.9 0-1.9-.5-3.7-1.5-5.3C25.8 7.6 23.2 6 20 6Z"
        fill="currentColor"
      />
      <ellipse cx="15" cy="16.5" rx="1.6" ry="2" fill="white" />
      <ellipse cx="25" cy="16.5" rx="1.6" ry="2" fill="white" />
      <path d="M16 21.5c2 1.6 4.5 1.6 6.5 0" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 6v-1.5M14 8l-1.2-1.2M26 8l1.2-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Solutions", dropdown: true },
  { label: "Products", dropdown: true },
  { label: "Company", dropdown: true },
  { label: "Customers", dropdown: false },
  { label: "Book a demo", dropdown: false },
];

export function GermanShepherdLanding() {
  const [bannerOpen, setBannerOpen] = useState(true);

  return (
    <div className="min-h-screen bg-white font-inter text-[#111] antialiased">
      {bannerOpen && (
        <div
          className="relative px-4 py-2.5 text-center text-[13px] font-medium text-white"
          style={{ backgroundColor: ORANGE }}
        >
          Announcing our $50K LOIs Fundraise
          <button
            type="button"
            onClick={() => setBannerOpen(false)}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/90 hover:bg-white/15"
            aria-label="Dismiss announcement"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="relative min-h-[calc(100vh-42px)] overflow-hidden">
        <img
          src="/landing/hero-sky-bg.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.08)_55%,transparent_100%)]" />

        {/* Decorative layers — blend modes remove baked-in black/white backdrops */}
        <img
          src="/landing/hero-dog-cape.png"
          alt=""
          className="pointer-events-none absolute right-[-2%] top-[14%] z-[5] w-[min(46vw,540px)] max-w-none -scale-x-100 select-none object-contain mix-blend-screen lg:right-[4%] lg:top-[12%] xl:w-[520px]"
        />
        <img
          src="/landing/hero-vintage-hand.png"
          alt=""
          className="pointer-events-none absolute bottom-[-4%] left-[-3%] z-[5] w-[min(36vw,320px)] select-none object-contain mix-blend-multiply lg:bottom-0 lg:left-0 lg:w-[300px]"
        />

        <header className="relative z-20 px-6 pt-5 md:px-12 lg:px-16 lg:pt-6">
          <nav className="flex items-center justify-between gap-4">
            <a href="/" className="flex shrink-0 items-center gap-2">
              <DogLogo className="size-9 shrink-0" style={{ color: ORANGE }} />
              <span
                className="font-serif text-[1.35rem] font-bold leading-none tracking-[-0.01em] md:text-[1.65rem]"
                style={{ color: ORANGE }}
              >
                German Shepherd
              </span>
            </a>

            <ul className="hidden items-center gap-8 xl:flex">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <a
                    href="#"
                    className="flex items-center gap-0.5 text-[15px] font-normal text-[#222] hover:text-black"
                  >
                    {item.label}
                    {item.dropdown && <ChevronDown className="size-3.5 stroke-[2.5] opacity-50" />}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#111] px-4 py-2 text-[14px] font-medium text-white hover:bg-black md:px-5 md:py-2.5"
              >
                Login
              </button>
              <Link
                to="/app"
                className="rounded-lg px-4 py-2 text-[14px] font-medium text-white md:px-5 md:py-2.5"
                style={{ backgroundColor: ORANGE }}
              >
                Get insured
              </Link>
            </div>
          </nav>
        </header>

        <div className="relative z-20 mx-auto flex min-h-[calc(100vh-130px)] max-w-[920px] flex-col items-center justify-center px-6 pb-20 pt-6 text-center md:px-10">
          <h1 className="text-[clamp(2.5rem,5.8vw,4.75rem)] font-semibold leading-[1.06] tracking-[-0.025em] text-[#111]">
            See your policyholders
            <br />
            the way{" "}
            <span className="font-serif font-bold italic" style={{ color: ORANGE }}>
              attackers do.
            </span>
          </h1>

          <p className="mt-7 max-w-[680px] text-[15px] leading-[1.7] text-[#444] md:text-[16px]">
            The intelligence layer that profiles a building, its tenants, and their exposure,
            from public data alone, every finding sourced and audit-ready.
          </p>

          <Link
            to="/app"
            className="mt-10 inline-flex items-center justify-center rounded-lg px-9 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(255,84,0,0.28)] transition hover:brightness-95"
            style={{ backgroundColor: ORANGE }}
          >
            Get insured now
          </Link>
        </div>
      </div>
    </div>
  );
}

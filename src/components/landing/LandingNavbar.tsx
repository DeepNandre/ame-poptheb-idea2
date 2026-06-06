interface LandingNavbarProps {
  onBookDemo: () => void;
}

const NAV_LINKS = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how" },
  { label: "For insurers", href: "#insurers" },
  { label: "Scope", href: "#scope" },
];

export function LandingNavbar({ onBookDemo }: LandingNavbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4 md:px-8 md:pt-6 lg:px-12">
      <nav className="liquid-glass mx-auto flex max-w-7xl items-center justify-between rounded-xl px-4 py-2.5">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_12px_2px_rgba(56,189,248,0.6)]" />
          <span className="text-xl font-semibold tracking-tight text-white">Spectre</span>
        </a>

        {/* Center links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-gray-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onBookDemo}
          className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100"
        >
          Book a demo
        </button>
      </nav>
    </header>
  );
}

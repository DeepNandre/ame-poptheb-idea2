interface LandingNavbarProps {
  onRequestAccess: () => void;
}

const NAV_LINKS = ["Story", "Investing", "Building", "Advisory"];

export function LandingNavbar({ onRequestAccess }: LandingNavbarProps) {
  return (
    <div className="px-6 pt-6 md:px-12 lg:px-16">
      <nav className="liquid-glass flex items-center justify-between rounded-xl px-4 py-2">
        {/* Logo */}
        <span className="text-2xl font-semibold tracking-tight text-white">VEX</span>

        {/* Center links — hidden on mobile */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm text-white transition-colors hover:text-gray-300"
            >
              {link}
            </a>
          ))}
        </div>

        {/* Right CTA */}
        <button
          onClick={onRequestAccess}
          className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100"
        >
          Start a Chat
        </button>
      </nav>
    </div>
  );
}

const FOOTER_LINKS = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "How it works", href: "#how" },
  { label: "For insurers", href: "#insurers" },
  { label: "Scope", href: "#scope" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black px-6 py-12 md:px-12 lg:px-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-lg font-semibold tracking-tight text-white">Spectre</span>
        </div>

        <nav className="flex flex-wrap gap-x-7 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-8 max-w-7xl border-t border-white/5 pt-6">
        <p className="max-w-3xl text-xs leading-relaxed text-gray-500">
          Spectre surfaces public planning records and passively-captured signals only. It does
          not intercept traffic, exploit devices, or defeat any access control.
        </p>
        <p className="mt-3 text-xs text-gray-600">
          &copy; {2026} Spectre. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

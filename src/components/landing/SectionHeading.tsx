interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ eyebrow, title, subtitle, className }: SectionHeadingProps) {
  return (
    <div className={className}>
      {eyebrow && (
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-sky-400/90">
          {eyebrow}
        </p>
      )}
      <h2
        className="text-3xl font-normal md:text-4xl lg:text-5xl"
        style={{ letterSpacing: "-0.03em" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-2xl text-base text-gray-400 md:text-lg">{subtitle}</p>
      )}
    </div>
  );
}

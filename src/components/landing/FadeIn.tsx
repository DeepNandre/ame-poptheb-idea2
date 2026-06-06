import { useEffect, useState, type ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  /** Delay before the fade begins, in ms. */
  delay?: number;
  /** Transition duration, in ms. */
  duration?: number;
  className?: string;
}

/**
 * Wraps children and fades them from opacity 0 → 1 after `delay` ms.
 * Uses a setTimeout + state flip and an inline transitionDuration so each
 * instance can be timed independently (matches the hero's staggered reveals).
 */
export function FadeIn({ children, delay = 0, duration = 1000, className }: FadeInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-opacity${className ? ` ${className}` : ""}`}
      style={{ opacity: visible ? 1 : 0, transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

import { Fragment, useEffect, useState, type CSSProperties } from "react";

interface AnimatedHeadingProps {
  /** Heading text. Split on "\n" into separate lines. */
  text: string;
  className?: string;
  style?: CSSProperties;
  /** Delay before the whole animation starts, in ms. */
  initialDelay?: number;
  /** Stagger between consecutive characters, in ms. */
  charDelay?: number;
  /** Per-character transition duration, in ms. */
  duration?: number;
}

/**
 * Character-by-character entrance heading. Each character starts at
 * opacity 0 / translateX(-18px) and slides into place. The stagger for a
 * character is (lineIndex * lineLength * charDelay) + (charIndex * charDelay),
 * and the whole sequence begins after `initialDelay`.
 *
 * Letters are grouped into per-word inline-block units (so a word never breaks
 * mid-glyph), with a normal breaking space between words (so a long line still
 * wraps at word boundaries instead of overflowing).
 */
export function AnimatedHeading({
  text,
  className,
  style,
  initialDelay = 200,
  charDelay = 30,
  duration = 500,
}: AnimatedHeadingProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), initialDelay);
    return () => clearTimeout(timer);
  }, [initialDelay]);

  const lines = text.split("\n");

  const charStyle = (lineIndex: number, lineLength: number, charIndex: number): CSSProperties => ({
    opacity: animate ? 1 : 0,
    transform: animate ? "translateX(0)" : "translateX(-18px)",
    transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
    transitionDelay: `${lineIndex * lineLength * charDelay + charIndex * charDelay}ms`,
  });

  return (
    <h1 className={className} style={style}>
      {lines.map((line, lineIndex) => {
        const lineLength = line.length;
        const words = line.split(" ");
        // Continuous index across the whole line (spaces included) so the
        // stagger reads as one sweep regardless of word grouping.
        let charCursor = 0;
        return (
          <span key={lineIndex} className="block">
            {words.map((word, wordIndex) => {
              const letters = word.split("").map((char) => {
                const idx = charCursor++;
                return (
                  <span
                    key={idx}
                    className="inline-block"
                    style={charStyle(lineIndex, lineLength, idx)}
                  >
                    {char}
                  </span>
                );
              });
              const isLast = wordIndex === words.length - 1;
              if (!isLast) charCursor++; // account for the inter-word space in the stagger
              return (
                <Fragment key={wordIndex}>
                  <span className="inline-block whitespace-nowrap">{letters}</span>
                  {/* Breakable space between words → the line wraps at word boundaries. */}
                  {!isLast ? " " : null}
                </Fragment>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}

import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";

interface DraggableWindowProps {
  /** Fully styled title node (icon + label). */
  title: ReactNode;
  /** Optional styled badge shown on the right of the header (e.g. a "live" tag). */
  live?: ReactNode;
  defaultX: number;
  defaultY: number;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A frosted-glass floating window the user can drag anywhere by its header and
 * close. Position is local state seeded from defaultX/Y and clamped to the
 * viewport. Used for the independent WiFi and Bluetooth scan panels.
 */
export function DraggableWindow({
  title,
  live,
  defaultX,
  defaultY,
  width = 256,
  onClose,
  children,
}: DraggableWindowProps) {
  const [pos, setPos] = useState({ x: defaultX, y: defaultY });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, e.clientX - drag.current.dx));
    const y = Math.max(8, Math.min(window.innerHeight - 56, e.clientY - drag.current.dy));
    setPos({ x, y });
  };
  const endDrag = (e: ReactPointerEvent) => {
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className="no-print glass absolute z-30 flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl"
      style={{ left: pos.x, top: pos.y, width }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex shrink-0 cursor-grab touch-none select-none items-center justify-between border-b border-white/10 px-3.5 py-2.5 active:cursor-grabbing"
      >
        {title}
        <div className="flex items-center gap-2.5">
          {live}
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close"
            className="text-white/40 transition-colors hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="scroll-quiet min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

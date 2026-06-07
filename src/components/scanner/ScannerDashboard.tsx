import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { Radar, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashTab {
  id: string;
  label: string;
  badge?: number | string | null;
}

interface ScannerDashboardProps {
  open: boolean;
  tab: string;
  tabs: DashTab[];
  onTab: (id: string) => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Centered glassmorphic command dashboard. Click-through overlay
 * (pointer-events-none) except the card, so the map stays interactive around
 * it. Draggable by its header — the drag applies a translate offset on top of
 * the centered position, so it starts centered and can be moved anywhere.
 */
export function ScannerDashboard({ open, tab, tabs, onTab, onClose, children }: ScannerDashboardProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    });
  };
  const endDrag = (e: ReactPointerEvent) => {
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  if (!open) return null;
  return (
    <div className="no-print pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-4 pb-28 pt-20">
      <div
        className="glass pointer-events-auto flex max-h-full w-[min(600px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {/* Header — drag handle */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex shrink-0 cursor-grab touch-none select-none items-center justify-between border-b border-white/10 px-4 py-2.5 active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-white text-black">
              <Radar className="size-3.5" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">Building Scanner</span>
          </div>
          <button
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            title="Hide dashboard"
            aria-label="Hide dashboard"
            className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Minus className="size-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="scroll-quiet flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === t.id
                  ? "bg-white/15 text-white"
                  : "text-white/55 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              {t.label}
              {t.badge != null && t.badge !== 0 && t.badge !== "" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] tabular-nums",
                    tab === t.id ? "bg-white/20 text-white" : "bg-white/10 text-white/60",
                  )}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Active section */}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

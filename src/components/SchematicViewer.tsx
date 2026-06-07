import { lazy, Suspense, useEffect } from "react";
import { X } from "lucide-react";

// Lazy — pulls in three.js + react-three-fiber only when a schematic is opened,
// keeping the main /app bundle lean.
const ArborViewer = lazy(() => import("./schematic/ArborViewer"));

interface SchematicViewerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

/**
 * Full-screen dark overlay that hosts the co-founder's 3D building schematic.
 * Dark on purpose — the schematic reads as a lit model against black, which is
 * why it gets its own surface instead of being drawn over the light map.
 */
export function SchematicViewer({ open, onClose, title = "Arbor 22 — 3D schematic" }: SchematicViewerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="arbor-viewer fixed inset-0 z-[60] bg-[#0a0a0f]">
      <button
        onClick={onClose}
        className="fixed right-4 top-4 z-[70] flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-[13px] font-medium text-white/90 backdrop-blur transition-colors hover:bg-black/80"
      >
        <X className="size-4" /> Close
      </button>
      <span className="pointer-events-none fixed left-1/2 top-4 z-[70] -translate-x-1/2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/40">
        {title}
      </span>
      <Suspense
        fallback={
          <div className="grid h-full w-full place-items-center text-sm text-white/60">
            Loading 3D schematic…
          </div>
        }
      >
        <ArborViewer />
      </Suspense>
    </div>
  );
}

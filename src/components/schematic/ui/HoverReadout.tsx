import type { UnitMeta } from '@/components/schematic/lib/types';

export function HoverReadout({ hovered }: { hovered: UnitMeta | null }) {
  return (
    <div id="hover-readout" className={hovered ? 'visible' : ''}>
      {hovered && (
        <>
          {hovered.label || hovered.kind}
          <span className="htype">{hovered.kind}</span>
        </>
      )}
    </div>
  );
}

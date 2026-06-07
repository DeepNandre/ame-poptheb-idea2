import type { Floor } from '@/components/schematic/lib/types';

interface Props {
  floors: Floor[];
  activeFloor: string;
  onFloor: (level: string) => void;
}

/** Floor selector — a tall left column that spans to the bottom of the page.
 *  Type filters / show-hide toggles live in the SidePanel to its right. */
export function Controls({ floors, activeFloor, onFloor }: Props) {
  // Original lists floors top-down (reversed).
  const ordered = [...floors].reverse();
  return (
    <div id="controls">
      <h3>Floors</h3>
      <button
        className={`floor-btn all${activeFloor === 'all' ? ' active' : ''}`}
        onClick={() => onFloor('all')}
      >
        All Floors
      </button>
      <div id="floor-list">
        {ordered.map((fl) => {
          const lvl = String(fl.level);
          return (
            <button
              key={lvl}
              className={`floor-btn${activeFloor === lvl ? ' active' : ''}`}
              onClick={() => onFloor(lvl)}
            >
              {fl.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

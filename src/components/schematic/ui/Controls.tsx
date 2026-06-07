import type { Floor } from '@/components/schematic/lib/types';
import { TYPE_FILTER_ORDER } from '@/components/schematic/lib/scene/constants';

interface Props {
  floors: Floor[];
  activeFloor: string;
  onFloor: (level: string) => void;
  categoryEnabled: Record<string, boolean>;
  onToggleCategory: (type: string) => void;
  onResetHidden: () => void;
}

export function Controls({
  floors,
  activeFloor,
  onFloor,
  categoryEnabled,
  onToggleCategory,
  onResetHidden,
}: Props) {
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

      <h3 className="sep">Show Types</h3>
      <div id="type-filters">
        {TYPE_FILTER_ORDER.map((t) => (
          <label key={t} className="chk">
            <input
              type="checkbox"
              checked={categoryEnabled[t] ?? true}
              onChange={() => onToggleCategory(t)}
            />{' '}
            {t}
          </label>
        ))}
      </div>

      <button id="reset-btn" onClick={onResetHidden}>
        Reset hidden
      </button>
    </div>
  );
}

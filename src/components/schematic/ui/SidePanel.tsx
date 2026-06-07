import type { ViewerState } from '@/components/schematic/lib/types';
import { TYPE_FILTER_ORDER } from '@/components/schematic/lib/scene/constants';
import { DetailToggles, type DetailKey } from './DetailToggles';
import { Legend } from './Legend';

interface Props {
  state: ViewerState;
  onToggleDetail: (key: DetailKey) => void;
  categoryEnabled: Record<string, boolean>;
  onToggleCategory: (type: string) => void;
  onResetHidden: () => void;
}

/** Filters column sitting to the right of the floor list: Show / Hide detail
 *  toggles, Show Types (floor-type categories), the reset, and the legend. */
export function SidePanel({
  state,
  onToggleDetail,
  categoryEnabled,
  onToggleCategory,
  onResetHidden,
}: Props) {
  return (
    <div id="side-panel">
      <DetailToggles state={state} onToggle={onToggleDetail} />

      <div id="type-panel">
        <h3>Show Types</h3>
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

      <Legend />
    </div>
  );
}

import type { ViewerState } from '@/components/schematic/lib/types';

export type DetailKey =
  | 'partitionsEnabled'
  | 'outerWallsEnabled'
  | 'stairsEnabled'
  | 'liftsEnabled'
  | 'entrancesEnabled'
  | 'labelsEnabled';

interface Props {
  state: ViewerState;
  onToggle: (key: DetailKey) => void;
}

const ROWS: { txt: string; key: DetailKey }[] = [
  { txt: 'inner walls', key: 'partitionsEnabled' },
  { txt: 'outer walls', key: 'outerWallsEnabled' },
  { txt: 'stairs', key: 'stairsEnabled' },
  { txt: 'lift shafts', key: 'liftsEnabled' },
  { txt: 'entrances', key: 'entrancesEnabled' },
  { txt: 'labels', key: 'labelsEnabled' },
];

export function DetailToggles({ state, onToggle }: Props) {
  return (
    <div id="toggles">
      <h3>Show / Hide</h3>
      <div id="detail-filters">
        {ROWS.map((r) => (
          <label key={r.key} className="chk">
            <input
              type="checkbox"
              checked={state[r.key]}
              onChange={() => onToggle(r.key)}
            />{' '}
            {r.txt}
          </label>
        ))}
      </div>
    </div>
  );
}

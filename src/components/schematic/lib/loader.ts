// Typed data loader. Mirrors the Promise.all in index.html:
//   graph.json is required (throws on failure → caller shows error UI)
//   walls.json / building.json are optional (null → graceful fallbacks)
import type { Building, Graph, LoadedData, WallsFile } from '@/components/schematic/lib/types';

type Fetcher = typeof fetch;

export async function loadData(
  base = '',
  fetcher: Fetcher = fetch
): Promise<LoadedData> {
  const [graph, walls, building] = await Promise.all([
    fetcher(`${base}/graph.json`).then((r) => {
      if (!r.ok) throw new Error(`graph.json: HTTP ${r.status}`);
      return r.json() as Promise<Graph>;
    }),
    fetcher(`${base}/walls.json`)
      .then((r) => (r.ok ? (r.json() as Promise<WallsFile>) : null))
      .catch(() => null),
    fetcher(`${base}/building.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Building>) : null))
      .catch(() => null),
  ]);
  return { graph, walls, building };
}

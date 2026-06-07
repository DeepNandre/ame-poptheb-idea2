import "./arbor.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  Suspense,
} from 'react';
import { Canvas } from '@react-three/fiber';
import type { LoadedData, UnitMeta, ViewerState } from '@/components/schematic/lib/types';
import { DEFAULT_VIEWER_STATE } from '@/components/schematic/lib/scene/constants';
import { loadData } from '@/components/schematic/lib/loader';
import { hideReducer, initialHideState } from '@/components/schematic/lib/interaction';
import { Scene } from './scene/Scene';
import { Header } from './ui/Header';
import { HoverReadout } from './ui/HoverReadout';
import { Controls } from './ui/Controls';
import { DetailToggles, type DetailKey } from './ui/DetailToggles';
import { Legend } from './ui/Legend';
import { StackHud } from './ui/StackHud';

export default function ArborViewer() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ViewerState>(DEFAULT_VIEWER_STATE);
  const [hide, dispatch] = useReducer(hideReducer, initialHideState);
  const [hovered, setHovered] = useState<UnitMeta | null>(null);

  // Drag-vs-click guard: a click that moved > 5px is an orbit drag, not a hide.
  const downXY = useRef<[number, number] | null>(null);
  const wasDrag = useRef(false);


  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    loadData('/schematic')
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  // ── Keyboard: B undo · N redo · R reset ──────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'b') dispatch({ type: 'undo' });
      else if (k === 'n') dispatch({ type: 'redo' });
      else if (k === 'r') dispatch({ type: 'reset' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Stable handlers (so memoised Scene doesn't re-render on hover) ────────────
  const onHover = useCallback((m: UnitMeta | null) => setHovered(m), []);
  const onHide = useCallback((id: string) => {
    if (wasDrag.current) return; // suppress hide on an orbit drag
    dispatch({ type: 'hide', id });
  }, []);

  const onFloor = useCallback(
    (level: string) => setState((s) => ({ ...s, activeFloor: level })),
    []
  );
  const onToggleCategory = useCallback(
    (t: string) =>
      setState((s) => ({
        ...s,
        categoryEnabled: {
          ...s.categoryEnabled,
          [t]: !(s.categoryEnabled[t] ?? true),
        },
      })),
    []
  );
  const onToggleDetail = useCallback(
    (key: DetailKey) => setState((s) => ({ ...s, [key]: !s[key] })),
    []
  );
  const onResetHidden = useCallback(() => dispatch({ type: 'reset' }), []);

  // ── Header stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (error) return 'Error loading graph.json — check that the JSON is in /public';
    if (!data) return 'Loading...';
    const rooms = data.graph.nodes.filter((n) => n.type !== 'core').length;
    const floors = data.graph.floors.length;
    const entrances = (data.building?.nodes ?? []).filter(
      (n) => n.kind === 'portal' && n.is_external
    ).length;
    return `${rooms} rooms · ${floors} floors${entrances ? ` · ${entrances} entrances` : ''}`;
  }, [data, error]);

  return (
    <>
      <div
        id="canvas-container"
        onPointerDown={(e) => {
          downXY.current = [e.clientX, e.clientY];
          wasDrag.current = false;
        }}
        onPointerUp={(e) => {
          if (!downXY.current) return;
          const moved = Math.hypot(
            e.clientX - downXY.current[0],
            e.clientY - downXY.current[1]
          );
          wasDrag.current = moved > 5;
          downXY.current = null;
        }}
      >
        {data && (
          <Canvas
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            dpr={[1, 1.5]}
            camera={{ position: [40, 44, 56], fov: 50, near: 0.1, far: 2000 }}
          >
            {/* Inner Suspense keeps 3D-resource loads (e.g. troika text fonts)
                contained — without it they bubble to the overlay and blank the
                whole viewer. */}
            <Suspense fallback={null}>
              <Scene
                data={data}
                state={state}
                hidden={hide.hidden}
                onHover={onHover}
                onHide={onHide}
              />
            </Suspense>
          </Canvas>
        )}
      </div>

      <div id="ui">
        <Header stats={stats} />
        <HoverReadout hovered={hovered} />

        {data && (
          <Controls
            floors={data.graph.floors}
            activeFloor={state.activeFloor}
            onFloor={onFloor}
            categoryEnabled={state.categoryEnabled}
            onToggleCategory={onToggleCategory}
            onResetHidden={onResetHidden}
          />
        )}

        <div id="bottom-left">
          <DetailToggles state={state} onToggle={onToggleDetail} />
          <Legend />
        </div>

        <StackHud hiddenCount={hide.hidden.size} />
      </div>
    </>
  );
}

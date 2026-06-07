import { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphNode } from '@/components/schematic/lib/types';
import { SCALE_XY, SCALE_Z } from '@/components/schematic/lib/scene/constants';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import type { GraphProps } from '@/components/schematic/contracts';

// ── Stair-placement diagnostic ────────────────────────────────────────────────
// Drops a flat ORANGE patch on the floor plate at every stair node's plan (x, y),
// per floor. A genuine stair core keeps the SAME plan footprint on every storey,
// so when these patches are viewed top-down they should stack into a single
// vertical column. When a stair is recognised in the wrong area on some floors,
// its orange patch jumps sideways between floors instead of stacking — making the
// "plans say here, recognised there" mismatch immediately visible.
//
// Honours the stairs toggle + active-floor filter (NOT isCore), so stepping floor
// by floor shows the orange patch hop around exactly where the data drifts.

const ORANGE = 0xff8c00;
const PATCH = 1.6; // world-unit square — stair `w`/`h` are ~0.04, far too small to see
const LIFT_Y = 0.04; // sit just above the plate to avoid z-fighting

function isStair(n: GraphNode): boolean {
  return (`${n.label ?? ''} ${n.type ?? ''}`).toLowerCase().includes('stair');
}

export function StairFootprints({ graph, state, hidden, onHover, onHide }: GraphProps) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ORANGE,
        emissive: ORANGE,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const stairNodes = useMemo(() => graph.nodes.filter(isStair), [graph.nodes]);

  // Surface the drift in the console too — one line per stair core, listing every
  // distinct plan position it was recognised at. >1 position == the bug.
  useMemo(() => {
    const byCore: Record<string, Set<string>> = {};
    for (const n of stairNodes) {
      const core = n.id.split('-L')[0];
      (byCore[core] ||= new Set()).add(`${n.x.toFixed(3)},${n.y.toFixed(3)}`);
    }
    for (const [core, positions] of Object.entries(byCore)) {
      if (positions.size > 1) {
        // eslint-disable-next-line no-console
        console.warn(
          `[stair-diagnostic] ${core} recognised in ${positions.size} different plan areas across floors:`,
          [...positions],
        );
      }
    }
  }, [stairNodes]);

  // Gate the whole layer on the stairs toggle so it travels with the stairs.
  if (!state.stairsEnabled) return null;

  return (
    <>
      {stairNodes.map((n) => {
        const x = n.x * SCALE_XY;
        const z = n.y * SCALE_XY;
        const y = n.z * SCALE_Z + LIFT_Y;
        const lvl = String(n.floor);
        return (
          <SceneMesh
            key={`stairfoot-${n.id}`}
            meta={{
              id: `stairfoot-${n.id}`,
              kind: 'stair',
              floorLevel: lvl,
              label: `Stair footprint (recognised) — ${n.id} @ floor ${lvl}`,
            }}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
            pickable
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} material={material}>
              <planeGeometry args={[PATCH, PATCH]} />
            </mesh>
          </SceneMesh>
        );
      })}
    </>
  );
}

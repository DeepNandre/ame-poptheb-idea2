import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import type { GraphProps } from '@/components/schematic/contracts';
import type { UnitMeta, WallsFile, WallSeg, WallsFloorObj } from '@/components/schematic/lib/types';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import { outerRing } from '@/components/schematic/lib/scene/geometry';
import {
  FLOOR_W,
  PLATE_H,
  SCALE_Z,
  FLOOR_FILL_COLOR,
  GREEN_COLOR,
  GROUND_SIZE,
} from '@/components/schematic/lib/scene/constants';

// Build the shared box geometry once at module level so it is never recreated.
const plateBoxGeom = new THREE.BoxGeometry(FLOOR_W, PLATE_H, FLOOR_W);

// A filled THREE.Shape laid flat. Built in the shape's local XY plane from world
// (X, Z) points; the mesh is rotated +90° about X so shapeX→worldX, shapeY→worldZ,
// keeping the slab perfectly aligned with the walls drawn from the same segments.
const ringShape = (ring: [number, number][]): THREE.Shape | null => {
  if (ring.length < 3) return null;
  return new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, z)));
};

const outerSegsOf = (fl: WallsFile['floors'][string]): WallSeg[] =>
  Array.isArray(fl) ? [] : ((fl as WallsFloorObj).outer ?? []);

interface Props extends GraphProps {
  walls: WallsFile | null;
}

export function FloorPlates({
  graph,
  walls,
  state,
  hidden,
  onHover,
  onHide,
}: Props) {
  // Per floor: the filled outline shape (from outer walls) + base height + meta.
  const floors = useMemo(() => {
    return graph.floors.map((fl) => {
      const lvl = String(fl.level);
      const baseY = fl.z * SCALE_Z;
      const wf = walls?.floors[lvl];
      const ring = wf ? outerRing(outerSegsOf(wf)) : [];
      const shape = ringShape(ring);
      const meta: UnitMeta = {
        id: `plate-${fl.level}`,
        kind: 'plate',
        floorLevel: lvl,
        label: fl.label,
      };
      return { lvl, baseY, shape, meta, label: fl.label, z: fl.z };
    });
  }, [graph.floors, walls]);

  // Lowest floor → green site ground. No predetermined roof cap: green is
  // reserved for genuine outside areas (terraces), drawn as external rooms.
  const minBaseY = useMemo(() => {
    let min = floors[0]?.baseY ?? 0;
    for (const f of floors) if (f.baseY < min) min = f.baseY;
    return min;
  }, [floors]);

  return (
    <>
      {floors.map((f) => (
        <group key={f.lvl}>
          {f.shape ? (
            // Real wall-bounded floor: fill the outer outline.
            <SceneMesh
              meta={f.meta}
              state={state}
              hidden={hidden}
              onHover={onHover}
              onHide={onHide}
              pickable
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, f.baseY, 0]}>
                <shapeGeometry args={[f.shape]} />
                <meshStandardMaterial
                  color={FLOOR_FILL_COLOR}
                  side={THREE.DoubleSide}
                  roughness={0.95}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            </SceneMesh>
          ) : (
            // Fallback (no walls.json): the old faint reference plate.
            <SceneMesh
              meta={f.meta}
              state={state}
              hidden={hidden}
              onHover={onHover}
              onHide={onHide}
              pickable
            >
              <mesh position={[FLOOR_W / 2, f.baseY - PLATE_H, FLOOR_W / 2]}>
                <boxGeometry args={[FLOOR_W, PLATE_H, FLOOR_W]} />
                <meshStandardMaterial
                  color={0x1a1a2e}
                  transparent
                  opacity={0.06}
                  roughness={0.9}
                />
              </mesh>
              <lineSegments
                position={[FLOOR_W / 2, f.baseY - PLATE_H, FLOOR_W / 2]}
              >
                <edgesGeometry args={[plateBoxGeom]} />
                <lineBasicMaterial color={0x33334d} transparent opacity={0.35} />
              </lineSegments>
            </SceneMesh>
          )}

          {/* Floor label — always visible, not floor-filtered */}
          <Text
            position={[-1.5, f.baseY, FLOOR_W + 0.5]}
            fontSize={0.55}
            color="#666677"
            anchorX="left"
            anchorY="middle"
            renderOrder={1}
            depthOffset={-1}
          >
            {f.label}
          </Text>
        </group>
      ))}

      {/* Green site ground around the building, just below the lowest floor. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[FLOOR_W / 2, minBaseY - 0.05, FLOOR_W / 2]}
        receiveShadow
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={GREEN_COLOR} roughness={1} />
      </mesh>
    </>
  );
}

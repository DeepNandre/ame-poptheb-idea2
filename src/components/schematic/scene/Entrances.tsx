import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingNode } from '@/components/schematic/lib/types';
import { SCALE_Z, ENTRANCE_COLOR } from '@/components/schematic/lib/scene/constants';
import { worldXZ } from '@/components/schematic/lib/scene/geometry';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import type { BuildingProps } from '@/components/schematic/contracts';

const BEAM_H = 5.0;

interface EntranceRef {
  mat: THREE.MeshStandardMaterial;
  cone: THREE.Mesh;
  baseConeY: number;
}

export function Entrances({
  building,
  state,
  hidden,
  onHover,
  onHide,
}: BuildingProps) {
  const portals = useMemo(
    () =>
      (building.nodes ?? []).filter(
        (n: BuildingNode) => n.kind === 'portal' && n.is_external,
      ),
    [building.nodes],
  );

  // Stable per-entrance data (geometry + material) built once.
  const entranceData = useMemo(
    () =>
      portals.map((node: BuildingNode) => {
        const [cx, cz] = worldXZ(node);
        const baseY = (node.z || 0) * SCALE_Z;
        const baseConeY = baseY + BEAM_H;

        const mat = new THREE.MeshStandardMaterial({
          color: ENTRANCE_COLOR,
          emissive: ENTRANCE_COLOR,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
          roughness: 0.3,
        });

        const beamMat = new THREE.MeshBasicMaterial({
          color: ENTRANCE_COLOR,
          transparent: true,
          opacity: 0.25,
        });

        return { node, cx, cz, baseY, baseConeY, mat, beamMat };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portals],
  );

  // One ref slot per entrance, populated during render via callback refs.
  const refsRef = useRef<(EntranceRef | null)[]>([]);

  // Keep the array length in sync with entranceData.
  if (refsRef.current.length !== entranceData.length) {
    refsRef.current = new Array(entranceData.length).fill(null);
  }

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3; // mirror: performance.now() * 0.003 * 1000/1000 * 3
    const p = 0.5 + 0.5 * Math.sin(t);
    for (const ref of refsRef.current) {
      if (!ref) continue;
      ref.mat.emissiveIntensity = 0.5 + 0.9 * p;
      ref.cone.position.y = ref.baseConeY + 0.4 * Math.sin(t);
    }
  });

  if (entranceData.length === 0) return null;

  return (
    <>
      {entranceData.map(
        ({ node, cx, cz, baseY, baseConeY, mat, beamMat }, i) => (
          <SceneMesh
            key={node.id}
            meta={{
              id: node.id,
              kind: 'entrance',
              isEntrance: true,
              floorLevel: String(node.floor),
              label: node.via ?? 'Entrance',
            }}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
            pickable
          >
            {/* Floor ring marking the threshold */}
            <mesh
              position={[cx, baseY + 0.1, cz]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[0.7, 0.09, 10, 28]} />
              <primitive object={mat} attach="material" />
            </mesh>

            {/* Downward cone hovering above, pointing at the opening */}
            <mesh
              ref={(mesh) => {
                if (mesh) {
                  refsRef.current[i] = {
                    mat,
                    cone: mesh,
                    baseConeY,
                  };
                }
              }}
              position={[cx, baseConeY, cz]}
              rotation={[Math.PI, 0, 0]}
            >
              <coneGeometry args={[0.55, 1.1, 16]} />
              <primitive object={mat} attach="material" />
            </mesh>

            {/* Vertical beam tying ring to cone — decorative, not pickable */}
            <mesh position={[cx, baseY + BEAM_H / 2, cz]}>
              <cylinderGeometry args={[0.06, 0.06, BEAM_H, 8]} />
              <primitive object={beamMat} attach="material" />
            </mesh>
          </SceneMesh>
        ),
      )}
    </>
  );
}

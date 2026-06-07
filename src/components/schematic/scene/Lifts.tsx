import { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphProps } from '@/components/schematic/contracts';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import { LIFT_COLOR } from '@/components/schematic/lib/scene/constants';
import { liftBuckets, liftColumn } from '@/components/schematic/lib/scene/geometry';

export function Lifts({ graph, state, hidden, onHover, onHide }: GraphProps) {
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: LIFT_COLOR,
        emissive: new THREE.Color(LIFT_COLOR),
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.16,
        roughness: 0.2,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const postMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: LIFT_COLOR,
        emissive: new THREE.Color(LIFT_COLOR),
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
    [],
  );

  const buckets = useMemo(() => liftBuckets(graph.nodes), [graph.nodes]);

  return (
    <>
      {buckets.map((bucket) => {
        const col = liftColumn(bucket.cx, bucket.cz, bucket.y0, bucket.y1);
        if (!col) return null;

        return (
          <SceneMesh
            key={bucket.key}
            meta={{
              id: `lift-${bucket.key}`,
              kind: 'lift',
              isCore: true,
              floorLevel: '',
              label: 'Lift shaft',
            }}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
            pickable={false}
          >
            {col.walls.map((w, i) => (
              <mesh
                key={`w${i}`}
                position={[w.x, w.y, w.z]}
                material={wallMat}
              >
                <boxGeometry args={[w.w, w.h, w.d]} />
              </mesh>
            ))}
            {col.posts.map((p, i) => (
              <mesh
                key={`p${i}`}
                position={[p.x, p.y, p.z]}
                material={postMat}
              >
                <boxGeometry args={[p.w, p.h, p.d]} />
              </mesh>
            ))}
          </SceneMesh>
        );
      })}
    </>
  );
}

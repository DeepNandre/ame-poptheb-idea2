import { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphNode } from '@/components/schematic/lib/types';
import type { GraphProps } from '@/components/schematic/contracts';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import {
  PARTITION_H,
  WALL_T,
  DOOR_H,
  PARTITION_COLOR,
  DOOR_COLOR,
} from '@/components/schematic/lib/scene/constants';
import { partitionPlacement, doorGap } from '@/components/schematic/lib/scene/geometry';

export function Partitions({ graph, state, hidden, onHover, onHide }: GraphProps) {
  const partitionMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARTITION_COLOR,
        emissive: new THREE.Color(PARTITION_COLOR),
        emissiveIntensity: 0.06,
        transparent: true,
        opacity: 0.5,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const doorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: DOOR_COLOR,
        emissive: new THREE.Color(DOOR_COLOR),
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.75,
        roughness: 0.4,
      }),
    [],
  );

  // Build id → node lookup once per graph change.
  const nodeById = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of graph.nodes) map.set(node.id, node);
    return map;
  }, [graph.nodes]);

  const intraEdges = useMemo(
    () =>
      graph.edges.filter((e) => {
        if (e.type !== 'intra') return false;
        const a = nodeById.get(e.source);
        const b = nodeById.get(e.target);
        return a != null && b != null && String(a.floor) === String(b.floor);
      }),
    [graph.edges, nodeById],
  );

  return (
    <>
      {intraEdges.map((edge, index) => {
        const a = nodeById.get(edge.source)!;
        const b = nodeById.get(edge.target)!;

        const p = partitionPlacement(a, b);
        const wallY = p.baseY + PARTITION_H / 2;
        const g = doorGap(p.len);

        const meta = {
          id: `part-${index}`,
          kind: 'partition' as const,
          isPartition: true,
          floorLevel: String(a.floor),
          label: `Partition · ${a.label} ↔ ${b.label}`,
        };

        return (
          <SceneMesh
            key={`part-${index}`}
            meta={meta}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
            pickable
          >
            {p.orientation === 'x' ? (
              <>
                {/* Wall segments running along X */}
                {g.segments.map((seg, si) => (
                  <mesh
                    key={`seg-${si}`}
                    position={[p.xc + seg.offset, wallY, p.zc]}
                    material={partitionMat}
                  >
                    <boxGeometry args={[seg.len, PARTITION_H, WALL_T]} />
                  </mesh>
                ))}
                {/* Door fill (only when gap exists) */}
                {g.door != null && (
                  <mesh
                    position={[p.xc, p.baseY + DOOR_H / 2, p.zc]}
                    material={doorMat}
                  >
                    <boxGeometry args={[g.door.width, DOOR_H, WALL_T * 0.6]} />
                  </mesh>
                )}
              </>
            ) : (
              <>
                {/* Wall segments running along Z */}
                {g.segments.map((seg, si) => (
                  <mesh
                    key={`seg-${si}`}
                    position={[p.xc, wallY, p.zc + seg.offset]}
                    material={partitionMat}
                  >
                    <boxGeometry args={[WALL_T, PARTITION_H, seg.len]} />
                  </mesh>
                ))}
                {/* Door fill (only when gap exists) */}
                {g.door != null && (
                  <mesh
                    position={[p.xc, p.baseY + DOOR_H / 2, p.zc]}
                    material={doorMat}
                  >
                    <boxGeometry args={[WALL_T * 0.6, DOOR_H, g.door.width]} />
                  </mesh>
                )}
              </>
            )}
          </SceneMesh>
        );
      })}
    </>
  );
}

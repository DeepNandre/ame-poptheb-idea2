import { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphNode } from '@/components/schematic/lib/types';
import { SCALE_XY, SCALE_Z, STAIR_COLOR } from '@/components/schematic/lib/scene/constants';
import { stairSteps } from '@/components/schematic/lib/scene/geometry';
import type { Vec3 } from '@/components/schematic/lib/scene/geometry';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import type { GraphProps } from '@/components/schematic/contracts';

export function Stairs({ graph, state, hidden, onHover, onHide }: GraphProps) {
  const nodeMap = useMemo(() => {
    const m: Record<string, GraphNode> = {};
    for (const n of graph.nodes) m[n.id] = n;
    return m;
  }, [graph.nodes]);

  const stairMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: STAIR_COLOR,
        emissive: STAIR_COLOR,
        emissiveIntensity: 0.3,
        roughness: 0.5,
      }),
    [],
  );

  const interEdges = useMemo(
    () => graph.edges.filter((e) => e.type === 'inter'),
    [graph.edges],
  );

  return (
    <>
      {interEdges.map((edge, index) => {
        const a = nodeMap[edge.source];
        const b = nodeMap[edge.target];
        if (!a || !b) return null;

        const pa: Vec3 = { x: a.x * SCALE_XY, y: a.z * SCALE_Z, z: a.y * SCALE_XY };
        const pb: Vec3 = { x: b.x * SCALE_XY, y: b.z * SCALE_Z, z: b.y * SCALE_XY };
        const kind = (a.label || b.label || '').toLowerCase();

        if (kind.includes('stair')) {
          const boxes = stairSteps(pa, pb);
          return (
            <SceneMesh
              key={`stair-${index}`}
              meta={{ id: `stair-${index}`, kind: 'stair', isCore: true, floorLevel: '', label: 'Stair run' }}
              state={state}
              hidden={hidden}
              onHover={onHover}
              onHide={onHide}
              pickable={true}
            >
              {boxes.map((box, bi) => (
                <mesh
                  key={bi}
                  position={[box.x, box.y, box.z]}
                  material={stairMaterial}
                >
                  <boxGeometry args={[box.w, box.h, box.d]} />
                </mesh>
              ))}
            </SceneMesh>
          );
        }

        if (kind.includes('lift')) {
          return null;
        }

        // Generic vertical link — rare, correctness over elegance
        return (
          <GenericLink
            key={`link-${index}`}
            index={index}
            pa={pa}
            pb={pb}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
          />
        );
      })}
    </>
  );
}

// Extracted to avoid calling hooks inside a map callback
interface GenericLinkProps {
  index: number;
  pa: Vec3;
  pb: Vec3;
  state: GraphProps['state'];
  hidden: GraphProps['hidden'];
  onHover: GraphProps['onHover'];
  onHide: GraphProps['onHide'];
}

function GenericLink({ index, pa, pb, state, hidden, onHover, onHide }: GenericLinkProps) {
  const lineObject = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pa.x, pa.y, pa.z),
      new THREE.Vector3(pb.x, pb.y, pb.z),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: 0xe8a020,
      transparent: true,
      opacity: 0.3,
    });
    return new THREE.Line(geometry, material);
  }, [pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]);

  return (
    <SceneMesh
      meta={{ id: `link-${index}`, kind: 'link', isCore: true, floorLevel: '', label: 'Vertical link' }}
      state={state}
      hidden={hidden}
      onHover={onHover}
      onHide={onHide}
      pickable={false}
    >
      <primitive object={lineObject} />
    </SceneMesh>
  );
}

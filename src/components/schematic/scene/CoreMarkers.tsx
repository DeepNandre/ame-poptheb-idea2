import { useMemo } from 'react';
import type { GraphNode } from '@/components/schematic/lib/types';
import { SCALE_Z, PARTITION_H, TYPE_COLORS } from '@/components/schematic/lib/scene/constants';
import { worldXZ } from '@/components/schematic/lib/scene/geometry';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import type { GraphProps } from '@/components/schematic/contracts';

export function CoreMarkers({
  graph,
  state,
  hidden,
  onHover,
  onHide,
}: GraphProps) {
  const coreNodes = useMemo(
    () => graph.nodes.filter((n: GraphNode) => n.type === 'core'),
    [graph.nodes],
  );

  return (
    <>
      {coreNodes.map((node: GraphNode) => {
        const [cx, cz] = worldXZ(node);
        const baseY = node.z * SCALE_Z;

        return (
          <SceneMesh
            key={node.id}
            meta={{
              id: node.id,
              kind: 'core',
              type: 'core',
              floorLevel: String(node.floor),
              label: node.label,
            }}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
          >
            <mesh position={[cx, baseY + PARTITION_H * 0.425, cz]}>
              <boxGeometry args={[0.7, PARTITION_H * 0.85, 0.7]} />
              <meshStandardMaterial
                color={TYPE_COLORS.core}
                emissive={TYPE_COLORS.core}
                emissiveIntensity={0.18}
                transparent
                opacity={0.6}
                roughness={0.55}
              />
            </mesh>
          </SceneMesh>
        );
      })}
    </>
  );
}

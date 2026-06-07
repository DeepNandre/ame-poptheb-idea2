// Room label sprites — one <Text> per non-core node, visibility + floor-filter
// delegated entirely to <SceneMesh>. Not pickable. Labels off by default
// (labelsEnabled: false in DEFAULT_VIEWER_STATE; isVisible handles it).
import type { UnitMeta } from '@/components/schematic/lib/types';
import { SCALE_Z } from '@/components/schematic/lib/scene/constants';
import { worldXZ } from '@/components/schematic/lib/scene/geometry';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import type { GraphProps } from '@/components/schematic/contracts';
import { Text } from '@react-three/drei';

export function Labels(props: GraphProps) {
  const { graph, state, hidden, onHover, onHide } = props;

  return (
    <>
      {graph.nodes
        .filter((node) => node.type !== 'core')
        .map((node) => {
          const [cx, cz] = worldXZ(node);
          const baseY = node.z * SCALE_Z;

          const meta: UnitMeta = {
            id: `label-${node.id}`,
            kind: 'label',
            isLabel: true,
            floorLevel: String(node.floor),
            label: node.label,
          };

          return (
            <SceneMesh
              key={meta.id}
              meta={meta}
              state={state}
              hidden={hidden}
              onHover={onHover}
              onHide={onHide}
              pickable={false}
            >
              <Text
                position={[cx, baseY + 1.1, cz]}
                color="#cdd6e6"
                fontSize={0.6}
                anchorX="center"
                anchorY="middle"
              >
                {node.label}
              </Text>
            </SceneMesh>
          );
        })}
    </>
  );
}

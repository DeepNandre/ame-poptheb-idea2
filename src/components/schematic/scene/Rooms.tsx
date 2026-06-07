import { useMemo } from 'react';
import * as THREE from 'three';
import type { GraphProps } from '@/components/schematic/contracts';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import { SCALE_XY, SCALE_Z, SLAB_H, MIN_FOOT, colorForType } from '@/components/schematic/lib/scene/constants';
import { worldXZ } from '@/components/schematic/lib/scene/geometry';

export function Rooms({ graph, state, hidden, onHover, onHide }: GraphProps) {
  // Build a per-type material map once; re-runs only if the node list changes
  // in a way that introduces a new type (stable in practice).
  const matByType = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>();
    for (const node of graph.nodes) {
      if (node.type === 'core') continue;
      if (map.has(node.type)) continue;
      const color = colorForType(node.type);
      map.set(
        node.type,
        new THREE.MeshStandardMaterial({
          color,
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.18,
          transparent: true,
          opacity: 0.42,
          roughness: 0.5,
          metalness: 0.05,
        }),
      );
    }
    return map;
  }, [graph.nodes]);

  return (
    <>
      {graph.nodes
        .filter((node) => node.type !== 'core')
        .map((node) => {
          const [cx, cz] = worldXZ(node);
          const baseY = node.z * SCALE_Z;
          const wWorld = Math.max((node.w ?? 0) * SCALE_XY, MIN_FOOT);
          const dWorld = Math.max((node.h ?? 0) * SCALE_XY, MIN_FOOT);
          const posY = baseY + SLAB_H / 2;

          const color = colorForType(node.type);
          const material = matByType.get(node.type)!;
          const boxGeo = new THREE.BoxGeometry(wWorld, SLAB_H, dWorld);
          const edgesGeo = new THREE.EdgesGeometry(boxGeo);

          return (
            <SceneMesh
              key={node.id}
              meta={{
                id: node.id,
                kind: 'floor',
                type: node.type,
                floorLevel: String(node.floor),
                label: node.label,
              }}
              state={state}
              hidden={hidden}
              onHover={onHover}
              onHide={onHide}
              pickable
            >
              {/* Slab */}
              <mesh
                position={[cx, posY, cz]}
                geometry={boxGeo}
                material={material}
              />
              {/* Edge outline */}
              <lineSegments position={[cx, posY, cz]} geometry={edgesGeo}>
                <lineBasicMaterial
                  color={color}
                  transparent
                  opacity={0.6}
                />
              </lineSegments>
            </SceneMesh>
          );
        })}
    </>
  );
}

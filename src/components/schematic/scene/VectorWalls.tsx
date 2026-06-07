import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { WallSeg, WallsFloorObj, UnitMeta } from '@/components/schematic/lib/types';
import { SCALE_Z, WALL_T, PARTITION_COLOR, OUTER_WALL_COLOR } from '@/components/schematic/lib/scene/constants';
import { wallSegTransform, type WallTransform } from '@/components/schematic/lib/scene/geometry';
import { SceneMesh } from '@/components/schematic/SceneMesh';
import type { WallsProps } from '@/components/schematic/contracts';

// PERF: all wall segments on a floor are drawn as ONE InstancedMesh (one draw call),
// not one mesh per segment and not a giant merged BufferGeometry. A unit box is scaled
// per instance via its matrix — cheap to build (pure matrix math), tiny memory, nothing
// to dispose. This replaces the ~13.6k individual wall meshes.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

interface InstancesProps {
  transforms: WallTransform[];
  material: THREE.Material;
  meta: UnitMeta;
  state: WallsProps['state'];
  hidden: WallsProps['hidden'];
  onHover: WallsProps['onHover'];
  onHide: WallsProps['onHide'];
}

function WallInstances({ transforms, material, meta, ...h }: InstancesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    transforms.forEach((t, i) => {
      o.position.set(t.x, t.y, t.z);
      o.rotation.set(0, t.rotY, 0);
      o.scale.set(t.len, t.height, t.thickness);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.count = transforms.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [transforms]);

  if (transforms.length === 0) return null;

  return (
    <SceneMesh meta={meta} {...h} pickable={false}>
      <instancedMesh
        ref={ref}
        args={[UNIT_BOX, material, transforms.length]}
        frustumCulled={false}
      />
    </SceneMesh>
  );
}

export function VectorWalls({ graph, walls, state, hidden, onHover, onHide }: WallsProps) {
  const innerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PARTITION_COLOR,
        transparent: true,
        opacity: 0.5,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const outerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: OUTER_WALL_COLOR,
        transparent: true,
        opacity: 0.32,
        roughness: 0.9,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Cheap: per floor, turn each segment into a transform (arithmetic only, no GL objects).
  const floors = useMemo(() => {
    const zByLevel: Record<string, number> = {};
    for (const fl of graph.floors) zByLevel[String(fl.level)] = fl.z * SCALE_Z;

    return Object.entries(walls.floors)
      .map(([lvl, fl]) => {
        const baseY = zByLevel[lvl];
        if (baseY === undefined) return null;
        const innerSegs: WallSeg[] = Array.isArray(fl)
          ? (fl as WallSeg[])
          : ((fl as WallsFloorObj).inner ?? []);
        const outerSegs: WallSeg[] = Array.isArray(fl)
          ? []
          : ((fl as WallsFloorObj).outer ?? []);
        const inner = innerSegs
          .map((s) => wallSegTransform(s, baseY, WALL_T))
          .filter((t): t is WallTransform => t !== null);
        const outer = outerSegs
          .map((s) => wallSegTransform(s, baseY, WALL_T * 1.5))
          .filter((t): t is WallTransform => t !== null);
        return { lvl, inner, outer };
      })
      .filter((f): f is { lvl: string; inner: WallTransform[]; outer: WallTransform[] } => f !== null);
  }, [graph.floors, walls.floors]);

  return (
    <>
      {floors.map((f) => (
        <group key={f.lvl}>
          <WallInstances
            transforms={f.inner}
            material={innerMat}
            meta={{ id: `vwall-in-${f.lvl}`, kind: 'wall', isPartition: true, floorLevel: f.lvl, label: `Inner walls · L${f.lvl}` }}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
          />
          <WallInstances
            transforms={f.outer}
            material={outerMat}
            meta={{ id: `vwall-out-${f.lvl}`, kind: 'outerwall', isOuterWall: true, floorLevel: f.lvl, label: `Outer walls · L${f.lvl}` }}
            state={state}
            hidden={hidden}
            onHover={onHover}
            onHide={onHide}
          />
        </group>
      ))}
    </>
  );
}

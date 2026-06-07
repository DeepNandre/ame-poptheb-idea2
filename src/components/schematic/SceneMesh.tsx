// Wraps a scene unit: drives visibility (pure isVisible) + hover/click interaction.
// Leaf components render their geometry as children; SceneMesh handles the rest.
import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { UnitMeta, ViewerState } from '@/components/schematic/lib/types';
import { isVisible } from '@/components/schematic/lib/scene/visibility';

interface Props {
  meta: UnitMeta;
  state: ViewerState;
  hidden: ReadonlySet<string>;
  onHover: (meta: UnitMeta | null) => void;
  onHide: (id: string) => void;
  /** Non-pickable units (labels, plates, beams) pass false. */
  pickable?: boolean;
  children: ReactNode;
}

export function SceneMesh({
  meta,
  state,
  hidden,
  onHover,
  onHide,
  pickable = true,
  children,
}: Props) {
  const visible = isVisible(meta, state, hidden);

  if (!pickable) {
    return <group visible={visible}>{children}</group>;
  }

  return (
    <group
      visible={visible}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!visible) return;
        e.stopPropagation();
        onHover(meta);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!visible) return;
        e.stopPropagation();
        onHide(meta.id);
      }}
    >
      {children}
    </group>
  );
}

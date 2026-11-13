import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';

interface Props {
  radius: number;
  color?: string;
  opacity?: number;
  segments?: number;
}

/** A faint circular orbit line in the XZ plane, centred on its parent group. */
export function OrbitRing({ radius, color = '#ffffff', opacity = 0.18, segments = 128 }: Props) {
  const geometry = useMemo(() => {
    const pts = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts[i * 3] = Math.cos(a) * radius;
      pts[i * 3 + 2] = Math.sin(a) * radius;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pts, 3));
    return g;
  }, [radius, segments]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </lineLoop>
  );
}

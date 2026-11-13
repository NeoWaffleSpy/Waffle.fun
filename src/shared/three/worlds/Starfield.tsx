import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color } from 'three';
import { mulberry32 } from '../../random';

interface Props {
  seed: number;
  count?: number;
  /** Stars are placed in a shell between radius and radius·2. */
  radius?: number;
  size?: number;
}

/** Seeded star field: thousands of points generated on the CPU in ~1 ms, zero downloads. */
export function Starfield({ seed, count = 3000, radius = 40, size = 0.16 }: Props) {
  const geometry = useMemo(() => {
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tint = new Color();
    for (let i = 0; i < count; i++) {
      // Uniform direction on a sphere, random radius in the shell.
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r = radius * (1 + rand());
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3);
      tint.setHSL(0.55 + rand() * 0.15 - (rand() < 0.2 ? 0.5 : 0), 0.5, 0.6 + rand() * 0.4);
      col.set([tint.r, tint.g, tint.b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  }, [seed, count, radius]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={size} vertexColors sizeAttenuation depthWrite={false} />
    </points>
  );
}

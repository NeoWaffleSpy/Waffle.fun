import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial } from 'three';

const glowVertex = /* glsl */ `
varying vec3 vNormalV;
void main() {
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glowFragment = /* glsl */ `
uniform vec3 uColor;
varying vec3 vNormalV;
void main() {
  // Back faces of a big sphere: brightest toward the centre, 0 at the rim.
  float g = pow(clamp(-vNormalV.z, 0.0, 1.0), 6.0);
  gl_FragColor = vec4(uColor * g * 1.4, 1.0);
}
`;

/** A star of radius 1 (scale with a parent group): bright core + soft additive glow. */
export function StarBody({ color }: { color: string }) {
  const glow = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new Color(color) } },
      }),
    [color],
  );
  useEffect(
    () => () => {
      glow.dispose();
    },
    [glow],
  );

  return (
    <group>
      <mesh>
        <icosahedronGeometry args={[1, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh material={glow} scale={3.2}>
        <icosahedronGeometry args={[1, 6]} />
      </mesh>
    </group>
  );
}

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Group,
  type Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mulberry32 } from '../../shared/random';
import type { WorldParams } from './palette';
import {
  atmosphereFragment,
  atmosphereVertex,
  cloudFragment,
  cloudVertex,
  planetFragment,
  planetVertex,
} from './shaders';

const SUN = new Vector3(1, 0.35, 0.7).normalize();

// Phones get fewer noise octaves: per-pixel fBm is the dominant GPU cost.
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const DEFINES = {
  VERTEX_OCTAVES: coarse ? 4 : 5,
  FRAGMENT_OCTAVES: coarse ? 6 : 8,
};

interface Props {
  world: WorldParams;
  seaShift: number;
  autoRotate: boolean;
}

export function Planet({ world, seaShift, autoRotate }: Props) {
  const group = useRef<Group>(null);
  const clouds = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);

  // Materials are created once; uniforms are mutated in place when the seed
  // changes (no shader recompile, no new GPU program).
  const planetMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        defines: DEFINES,
        uniforms: {
          uOffset: { value: new Vector3() },
          uScale: { value: 1 },
          uSeaLevel: { value: 0 },
          uMountains: { value: 0.5 },
          uSunDir: { value: SUN },
          uDeep: { value: new Color() },
          uShallow: { value: new Color() },
          uSand: { value: new Color() },
          uLow: { value: new Color() },
          uHigh: { value: new Color() },
          uRock: { value: new Color() },
          uSnow: { value: new Color() },
          uAtmo: { value: new Color() },
        },
      }),
    [],
  );

  const cloudMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uOffset: { value: new Vector3() },
          uSunDir: { value: SUN },
          uCover: { value: 0.5 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  const atmoMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: { uAtmo: { value: new Color() }, uSunDir: { value: SUN } },
      }),
    [],
  );

  useEffect(() => {
    const u = planetMat.uniforms;
    (u.uOffset!.value as Vector3).set(...world.offset);
    u.uScale!.value = world.scale;
    u.uSeaLevel!.value = world.seaLevel + seaShift;
    u.uMountains!.value = world.mountains;
    const c = world.colors;
    (u.uDeep!.value as Color).set(c.deep);
    (u.uShallow!.value as Color).set(c.shallow);
    (u.uSand!.value as Color).set(c.sand);
    (u.uLow!.value as Color).set(c.low);
    (u.uHigh!.value as Color).set(c.high);
    (u.uRock!.value as Color).set(c.rock);
    (u.uSnow!.value as Color).set(c.snow);
    (u.uAtmo!.value as Color).set(c.atmosphere);
    (cloudMat.uniforms.uOffset!.value as Vector3).set(...world.offset);
    cloudMat.uniforms.uCover!.value = world.cloudCover;
    (atmoMat.uniforms.uAtmo!.value as Color).set(c.atmosphere);
    invalidate(); // needed in frameloop="demand"
  }, [world, seaShift, planetMat, cloudMat, atmoMat, invalidate]);

  // Materials made with `new` inside useMemo aren't owned by R3F: free them.
  useEffect(
    () => () => {
      planetMat.dispose();
      cloudMat.dispose();
      atmoMat.dispose();
    },
    [planetMat, cloudMat, atmoMat],
  );

  useFrame((_, delta) => {
    if (!autoRotate) return;
    const dt = Math.min(delta, 0.1);
    if (group.current) group.current.rotation.y += dt * 0.06;
    if (clouds.current) clouds.current.rotation.y += dt * 0.025;
    (cloudMat.uniforms.uTime!.value as number) += dt;
  });

  return (
    <group ref={group} rotation={[0.3, 0, 0.12]}>
      <mesh material={planetMat}>
        <icosahedronGeometry args={[1, coarse ? 48 : 80]} />
      </mesh>
      <mesh ref={clouds} material={cloudMat} scale={1.035}>
        <icosahedronGeometry args={[1, 24]} />
      </mesh>
      <mesh material={atmoMat} scale={1.14}>
        <icosahedronGeometry args={[1, 16]} />
      </mesh>
    </group>
  );
}

/** Seeded star field: 3k points generated on the CPU in ~1 ms, zero downloads. */
export function Stars({ seed }: { seed: number }) {
  const geometry = useMemo(() => {
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const count = 3000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const tint = new Color();
    for (let i = 0; i < count; i++) {
      // Uniform direction on a sphere, random radius shell.
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r = 40 + rand() * 40;
      const s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(theta), r * u, r * s * Math.sin(theta)], i * 3);
      tint.setHSL(0.55 + rand() * 0.15 - (rand() < 0.2 ? 0.5 : 0), 0.5, 0.6 + rand() * 0.4);
      col.set([tint.r, tint.g, tint.b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  }, [seed]);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.16} vertexColors sizeAttenuation depthWrite={false} />
    </points>
  );
}

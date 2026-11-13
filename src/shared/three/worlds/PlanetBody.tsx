import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, Color, type Mesh, ShaderMaterial, Vector3 } from 'three';
import type { WorldParams } from '../../worlds/world';
import {
  atmosphereFragment,
  atmosphereVertex,
  cloudFragment,
  cloudVertex,
  planetFragment,
  planetVertex,
} from './shaders';

/** Default light direction (world space) when the caller has no star position. */
const DEFAULT_SUN = new Vector3(1, 0.35, 0.7).normalize();

// Phones get fewer noise octaves: per-pixel fBm is the dominant GPU cost.
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export interface PlanetBodyProps {
  world: WorldParams;
  /** Added to the world's sea level (Planet Forge slider). */
  seaShift?: number;
  /** Icosahedron subdivision. Lower for small/far bodies. */
  detail?: number;
  /** 'low' = fewer noise octaves (many bodies on screen, or phones). */
  quality?: 'high' | 'low';
  /**
   * World-space direction TO the light. The vector is used by reference, so a
   * parent can mutate it every frame (e.g. a planet orbiting a star).
   */
  sunDirection?: Vector3;
  /** Visual spin in rad/s (0 = still). Clouds drift a bit faster. */
  spin?: number;
}

/**
 * One procedural world (planet or moon) of radius 1: surface, clouds and
 * atmosphere, all from `WorldParams`. Position/scale it with a parent group.
 * Shared by Planet Forge and games: improving it improves every project.
 */
export function PlanetBody({
  world,
  seaShift = 0,
  detail = 64,
  quality = 'high',
  sunDirection = DEFAULT_SUN,
  spin = 0,
}: PlanetBodyProps) {
  const surface = useRef<Mesh>(null);
  const cloudMesh = useRef<Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const low = quality === 'low' || coarse;

  // Created once per (quality); uniforms are mutated in place afterwards, so a
  // new seed never recompiles shaders. Same source+defines → one shared program.
  const planetMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        defines: { VERTEX_OCTAVES: low ? 4 : 5, FRAGMENT_OCTAVES: low ? 5 : 8 },
        uniforms: {
          uOffset: { value: new Vector3() },
          uScale: { value: 1 },
          uSeaLevel: { value: 0 },
          uMountains: { value: 0.5 },
          uSunDir: { value: sunDirection },
          uOceanGloss: { value: 1 },
          uHasAtmo: { value: 1 },
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
    // sunDirection is applied in the effect below; don't rebuild for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [low],
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
          uSunDir: { value: sunDirection },
          uCover: { value: 0.5 },
          uTime: { value: 0 },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        uniforms: { uAtmo: { value: new Color() }, uSunDir: { value: sunDirection } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    planetMat.uniforms.uSunDir!.value = sunDirection;
    cloudMat.uniforms.uSunDir!.value = sunDirection;
    atmoMat.uniforms.uSunDir!.value = sunDirection;
    const u = planetMat.uniforms;
    (u.uOffset!.value as Vector3).set(...world.offset);
    u.uScale!.value = world.scale;
    u.uSeaLevel!.value = world.seaLevel + seaShift;
    u.uMountains!.value = world.mountains;
    u.uOceanGloss!.value = world.oceanGloss;
    u.uHasAtmo!.value = world.hasAtmosphere ? 1 : 0;
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
  }, [world, seaShift, sunDirection, planetMat, cloudMat, atmoMat, invalidate]);

  // Materials made with `new` aren't owned by R3F: free them on unmount.
  useEffect(
    () => () => {
      planetMat.dispose();
    },
    [planetMat],
  );
  useEffect(
    () => () => {
      cloudMat.dispose();
      atmoMat.dispose();
    },
    [cloudMat, atmoMat],
  );

  useFrame((_, delta) => {
    if (!spin) return;
    const dt = Math.min(delta, 0.1);
    if (surface.current) surface.current.rotation.y += dt * spin;
    if (cloudMesh.current) cloudMesh.current.rotation.y += dt * spin * 1.4;
    (cloudMat.uniforms.uTime!.value as number) += dt;
  });

  const hasClouds = world.cloudCover > 0;
  return (
    <group>
      <mesh ref={surface} material={planetMat}>
        <icosahedronGeometry args={[1, detail]} />
      </mesh>
      {hasClouds && (
        <mesh ref={cloudMesh} material={cloudMat} scale={1.035}>
          <icosahedronGeometry args={[1, Math.max(8, Math.round(detail * 0.3))]} />
        </mesh>
      )}
      {world.hasAtmosphere && (
        <mesh material={atmoMat} scale={1.14}>
          <icosahedronGeometry args={[1, Math.max(6, Math.round(detail * 0.2))]} />
        </mesh>
      )}
    </group>
  );
}

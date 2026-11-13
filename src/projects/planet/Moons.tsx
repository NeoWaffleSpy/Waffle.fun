import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { OrbitRing } from '../../shared/three/worlds/OrbitRing';
import { PlanetBody } from '../../shared/three/worlds/PlanetBody';
import type { MoonSpec } from '../../shared/worlds/world';

/** One moon on its (tilted) orbit around a planet of radius 1. */
function MoonOrbit({ moon, animate }: { moon: MoonSpec; animate: boolean }) {
  const pivot = useRef<Group>(null);
  // Visual Kepler-ish speed: inner moons orbit faster.
  const speed = (0.5 / (moon.orbit * Math.sqrt(moon.orbit))) * moon.direction;

  useFrame((_, delta) => {
    if (animate && pivot.current) pivot.current.rotation.y -= Math.min(delta, 0.1) * speed;
  });

  return (
    <group rotation={[moon.tilt, 0, 0]}>
      <OrbitRing radius={moon.orbit} opacity={0.12} />
      <group ref={pivot} rotation={[0, -moon.phase, 0]}>
        <group position={[moon.orbit, 0, 0]} scale={moon.radius}>
          <PlanetBody world={moon.world} detail={24} quality="low" spin={animate ? 0.1 : 0} />
        </group>
      </group>
    </group>
  );
}

/** The moons the shared generator assigns to this planet (same ones games use). */
export function Moons({ moons, animate }: { moons: MoonSpec[]; animate: boolean }) {
  return (
    <>
      {moons.map((m) => (
        <MoonOrbit key={m.seed} moon={m} animate={animate} />
      ))}
    </>
  );
}

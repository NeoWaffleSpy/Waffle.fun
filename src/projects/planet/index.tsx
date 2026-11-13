import { OrbitControls } from '@react-three/drei';
import { useEffect, useId, useMemo, useState } from 'react';
import { parseSeed } from '../../shared/random';
import { useSearchParams } from '../../shared/router';
import { SceneCanvas } from '../../shared/three/SceneCanvas';
import { PlanetBody } from '../../shared/three/worlds/PlanetBody';
import { Starfield } from '../../shared/three/worlds/Starfield';
import { moonsForPlanet, worldFromSeed } from '../../shared/worlds/world';
import { Moons } from './Moons';
import { usePlanetStore } from './store';
import './planet.css';

/**
 * Planet Forge is a thin UI over the shared world generator
 * (`shared/worlds/world.ts` + `shared/three/worlds/PlanetBody.tsx`). Games use
 * the same code, so improvements made here show up everywhere.
 */
export default function PlanetForge() {
  const {
    seed,
    autoRotate,
    seaShift,
    showMoons,
    setSeed,
    newSeed,
    setAutoRotate,
    setSeaShift,
    setShowMoons,
  } = usePlanetStore();
  const [params, setParams] = useSearchParams();
  const seaId = useId();

  // URL → state once on mount, so `#/planet?seed=1234` is a shareable world.
  const urlSeed = parseSeed(params.get('seed'));
  useEffect(() => {
    if (urlSeed !== null) setSeed(urlSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // State → URL (replace, so "new seed" doesn't spam history).
  useEffect(() => {
    if (params.get('seed') !== String(seed)) {
      setParams({ seed: String(seed) }, { replace: true });
    }
  }, [seed, params, setParams]);

  const world = useMemo(() => worldFromSeed(seed), [seed]);
  const moons = useMemo(() => moonsForPlanet(seed), [seed]);

  // FOV is vertical, so portrait phones need the camera further back to fit
  // the planet's width. Computed once; OrbitControls owns it afterwards.
  const [cameraZ] = useState(
    () => 4.2 * Math.max(1, 0.9 / (window.innerWidth / window.innerHeight)),
  );

  const moonLabel =
    moons.length === 0 ? 'no moons' : moons.length === 1 ? '1 moon' : `${moons.length} moons`;

  return (
    <div className="planet">
      <div
        className="planet__canvas"
        role="img"
        aria-label={`${world.name}, a procedurally generated ${world.biome.toLowerCase()} planet with ${moonLabel}, seed ${String(seed)}. Drag to orbit, scroll or pinch to zoom.`}
      >
        <SceneCanvas
          // Continuous rendering only while something actually moves.
          frameloop={autoRotate ? 'always' : 'demand'}
          camera={{ position: [0, 0.6, cameraZ], fov: 45, near: 0.05, far: 200 }}
        >
          <color attach="background" args={['#04050c']} />
          <Starfield seed={seed} />
          <group rotation={[0.3, 0, 0.12]}>
            <PlanetBody
              world={world}
              seaShift={seaShift}
              detail={80}
              spin={autoRotate ? 0.06 : 0}
            />
            {showMoons && <Moons moons={moons} animate={autoRotate} />}
          </group>
          <OrbitControls
            enablePan={false}
            enableDamping
            minDistance={1.6}
            maxDistance={Math.max(10, cameraZ * 1.8)}
            rotateSpeed={0.6}
          />
        </SceneCanvas>
      </div>

      <section className="planet__panel" aria-label="Planet controls">
        <h1 className="planet__title">{world.name}</h1>
        <p className="planet__meta">
          <span>{world.biome}</span> · {moonLabel} · seed <code>{seed}</code>
        </p>
        <div className="planet__row">
          <button type="button" className="btn" onClick={newSeed}>
            New seed
          </button>
          <label className="planet__toggle">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => {
                setAutoRotate(e.target.checked);
              }}
            />
            Rotate
          </label>
          <label className="planet__toggle">
            <input
              type="checkbox"
              checked={showMoons}
              disabled={moons.length === 0}
              onChange={(e) => {
                setShowMoons(e.target.checked);
              }}
            />
            Moons
          </label>
        </div>
        <label className="planet__slider" htmlFor={seaId}>
          Sea level
          <input
            id={seaId}
            type="range"
            min={-0.3}
            max={0.3}
            step={0.01}
            value={seaShift}
            onChange={(e) => {
              setSeaShift(Number(e.target.value));
            }}
          />
        </label>
        <p className="planet__forge">Planet Forge</p>
      </section>
    </div>
  );
}

import { OrbitControls } from '@react-three/drei';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from '../../shared/router';
import { parseSeed } from '../../shared/random';
import { SceneCanvas } from '../../shared/three/SceneCanvas';
import { worldFromSeed } from './palette';
import { Planet, Stars } from './Planet';
import { usePlanetStore } from './store';
import './planet.css';

export default function PlanetForge() {
  const { seed, autoRotate, seaShift, setSeed, newSeed, setAutoRotate, setSeaShift } =
    usePlanetStore();
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

  // FOV is vertical, so portrait phones need the camera further back to fit
  // the planet's width. Computed once; OrbitControls owns it afterwards.
  const [cameraZ] = useState(
    () => 3.3 * Math.max(1, 0.9 / (window.innerWidth / window.innerHeight)),
  );

  return (
    <div className="planet">
      <div
        className="planet__canvas"
        role="img"
        aria-label={`A procedurally generated ${world.biome.toLowerCase()} planet, seed ${String(seed)}. Drag to orbit, scroll or pinch to zoom.`}
      >
        <SceneCanvas
          // Continuous rendering only while something actually moves.
          frameloop={autoRotate ? 'always' : 'demand'}
          camera={{ position: [0, 0, cameraZ], fov: 45, near: 0.1, far: 200 }}
        >
          <color attach="background" args={['#04050c']} />
          <Stars seed={seed} />
          <Planet world={world} seaShift={seaShift} autoRotate={autoRotate} />
          <OrbitControls
            enablePan={false}
            enableDamping
            minDistance={1.6}
            maxDistance={Math.max(8, cameraZ * 1.5)}
            rotateSpeed={0.6}
          />
        </SceneCanvas>
      </div>

      <section className="planet__panel" aria-label="Planet controls">
        <h1 className="planet__title">Planet Forge</h1>
        <p className="planet__meta">
          <span>{world.biome}</span> · seed <code>{seed}</code>
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
      </section>
    </div>
  );
}

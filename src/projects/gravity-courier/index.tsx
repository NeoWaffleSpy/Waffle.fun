import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseSeed } from '../../shared/random';
import { useSearchParams } from '../../shared/router';
import { SceneCanvas } from '../../shared/three/SceneCanvas';
import { generateSystem } from '../../shared/worlds/system';
import { CourierAudio } from './audio';
import { loadGhost } from './ghost';
import { InputState } from './input';
import { GameScene, type Run } from './scene/GameScene';
import { REPLAY_VERSION } from './sim/constants';
import { dailySeed } from './daily';
import { generatePlan } from './sim/plan';
import { decodeReplay } from './sim/replay';
import { CourierSim } from './sim/sim';
import { useCourierStore } from './store';
import { Hud } from './ui/Hud';
import { Menu } from './ui/Menu';
import { Results } from './ui/Results';
import { TouchControls } from './ui/TouchControls';
import './courier.css';

const MUTE_KEY = 'waffle:courier:muted';

export default function GravityCourier() {
  const { phase, mode, seed, runId, paused, result } = useCourierStore();
  const store = useCourierStore.getState;
  const [params, setParams] = useSearchParams();
  const [ready, setReady] = useState(false);
  const input = useMemo(() => new InputState(), []);
  const audio = useMemo(() => new CourierAudio(), []);
  const runRef = useRef<Run | null>(null);

  // Pick the system once: `?seed=` → that system, otherwise today's daily one.
  useEffect(() => {
    const urlSeed = parseSeed(params.get('seed'));
    const s = store();
    s.toMenu();
    if (urlSeed !== null) s.setMode('random', urlSeed);
    else s.setMode('daily', dailySeed());
    let muted = false;
    try {
      muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* ignore */
    }
    s.setMuted(muted);
    audio.setMuted(muted);
    // One extra render on mount is intended: the seed must come from the URL first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Random systems are shareable by URL; the daily one needs no seed.
  useEffect(() => {
    if (!ready) return;
    const want = mode === 'random' ? String(seed) : null;
    if (params.get('seed') !== want) setParams(want ? { seed: want } : {}, { replace: true });
  }, [ready, mode, seed, params, setParams]);

  const system = useMemo(() => generateSystem(seed), [seed]);
  const plan = useMemo(() => generatePlan(system), [system]);
  const best = useMemo(() => (phase === 'menu' ? loadGhost(seed) : null), [phase, seed]);

  const startRun = useCallback(() => {
    audio.ensure();
    input.clear();
    let ghost: CourierSim | null = null;
    let ghostInputs: Uint8Array | null = null;
    const stored = loadGhost(seed);
    if (stored) {
      try {
        const r = decodeReplay(stored.replay);
        if (r.seed === seed && r.version === REPLAY_VERSION) {
          ghost = new CourierSim(system, plan);
          ghostInputs = r.inputs;
        }
      } catch {
        /* corrupt ghost: fly without it */
      }
    }
    runRef.current = { sim: new CourierSim(system, plan), ghost, ghostInputs };
    store().start();
  }, [audio, input, seed, system, plan, store]);

  const toMenu = useCallback(() => {
    runRef.current = null;
    store().toMenu();
  }, [store]);

  const toggleMute = useCallback(() => {
    const muted = !store().muted;
    store().setMuted(muted);
    audio.setMuted(muted);
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [audio, store]);

  // Keyboard: flight controls + shortcuts. Ignored while typing (name field).
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      audio.ensure();
      const s = store();
      if (s.phase !== 'playing') return;
      if (input.key(e.code, true)) {
        e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (e.code === 'KeyP' || e.code === 'Escape') s.setPaused(!s.paused);
      else if (e.code === 'KeyR') startRun();
      else if (e.code === 'KeyM') s.toggleMap();
    };
    const onUp = (e: KeyboardEvent) => {
      input.key(e.code, false);
    };
    const onBlur = () => {
      input.clear();
    };
    const onVisibility = () => {
      if (document.hidden && store().phase === 'playing') store().setPaused(true);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [audio, input, startRun, store]);

  // Leaving the project: stop audio, drop the run.
  useEffect(
    () => () => {
      audio.dispose();
      runRef.current = null;
    },
    [audio],
  );

  if (!ready) return null;

  return (
    <div className="courier">
      <div
        className="courier__canvas"
        role="img"
        aria-label={`Gravity Courier: the ${system.star.name} star system. Use the arrow keys to fly.`}
      >
        <SceneCanvas
          frameloop="always"
          camera={{ fov: 50, near: 0.5, far: 9000, position: [0, 400, 200] }}
        >
          <GameScene system={system} runRef={runRef} input={input} audio={audio} />
        </SceneCanvas>
      </div>

      {phase === 'menu' && (
        <Menu
          system={system}
          plan={plan}
          mode={mode}
          best={best}
          onStart={startRun}
          onDaily={() => {
            store().setMode('daily', dailySeed());
          }}
          onRandom={() => {
            store().setMode('random', Math.floor(Math.random() * 1_000_000));
          }}
        />
      )}

      {phase === 'playing' && (
        <>
          <Hud
            onPause={() => {
              store().setPaused(true);
            }}
            onMap={() => {
              store().toggleMap();
            }}
            onMute={toggleMute}
          />
          <TouchControls input={input} />
        </>
      )}

      {phase === 'playing' && paused && (
        <div className="gc-overlay">
          <div className="gc-card gc-pause" role="dialog" aria-label="Paused">
            <h1>Paused</h1>
            <div className="gc-actions">
              <button
                type="button"
                className="btn"
                autoFocus
                onClick={() => {
                  store().setPaused(false);
                }}
              >
                Resume
              </button>
              <button type="button" className="btn btn--ghost" onClick={startRun}>
                Restart
              </button>
              <button type="button" className="btn btn--ghost" onClick={toMenu}>
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <Results result={result} seed={seed} runId={runId} onRetry={startRun} onMenu={toMenu} />
      )}
    </div>
  );
}

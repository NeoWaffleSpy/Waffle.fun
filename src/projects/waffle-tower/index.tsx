import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../shared/hooks/usePrefersReducedMotion';
import { TowerEngine } from './engine';
import { HighScores } from '../../shared/components/HighScores';
import { useTowerStore } from './store';
import './waffle-tower.css';

export default function WaffleTower() {
  const reducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TowerEngine | null>(null);
  const kickRef = useRef<() => void>(() => undefined);
  const { phase, score, setPhase, setScore } = useTowerStore();
  const [round, setRound] = useState(0);
  const [meta, setMeta] = useState<Record<string, unknown>>({});

  // Engine + render loop. The loop only runs while something moves; when the
  // game is idle or over and settled, no frames are drawn (battery friendly).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const engine = new TowerEngine({ reducedMotion });
    engineRef.current = engine;
    setPhase('ready');
    setScore(0);

    let raf = 0;
    let last = 0;
    let cssW = 0;
    let cssH = 0;

    const render = (now: number) => {
      engine.draw(ctx, cssW, cssH, now);
    };

    const frame = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const active = engine.update(dt);
      render(now);
      raf = active ? requestAnimationFrame(frame) : 0;
      if (!active) last = 0;
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kickRef.current = kick;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = rect.width;
      cssH = rect.height;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(performance.now());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      engineRef.current = null;
      kickRef.current = () => undefined;
    };
  }, [reducedMotion, setPhase, setScore]);

  const act = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const now = performance.now();
    if (engine.phase === 'ready') {
      engine.start(now);
      setPhase('playing');
      setScore(0);
    } else if (engine.phase === 'playing') {
      const res = engine.drop(now);
      setScore(res.score);
      if (res.phase === 'over') {
        // Sent with the score so a future server can sanity-check it.
        setMeta({ drops: engine.drops, durationMs: Math.round(now - engine.startedAt) });
        setRound((r) => r + 1);
        setPhase('over');
      }
    }
    kickRef.current();
  }, [setPhase, setScore]);

  const restart = useCallback(() => {
    engineRef.current?.reset();
    setPhase('ready');
    setScore(0);
    act();
  }, [act, setPhase, setScore]);

  // Keyboard: Space / Enter / ArrowDown drop. Ignored while typing a name.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.tagName === 'A')) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        act();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [act]);

  return (
    <div className="tower">
      <canvas
        ref={canvasRef}
        className="tower__canvas"
        aria-label="Waffle Tower game. Press Space, Enter or tap to drop the moving waffle."
        role="img"
        onPointerDown={(e) => {
          if (e.button === 0) act();
        }}
      />

      <div className="tower__hud" aria-live="polite">
        <span className="tower__score">{score}</span>
      </div>

      {phase === 'ready' && (
        <div className="tower__overlay">
          <div className="tower__card">
            <h1>Waffle Tower</h1>
            <p>Drop each waffle onto the stack. Whatever hangs over gets chopped off.</p>
            <button type="button" className="btn" onClick={act}>
              Start
            </button>
            <p className="tower__hint">Tap, click, or press Space</p>
          </div>
        </div>
      )}

      {phase === 'over' && (
        <div className="tower__overlay">
          <div className="tower__card" role="dialog" aria-label="Game over">
            <h1>Game over</h1>
            <p className="tower__final">
              You stacked <strong>{score}</strong> {score === 1 ? 'waffle' : 'waffles'}.
            </p>
            <HighScores key={round} game="waffle-tower" pendingScore={score} meta={meta} />
            <button type="button" className="btn" onClick={restart} autoFocus>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

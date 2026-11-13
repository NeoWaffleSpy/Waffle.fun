import { HighScores } from '../../../shared/components/HighScores';
import { Link } from '../../../shared/router';
import type { StarSystem, SystemBody } from '../../../shared/worlds/system';
import type { StoredGhost } from '../ghost';
import type { RunPlan } from '../sim/plan';
import { dateKey } from '../daily';
import type { Mode } from '../store';

/** Planets link to their own Forge page; moons link to their parent planet's page. */
function forgeSeed(system: StarSystem, b: SystemBody): number {
  return b.parent >= 0 ? (system.bodies[b.parent]?.seed ?? b.seed) : b.seed;
}

function BodyLink({ system, index }: { system: StarSystem; index: number }) {
  const b = system.bodies[index];
  if (!b) return null;
  return (
    <Link
      to={`/planet?seed=${String(forgeSeed(system, b))}`}
      className="gc-body"
      title={`Open ${b.kind === 'moon' ? 'its planet' : b.name} in Planet Forge`}
    >
      {b.name}
      {b.kind === 'moon' && <small> (moon)</small>}
    </Link>
  );
}

interface Props {
  system: StarSystem;
  plan: RunPlan;
  mode: Mode;
  best: StoredGhost | null;
  onStart: () => void;
  onDaily: () => void;
  onRandom: () => void;
}

export function Menu({ system, plan, mode, best, onStart, onDaily, onRandom }: Props) {
  const planets = system.bodies.filter((b) => b.kind === 'planet').length;
  const moons = system.bodies.length - planets;
  return (
    <div className="gc-overlay">
      <div className="gc-card gc-menu">
        <h1>Gravity Courier</h1>
        <p className="gc-lede">
          Deliver cargo across a procedural star system. Your engine is weak: let gravity do the
          work.
        </p>

        <div className="gc-tabs" role="tablist" aria-label="System">
          <button type="button" role="tab" aria-selected={mode === 'daily'} onClick={onDaily}>
            Daily
          </button>
          <button type="button" role="tab" aria-selected={mode === 'random'} onClick={onRandom}>
            {mode === 'random' ? 'New random' : 'Random'}
          </button>
        </div>

        <p className="gc-meta">
          <strong>{system.star.name} system</strong> · {planets} planets, {moons} moons
          <br />
          {mode === 'daily' ? `Daily route for ${dateKey()} (UTC)` : `Seed ${String(system.seed)}`}
        </p>

        <ol className="gc-route" aria-label="Route">
          <li>
            Start in orbit of <BodyLink system={system} index={plan.start} />
          </li>
          {plan.legs.map((l, i) => (
            <li key={l}>
              Deliver {i + 1} → <BodyLink system={system} index={l} />
            </li>
          ))}
        </ol>

        {best && (
          <p className="gc-best">
            Your best here: <strong>{best.score}</strong> · your ghost will fly with you
          </p>
        )}

        <button type="button" className="btn gc-launch" onClick={onStart} autoFocus>
          Launch
        </button>

        <details className="gc-help">
          <summary>How to fly</summary>
          <ul>
            <li>
              <kbd>←</kbd> <kbd>→</kbd> / <kbd>A</kbd> <kbd>D</kbd> rotate, <kbd>↑</kbd> /{' '}
              <kbd>W</kbd> / <kbd>Space</kbd> thrust
            </li>
            <li>The blue line is where you'll drift. It turns red if it ends in a crash.</li>
            <li>
              Dock by staying inside the target's ring with a low relative speed (match its orbit)
              for one second. Each delivery refuels you.
            </li>
            <li>
              <kbd>M</kbd> map · <kbd>P</kbd> pause · <kbd>R</kbd> restart · mouse wheel zoom
            </li>
          </ul>
        </details>

        <HighScores
          key={system.seed}
          game={`gravity-courier:${String(system.seed)}`}
          title="Leaderboard (this system)"
          pendingScore={null}
        />
      </div>
    </div>
  );
}

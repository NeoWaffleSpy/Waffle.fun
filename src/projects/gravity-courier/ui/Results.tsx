import { HighScores } from '../../../shared/components/HighScores';
import { REPLAY_VERSION } from '../sim/constants';
import type { RunResult } from '../store';

const TITLES: Record<RunResult['outcome'], string> = {
  complete: 'All deliveries made!',
  crashed: 'Crashed',
  lost: 'Lost in deep space',
  timeout: 'Out of time',
  flying: '',
};

interface Props {
  result: RunResult;
  seed: number;
  runId: number;
  onRetry: () => void;
  onMenu: () => void;
}

export function Results({ result, seed, runId, onRetry, onMenu }: Props) {
  const title =
    result.outcome === 'crashed' && result.crashedInto
      ? `Crashed into ${result.crashedInto}`
      : TITLES[result.outcome];
  return (
    <div className="gc-overlay">
      <div className="gc-card" role="dialog" aria-label="Run results">
        <h1>{title}</h1>
        <table className="gc-score">
          <tbody>
            {result.legScores.map((s, i) => (
              <tr key={i}>
                <th scope="row">Delivery {i + 1}</th>
                <td>{s}</td>
              </tr>
            ))}
            {result.outcome === 'complete' && (
              <tr>
                <th scope="row">Fuel bonus</th>
                <td>{result.fuelBonus}</td>
              </tr>
            )}
            <tr className="gc-score__total">
              <th scope="row">Score</th>
              <td>{result.score}</td>
            </tr>
          </tbody>
        </table>
        <p className="gc-meta">
          Flight time {result.seconds.toFixed(1)} s · replay {result.replay.length} bytes
          {result.isBest && (
            <>
              <br />
              <strong>New personal best!</strong> Your ghost is saved for this system.
            </>
          )}
        </p>
        <HighScores
          key={runId}
          game={`gravity-courier:${String(seed)}`}
          title="Leaderboard (this system)"
          pendingScore={result.score}
          // The replay lets a future server re-simulate and verify the score.
          meta={{
            replay: result.replay,
            ticks: result.ticks,
            outcome: result.outcome,
            v: REPLAY_VERSION,
          }}
        />
        <div className="gc-actions">
          <button type="button" className="btn" onClick={onRetry} autoFocus>
            Fly again
          </button>
          <button type="button" className="btn btn--ghost" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

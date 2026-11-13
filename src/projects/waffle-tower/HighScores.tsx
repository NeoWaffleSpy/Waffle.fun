import { useCallback, useEffect, useId, useState, type SyntheticEvent } from 'react';
import { SCORE_LIMITS, scoreService, type ScoreEntry } from '../../services';

export const GAME_ID = 'waffle-tower';
const NAME_KEY = 'waffle:player-name';

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

interface Props {
  /** Score to offer for submission, or null when just browsing. */
  pendingScore: number | null;
  meta?: Record<string, unknown>;
}

export function HighScores({ pendingScore, meta }: Props) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [name, setName] = useState(loadName);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();

  const fetchScores = useCallback(
    () =>
      scoreService.getTopScores(GAME_ID, 10).then(setScores, (e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load scores');
      }),
    [],
  );

  // Load once on mount. (The parent re-keys this component per game over,
  // which also resets the "saved" state.)
  useEffect(() => {
    void fetchScores();
  }, [fetchScores]);

  const canSubmit = pendingScore !== null && pendingScore > 0 && saved === null;

  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await scoreService.submitScore(GAME_ID, name, pendingScore, meta);
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch {
        /* ignore */
      }
      setSaved(new Date().toISOString());
      await fetchScores();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save score');
    }
  }

  return (
    <div className="hs">
      {canSubmit && (
        <form
          className="hs__form"
          onSubmit={(e) => {
            void submit(e);
          }}
        >
          <label htmlFor={nameId}>Your name</label>
          <div className="hs__row">
            <input
              id={nameId}
              value={name}
              maxLength={SCORE_LIMITS.nameMaxLength}
              autoComplete="nickname"
              placeholder="Anonymous"
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </form>
      )}
      {saved && <p className="hs__saved">Saved!</p>}
      {error && (
        <p className="hs__error" role="alert">
          {error}
        </p>
      )}

      <h2 className="hs__title">Local high scores</h2>
      {scores === null ? (
        <p className="hs__empty">Loading…</p>
      ) : scores.length === 0 ? (
        <p className="hs__empty">No scores yet. Be the first!</p>
      ) : (
        <ol className="hs__list">
          {scores.map((s) => (
            <li key={s.createdAt + s.name}>
              <span className="hs__name">{s.name}</span>
              <span className="hs__score">{s.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

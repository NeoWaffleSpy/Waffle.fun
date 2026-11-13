import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

const CHUNK_ERROR = /dynamically imported module|Failed to fetch|Importing a module|error loading/i;
const RELOAD_KEY = 'waffle:chunk-reload-at';

/**
 * After a deploy, GitHub Pages deletes the old hashed chunks. A returning
 * visitor's cached index.html can still point at them until the new service
 * worker takes over, which happens on the next navigation. So on a chunk-load
 * failure, reload once (guarded so an offline user doesn't loop).
 */
function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * Catches render errors and failed chunk loads (e.g. offline on first visit,
 * or a stale tab after a deploy) so one project can never take down the hub.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (CHUNK_ERROR.test(error.message) && reloadOnceForStaleChunk()) return;
    console.error('[project crashed]', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const isChunk = CHUNK_ERROR.test(error.message);
    return (
      <div className="fallback" role="alert">
        <h2>{isChunk ? 'Couldn’t load this project' : 'Something went wrong'}</h2>
        <p>
          {isChunk
            ? 'Check your connection, or the site may have just been updated.'
            : 'This project hit an unexpected error.'}
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            window.location.reload();
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

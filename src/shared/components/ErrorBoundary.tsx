import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
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
    console.error('[project crashed]', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const isChunk = /dynamically imported module|Failed to fetch|Importing a module/i.test(
      error.message,
    );
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

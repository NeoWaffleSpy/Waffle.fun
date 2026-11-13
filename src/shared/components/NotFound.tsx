import { Link } from '../router';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function NotFound() {
  useDocumentTitle('Not found');
  return (
    <main className="fallback">
      <h1>Nothing here</h1>
      <p>That project doesn’t exist (yet).</p>
      <Link to="/" className="btn">
        Back to all projects
      </Link>
    </main>
  );
}

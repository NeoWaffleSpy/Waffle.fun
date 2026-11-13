import { Link } from '../router';

export function BackToHub() {
  return (
    <Link to="/" className="back-to-hub" aria-label="Back to all projects">
      <span aria-hidden="true">←</span> Waffle.fun
    </Link>
  );
}

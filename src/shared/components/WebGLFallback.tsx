import { Link } from '../router';

export function WebGLFallback({ title }: { title: string }) {
  return (
    <div className="fallback" role="alert">
      <h2>{title} needs WebGL 2</h2>
      <p>
        Your browser or device doesn’t support WebGL 2, or it’s turned off. Try enabling hardware
        acceleration, updating your browser, or opening this page on another device.
      </p>
      <Link to="/" className="btn">
        Browse other projects
      </Link>
    </div>
  );
}

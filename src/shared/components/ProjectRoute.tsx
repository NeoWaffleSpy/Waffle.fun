import { Suspense, lazy } from 'react';
import { projects, type ProjectMeta } from '../../projects/registry';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { hasWebGL2 } from '../hooks/useWebGLSupport';
import { BackToHub } from './BackToHub';
import { ErrorBoundary } from './ErrorBoundary';
import { Loader } from './Loader';
import { WebGLFallback } from './WebGLFallback';

// One lazy wrapper per project, created at module load (never during render).
// `lazy()` doesn't fetch anything until the component first renders.
const lazyBySlug = new Map(projects.map((p) => [p.slug, lazy(p.load)]));

/**
 * Shell around every project: title, back button, error boundary, Suspense,
 * and a WebGL check that runs BEFORE the 3D chunk is requested.
 */
export function ProjectRoute({ project }: { project: ProjectMeta }) {
  useDocumentTitle(project.title);

  if (project.is3D && !hasWebGL2()) {
    return (
      <main className="project">
        <BackToHub />
        <WebGLFallback title={project.title} />
      </main>
    );
  }

  return (
    <main className="project" aria-label={project.title}>
      <BackToHub />
      <ErrorBoundary>
        <Suspense fallback={<Loader label={`Loading ${project.title}…`} />}>
          <LazyProject slug={project.slug} />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}

function LazyProject({ slug }: { slug: string }) {
  const Project = lazyBySlug.get(slug);
  // Identity is stable: the lazy component was created once at module load.
  // eslint-disable-next-line react-hooks/static-components
  return Project ? <Project /> : null;
}

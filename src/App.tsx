import { useEffect } from 'react';
import { Hub } from './Hub';
import { projectBySlug } from './projects/registry';
import { NotFound } from './shared/components/NotFound';
import { ProjectRoute } from './shared/components/ProjectRoute';
import { useLocation } from './shared/router';

/**
 * Routes are derived from the registry: `#/` → hub, `#/<slug>` → project.
 * Nothing to edit here when adding a project.
 */
export function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (pathname === '/') return <Hub />;
  const project = projectBySlug.get(pathname.slice(1));
  // `key` guarantees a full unmount between projects: cleanup runs, state resets.
  return project ? <ProjectRoute key={project.slug} project={project} /> : <NotFound />;
}

import { Link } from './shared/router';
import { projects, type ProjectMeta } from './projects/registry';
import { useDocumentTitle } from './shared/hooks/useDocumentTitle';

/** Start downloading a project's chunk before the click lands. import() dedupes. */
function prefetch(project: ProjectMeta): void {
  void project.load().catch(() => {
    // Ignore: the real navigation will surface the error via ErrorBoundary.
  });
}

function ProjectCard({ project }: { project: ProjectMeta }) {
  const warm = () => {
    prefetch(project);
  };
  return (
    <li className="card">
      <Link
        to={`/${project.slug}`}
        className="card__link"
        onPointerEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
      >
        <div
          className="card__thumb"
          role="img"
          aria-label={project.thumbnail.alt}
          style={{ background: project.thumbnail.background }}
        />
        <div className="card__body">
          <h2 className="card__title">
            {project.title}
            {project.is3D && <span className="badge">3D</span>}
          </h2>
          <p className="card__desc">{project.description}</p>
          <ul className="card__tags" aria-label="Tags">
            {project.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </Link>
    </li>
  );
}

export function Hub() {
  useDocumentTitle();
  return (
    <div className="hub">
      <header className="hub__header">
        <h1 className="hub__logo">
          Waffle<span>.fun</span>
        </h1>
        <p className="hub__tagline">Small interactive things, made with code. Pick one.</p>
      </header>
      <main>
        <ul className="grid" aria-label="Projects">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </ul>
      </main>
      <footer className="hub__footer">
        <p>Everything here is generated in your browser. No heavy downloads.</p>
      </footer>
    </div>
  );
}

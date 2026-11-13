/* eslint-disable react-refresh/only-export-components -- hooks + <Link> live together on purpose; the router module is tiny and never hot-edited. */
/**
 * Minimal hash router (~1 KB gz).
 *
 * Why not React Router? It costs ~18 KB gz, which alone pushed the hub over its
 * 80 KB budget, and this site only needs flat `#/<slug>?query` routes. The API
 * mirrors React Router's names (`Link`, `useLocation`, `useSearchParams`,
 * `navigate`) so swapping back is a find-and-replace if nested routes,
 * loaders, etc. are ever needed.
 *
 * Hash URLs are required anyway: GitHub Pages can't rewrite deep links to
 * index.html, but everything after `#` never reaches the server.
 */
import { useCallback, useMemo, useSyncExternalStore, type AnchorHTMLAttributes } from 'react';

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => {
    l();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('hashchange', emit);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('hashchange', emit);
  };
}

/** `#/planet?seed=4` → `/planet?seed=4`; empty hash → `/`. */
const getHref = (): string => {
  const h = window.location.hash.slice(1);
  return h.startsWith('/') ? h : '/';
};

export interface Location {
  pathname: string;
  search: string;
}

export function useLocation(): Location {
  const href = useSyncExternalStore(subscribe, getHref, () => '/');
  return useMemo(() => {
    const i = href.indexOf('?');
    return i === -1
      ? { pathname: href, search: '' }
      : { pathname: href.slice(0, i), search: href.slice(i) };
  }, [href]);
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = `${window.location.pathname}${window.location.search}#${to}`;
  if (opts.replace) {
    // replaceState doesn't fire `hashchange`, so notify subscribers ourselves.
    history.replaceState(history.state, '', url);
    emit();
  } else {
    window.location.hash = to;
  }
}

export function useSearchParams(): [
  URLSearchParams,
  (next: Record<string, string>, opts?: { replace?: boolean }) => void,
] {
  const { pathname, search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = useCallback(
    (next: Record<string, string>, opts?: { replace?: boolean }) => {
      const qs = new URLSearchParams(next).toString();
      navigate(qs ? `${pathname}?${qs}` : pathname, opts);
    },
    [pathname],
  );
  return [params, set];
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string };

/** A real <a href="#/…">: works with middle-click, copy link, no JS handler. */
export function Link({ to, ...rest }: LinkProps) {
  return <a href={`#${to}`} {...rest} />;
}

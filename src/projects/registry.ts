import type { ComponentType } from 'react';

/**
 * Single source of truth for every mini-project.
 *
 * To add a project: create `src/projects/<slug>/index.tsx` (default export a
 * component) and add ONE entry below. Routes, hub cards, prefetching and code
 * splitting all derive from this list.
 *
 * IMPORTANT: this file is part of the hub bundle. Never import project code
 * statically here; only reference it via `load: () => import(...)`.
 */
export interface ProjectMeta {
  /** URL segment: `#/<slug>`. Must match the folder name. */
  slug: string;
  title: string;
  description: string;
  tags: readonly string[];
  /** 3D projects pull the shared three/R3F vendor chunk and get a WebGL check. */
  is3D: boolean;
  /**
   * Procedural thumbnail: a CSS background (no image download) plus the
   * accessible description of what it depicts.
   */
  thumbnail: { background: string; alt: string };
  /** Lazy import. Also called on hover/focus to prefetch the chunk. */
  load: () => Promise<{ default: ComponentType }>;
}

export const projects: readonly ProjectMeta[] = [
  {
    slug: 'planet',
    title: 'Planet Forge',
    description:
      'Spin up a whole procedural world from a single seed. Every pixel is computed on your GPU.',
    tags: ['3D', 'shaders', 'procedural'],
    is3D: true,
    thumbnail: {
      background:
        // Planet with lit limb + atmosphere ring, a few stars, deep-space backdrop.
        'radial-gradient(circle at 50% 50%, #5fb878 0 6%, #2f8f5a 11%, #1f6fa6 19%, #0b2a55 27.5%, #7cc4ff 28.5%, rgba(124,196,255,.25) 30.5%, transparent 34%), radial-gradient(circle at 18% 22%, #fff 0 .4%, transparent .7%), radial-gradient(circle at 82% 30%, #fff 0 .3%, transparent .6%), radial-gradient(circle at 74% 80%, #cfe3ff 0 .35%, transparent .65%), radial-gradient(circle at 12% 78%, #fff 0 .3%, transparent .6%), linear-gradient(160deg, #070b1d, #1a1035)',
      alt: 'A small green and blue planet floating in dark space',
    },
    load: () => import('./planet'),
  },
  {
    slug: 'waffle-tower',
    title: 'Waffle Tower',
    description:
      'Stack waffles as high as you can. Tap at the right moment, because every overhang gets sliced off.',
    tags: ['2D', 'game', 'high scores'],
    is3D: false,
    thumbnail: {
      background:
        'repeating-linear-gradient(0deg, transparent 0 14px, rgba(90,50,10,.35) 14px 16px), repeating-linear-gradient(90deg, transparent 0 14px, rgba(90,50,10,.35) 14px 16px), linear-gradient(180deg, #f6c46b, #d98b2b)',
      alt: 'A golden waffle grid pattern',
    },
    load: () => import('./waffle-tower'),
  },
];

export const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

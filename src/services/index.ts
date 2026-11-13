/**
 * The ONE place that decides which backend implementation is used.
 *
 * `VITE_BACKEND` is replaced at build time, so unused provider branches are
 * dead-code-eliminated and their SDKs never reach the bundle. Remote providers
 * are loaded with dynamic `import()` so even the active one only downloads the
 * first time a project actually needs it.
 */
import { localScoreService } from './local/localScoreService';
import type { BackendKind, ScoreService } from './types';

export type { ScoreEntry, ScoreService, BackendKind } from './types';
export { SCORE_LIMITS } from './types';

const backend: BackendKind = import.meta.env.VITE_BACKEND ?? 'local';

function loadScoreService(): Promise<ScoreService> {
  switch (backend) {
    case 'local':
      return Promise.resolve(localScoreService);
    case 'supabase':
      // When implemented:
      //   return import('./supabase/supabaseScoreService').then((m) => m.supabaseScoreService);
      return Promise.reject(
        new Error('VITE_BACKEND=supabase is not implemented yet. See src/services/README.md.'),
      );
  }
}

let cached: Promise<ScoreService> | undefined;
const resolve = (): Promise<ScoreService> => (cached ??= loadScoreService());

/** Facade: projects call this; the provider behind it is swappable. */
export const scoreService: ScoreService = {
  async submitScore(game, name, score, meta) {
    return (await resolve()).submitScore(game, name, score, meta);
  },
  async getTopScores(game, limit) {
    return (await resolve()).getTopScores(game, limit);
  },
};

import {
  SCORE_LIMITS,
  assertValidScore,
  sanitizeName,
  type ScoreEntry,
  type ScoreService,
} from '../types';

/**
 * Offline implementation backed by localStorage.
 * Keeps the top N scores per game; survives reloads, never leaves the device.
 */
const KEY_PREFIX = 'waffle:scores:';
const KEEP_PER_GAME = 50;

function key(game: string): string {
  return KEY_PREFIX + game;
}

function read(game: string): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(key(game));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    // Storage blocked (private mode) or corrupted: behave as empty.
    return [];
  }
}

function write(game: string, entries: ScoreEntry[]): void {
  try {
    localStorage.setItem(key(game), JSON.stringify(entries));
  } catch {
    // Quota exceeded / storage disabled: scores are best-effort locally.
  }
}

function isEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' && typeof v.score === 'number' && typeof v.createdAt === 'string'
  );
}

export const localScoreService: ScoreService = {
  // `meta` is accepted for interface parity; a server provider would store it
  // for plausibility checks (duration, input count, seed, client version...).
  submitScore(game, name, score) {
    assertValidScore(score);
    const entry: ScoreEntry = {
      name: sanitizeName(name),
      score,
      createdAt: new Date().toISOString(),
    };
    const next = [...read(game), entry]
      .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
      .slice(0, KEEP_PER_GAME);
    write(game, next);
    return Promise.resolve();
  },

  getTopScores(game, limit = SCORE_LIMITS.defaultLimit) {
    const n = Math.max(1, Math.min(limit, SCORE_LIMITS.maxLimit));
    return Promise.resolve(read(game).slice(0, n));
  },
};

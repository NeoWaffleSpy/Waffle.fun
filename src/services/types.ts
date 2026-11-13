/**
 * Backend-agnostic service contracts.
 *
 * Projects depend ONLY on these interfaces (via `services/index.ts`), never on a
 * vendor SDK. Swapping localStorage for Supabase/Firebase/D1 later is a change
 * inside `services/` only.
 */

export interface ScoreEntry {
  name: string;
  score: number;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

export interface ScoreService {
  submitScore(
    game: string,
    name: string,
    score: number,
    meta?: Record<string, unknown>,
  ): Promise<void>;
  getTopScores(game: string, limit?: number): Promise<ScoreEntry[]>;
}

/** Providers selectable via `VITE_BACKEND`. Add new ones here. */
export type BackendKind = 'local' | 'supabase';

/** Shared input validation. Remote providers must re-check server-side. */
export const SCORE_LIMITS = {
  nameMaxLength: 16,
  maxScore: 1_000_000,
  defaultLimit: 10,
  maxLimit: 100,
} as const;

export function sanitizeName(raw: string): string {
  // Strip control characters, collapse whitespace, clamp length.
  const cleaned = Array.from(raw.normalize('NFKC'))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, SCORE_LIMITS.nameMaxLength).join('') || 'Anonymous';
}

export function assertValidScore(score: number): void {
  if (!Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
    throw new RangeError(`Invalid score: ${String(score)}`);
  }
  if (score > SCORE_LIMITS.maxScore) {
    throw new RangeError(`Score exceeds maximum (${String(SCORE_LIMITS.maxScore)})`);
  }
}

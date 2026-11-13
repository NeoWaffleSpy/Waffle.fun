/** Best run per system, kept on this device so you can race your own ghost. */
export interface StoredGhost {
  score: number;
  replay: string;
}

const key = (seed: number) => `waffle:courier:ghost:${String(seed)}`;

export function loadGhost(seed: number): StoredGhost | null {
  try {
    const raw = localStorage.getItem(key(seed));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredGhost>;
    return typeof v.score === 'number' && typeof v.replay === 'string'
      ? { score: v.score, replay: v.replay }
      : null;
  } catch {
    return null;
  }
}

/** Saves if better than the stored ghost. Returns true when it's a new best. */
export function saveGhostIfBest(seed: number, ghost: StoredGhost): boolean {
  const prev = loadGhost(seed);
  if (prev && prev.score >= ghost.score) return false;
  try {
    localStorage.setItem(key(seed), JSON.stringify(ghost));
  } catch {
    /* storage full / blocked: ghosts are best-effort */
  }
  return true;
}

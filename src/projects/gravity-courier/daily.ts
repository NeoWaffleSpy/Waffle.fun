import { hashString } from '../../shared/worlds/dmath';

/** UTC date key, e.g. "2026-11-13". Everyone on Earth shares the same daily system. */
export function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailySeed(date = new Date()): number {
  return hashString(`gravity-courier:${dateKey(date)}`) % 1_000_000;
}

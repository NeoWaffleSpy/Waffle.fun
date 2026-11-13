import { mulberry32 } from '../../../shared/random';
import { hash32 } from '../../../shared/worlds/dmath';
import type { StarSystem } from '../../../shared/worlds/system';
import { LEGS } from './constants';

/** Where the run starts and the sequence of delivery targets (body indices). */
export interface RunPlan {
  start: number;
  legs: number[];
}

/** Deterministic delivery route for a system: same seed, same route for everyone. */
export function generatePlan(system: StarSystem): RunPlan {
  const rand = mulberry32(hash32(system.seed, 0x706c616e));
  const planets = system.bodies.filter((b) => b.kind === 'planet');
  const moons = system.bodies.filter((b) => b.kind === 'moon');

  // Start around a mid-system planet: its gravity well is wide enough to hold
  // the ship in orbit (inner planets sit too deep in the star's pull).
  const start = planets[1 + Math.floor(rand() * Math.min(2, planets.length - 1))]!.index;

  const legs: number[] = [];
  let here = start;
  for (let i = 0; i < LEGS; i++) {
    // Roughly one moon per run when available: tighter, trickier docking.
    const pool = moons.length > 0 && rand() < 0.35 ? moons : planets;
    // Never the current body, its own moons, the start, or a repeat.
    const fresh = (b: { index: number }) =>
      b.index !== here && b.index !== start && !legs.includes(b.index);
    let candidates = pool.filter((b) => fresh(b) && b.parent !== here);
    if (candidates.length === 0) candidates = system.bodies.filter(fresh);
    const target = candidates[Math.floor(rand() * candidates.length)]!.index;
    legs.push(target);
    here = target;
  }
  return { start, legs };
}

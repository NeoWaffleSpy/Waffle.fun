import { describe, expect, it } from 'vitest';
import { generatePlan } from '../../projects/gravity-courier/sim/plan';
import { generateSystem } from './system';
import { moonsForPlanet } from './world';

/**
 * Regression guard: the LOOK of worlds may change freely (shaders, palettes,
 * biomes), but the PHYSICS of a seed must not, or every saved ghost, replay and
 * leaderboard entry for that seed silently breaks.
 *
 * If you change physics on purpose: bump REPLAY_VERSION in
 * projects/gravity-courier/sim/constants.ts, then `npx vitest -u`.
 */
describe('physics stay stable across visual generator changes', () => {
  it.each([1, 42, 2026, 871627])('system %i', (seed) => {
    const sys = generateSystem(seed);
    expect({
      boundary: sys.boundary,
      star: { radius: sys.star.radius, gm: sys.star.gm },
      bodies: sys.bodies.map((b) => ({
        kind: b.kind,
        seed: b.seed,
        parent: b.parent,
        radius: b.radius,
        gm: b.gm,
        orbitRadius: b.orbitRadius,
        angularVelocity: b.angularVelocity,
        phase: b.phase,
      })),
      plan: generatePlan(sys),
    }).toMatchSnapshot();
  });

  it('moon layout per planet', () => {
    const layout = [7, 1234, 99999].map((s) =>
      moonsForPlanet(s).map((m) => ({
        seed: m.seed,
        radius: m.radius,
        orbit: m.orbit,
        phase: m.phase,
        direction: m.direction,
      })),
    );
    expect(layout).toMatchSnapshot();
  });
});

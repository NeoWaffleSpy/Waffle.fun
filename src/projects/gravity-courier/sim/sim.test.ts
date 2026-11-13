import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../shared/random';
import { DOCK_TICKS, IN_LEFT, IN_RIGHT, IN_THRUST, LEGS, TICK_RATE } from './constants';
import { generatePlan } from './plan';
import { decodeReplay, encodeReplay } from './replay';
import { CourierSim } from './sim';
import { createSim, verifyRun } from './verify';

/** Pseudo-random but realistic input: held keys that change every ~0.5 s. */
function scriptedInputs(seed: number, ticks: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  let current = 0;
  for (let i = 0; i < ticks; i++) {
    if (i % 30 === 0) {
      current = 0;
      if (rand() < 0.4) current |= IN_THRUST;
      const turn = rand();
      if (turn < 0.25) current |= IN_LEFT;
      else if (turn < 0.5) current |= IN_RIGHT;
    }
    out.push(current);
  }
  return out;
}

describe('plan', () => {
  it('builds a route of distinct targets that never starts at the current body', () => {
    for (let seed = 0; seed < 100; seed++) {
      const sim = createSim(seed);
      const { start, legs } = sim.plan;
      expect(legs).toHaveLength(LEGS);
      expect(new Set(legs).size).toBe(LEGS);
      expect(legs).not.toContain(start);
    }
  });
});

describe('simulation', () => {
  it('starts in a stable orbit (no input → still flying after 10 s) on most seeds', () => {
    let stable = 0;
    const N = 60;
    for (let seed = 0; seed < N; seed++) {
      const sim = createSim(seed);
      for (let i = 0; i < 10 * TICK_RATE; i++) sim.step(0);
      if (sim.outcome === 'flying') stable++;
    }
    expect(stable / N).toBeGreaterThan(0.9);
  });

  it('is deterministic: same seed + inputs → identical state', () => {
    const inputs = scriptedInputs(7, 3000);
    const a = createSim(99);
    const b = createSim(99);
    for (const i of inputs) {
      a.step(i);
      b.step(i);
    }
    expect(a.ship).toEqual(b.ship);
    expect(a.tick).toBe(b.tick);
    expect(a.score()).toBe(b.score());
  });

  it('docks when holding position inside the target zone', () => {
    const sim = createSim(5);
    const t = sim.target;
    // Teleport the ship into a co-moving spot inside the dock zone, each tick.
    const before = sim.leg;
    for (let i = 0; i <= DOCK_TICKS + 2 && sim.leg === before; i++) {
      const body = sim.system.bodies[t]!;
      sim.ship.x = sim.pos[t * 2]! + body.radius * 1.6;
      sim.ship.y = sim.pos[t * 2 + 1]!;
      sim.ship.vx = sim.vel[t * 2]!;
      sim.ship.vy = sim.vel[t * 2 + 1]!;
      sim.step(0);
    }
    expect(sim.leg).toBe(before + 1);
    expect(sim.legScores[0]).toBeGreaterThan(1000);
  });

  it('crashes into a body it flies into', () => {
    const sim = createSim(5);
    const t = sim.target;
    sim.ship.x = sim.pos[t * 2]!;
    sim.ship.y = sim.pos[t * 2 + 1]!;
    sim.step(0);
    expect(sim.outcome).toBe('crashed');
    expect(sim.crashedInto).toBe(t);
  });
});

describe('replay', () => {
  it('round-trips inputs exactly and compresses well', () => {
    const inputs = scriptedInputs(3, 10_800); // 3 minutes
    const encoded = encodeReplay(123456, inputs);
    const decoded = decodeReplay(encoded);
    expect(decoded.seed).toBe(123456);
    expect(Array.from(decoded.inputs)).toEqual(inputs);
    expect(encoded.length).toBeLessThan(3000);
  });

  it('verifyRun reproduces the live score exactly', () => {
    for (const seed of [1, 2, 3, 77, 4242]) {
      const sim = createSim(seed);
      for (const i of scriptedInputs(seed, 4000)) {
        if (sim.outcome !== 'flying') break;
        sim.step(i);
      }
      const v = verifyRun(encodeReplay(seed, sim.inputs));
      expect(v.score).toBe(sim.score());
      expect(v.outcome).toBe(sim.outcome);
      expect(v.ticks).toBe(sim.tick);
    }
  });

  it('rejects corrupt data', () => {
    expect(() => decodeReplay('AAAA')).toThrow();
    expect(() => verifyRun(encodeReplay(1, [1, 2, 3]).slice(0, -2))).toThrow();
  });

  it('plan from a regenerated system matches the live one', () => {
    const sim = createSim(31337);
    expect(generatePlan(sim.system)).toEqual(sim.plan);
    expect(sim).toBeInstanceOf(CourierSim);
  });
});

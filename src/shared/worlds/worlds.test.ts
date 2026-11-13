import { describe, expect, it } from 'vitest';
import { dcos, dsin } from './dmath';
import { bodyStates, generateSystem } from './system';
import { moonsForPlanet, TERRAIN_TYPES, worldFromSeed } from './world';

describe('dmath', () => {
  it('matches Math.sin/cos to ~1e-9 over a wide range', () => {
    for (let x = -50; x <= 50; x += 0.0137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(2e-9);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(2e-9);
    }
  });
});

describe('world generator', () => {
  it('is deterministic', () => {
    expect(worldFromSeed(1234)).toEqual(worldFromSeed(1234));
    expect(moonsForPlanet(1234)).toEqual(moonsForPlanet(1234));
  });

  it('produces a diverse set of archetypes, terrains and inhabited worlds', () => {
    const worlds = Array.from({ length: 2000 }, (_, i) => worldFromSeed(i));
    const terrains = new Set(worlds.map((w) => w.terrain));
    for (const t of TERRAIN_TYPES.filter((t) => t !== 'cratered')) expect(terrains).toContain(t);
    expect(terrains).toContain('cratered'); // barren planets
    expect(new Set(worlds.map((w) => w.archetype)).size).toBeGreaterThanOrEqual(10);
    const inhabited = worlds.filter((w) => w.cities > 0).length / worlds.length;
    expect(inhabited).toBeGreaterThan(0.2);
    expect(inhabited).toBeLessThan(0.7);
    for (const w of worlds) {
      expect(w.cities).toBeGreaterThanOrEqual(0);
      expect(w.cities).toBeLessThanOrEqual(1);
      expect(w.temperature).toBeGreaterThanOrEqual(-1);
      expect(w.temperature).toBeLessThanOrEqual(1);
    }
  });

  it('keeps moons lifeless and uninhabited', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const m of moonsForPlanet(seed)) {
        expect(m.world.life).toBe(0);
        expect(m.world.cities).toBe(0);
      }
    }
  });

  it('gives planets and moons sensible ranges', () => {
    for (let seed = 0; seed < 200; seed++) {
      const moons = moonsForPlanet(seed);
      expect(moons.length).toBeLessThanOrEqual(3);
      let prev = 1;
      for (const m of moons) {
        expect(m.world.kind).toBe('moon');
        expect(m.world.hasAtmosphere).toBe(false);
        expect(m.orbit).toBeGreaterThan(prev); // moons never overlap the planet or each other
        prev = m.orbit + m.radius;
      }
    }
  });
});

describe('star system', () => {
  it('uses the shared world + moon generator for its bodies', () => {
    const sys = generateSystem(42);
    for (const p of sys.bodies.filter((b) => b.kind === 'planet')) {
      expect(p.world).toEqual(worldFromSeed(p.seed));
      const moonSeeds = sys.bodies.filter((b) => b.parent === p.index).map((b) => b.seed);
      expect(moonSeeds).toEqual(moonsForPlanet(p.seed).map((m) => m.seed));
    }
  });

  it('keeps parents before children and everything inside the boundary', () => {
    for (let seed = 0; seed < 100; seed++) {
      const sys = generateSystem(seed);
      const pos = new Float64Array(sys.bodies.length * 2);
      const vel = new Float64Array(sys.bodies.length * 2);
      bodyStates(sys, 123.4, pos, vel);
      for (const b of sys.bodies) {
        expect(b.parent).toBeLessThan(b.index);
        const r = Math.hypot(pos[b.index * 2]!, pos[b.index * 2 + 1]!);
        expect(r).toBeLessThan(sys.boundary);
        expect(r).toBeGreaterThan(sys.star.radius * 3);
      }
    }
  });
});

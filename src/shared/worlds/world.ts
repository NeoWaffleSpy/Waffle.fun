/**
 * World generator: the single source of truth for what a planet or moon looks
 * like for a given seed. Used by Planet Forge AND by games (e.g. Gravity
 * Courier), so improving the generator here improves every project.
 *
 * Pure data, no three.js: safe to import from simulations and hub-free code.
 */
import { mulberry32 } from '../random';
import { hash32 } from './dmath';

export type WorldKind = 'planet' | 'moon';

/** Everything the planet shaders need to know about one world, derived from a seed. */
export interface WorldParams {
  seed: number;
  kind: WorldKind;
  name: string;
  biome: string;
  /** Large random offset into noise space: a different seed = a different world. */
  offset: [number, number, number];
  /** Feature frequency: low = huge continents, high = archipelagos. */
  scale: number;
  seaLevel: number;
  mountains: number;
  cloudCover: number;
  /** Atmosphere halo + rim light. Airless moons have none. */
  hasAtmosphere: boolean;
  /** 1 = glossy liquid oceans, 0 = matte lowlands (lunar maria). */
  oceanGloss: number;
  colors: {
    deep: string;
    shallow: string;
    sand: string;
    low: string;
    high: string;
    rock: string;
    snow: string;
    atmosphere: string;
  };
}

type Biome = Pick<WorldParams, 'biome' | 'seaLevel' | 'colors'>;

const PLANET_BIOMES: readonly Biome[] = [
  {
    biome: 'Temperate',
    seaLevel: 0.02,
    colors: {
      deep: '#0a2a55',
      shallow: '#1d6fa6',
      sand: '#d6c28c',
      low: '#4b8a3a',
      high: '#2c5a28',
      rock: '#6b5d52',
      snow: '#f2f5f8',
      atmosphere: '#6fb2ff',
    },
  },
  {
    biome: 'Arid',
    seaLevel: -0.18,
    colors: {
      deep: '#103848',
      shallow: '#2a8a90',
      sand: '#e6bd80',
      low: '#cf9450',
      high: '#a0602f',
      rock: '#6e4630',
      snow: '#f3e6d2',
      atmosphere: '#ffb47a',
    },
  },
  {
    biome: 'Frozen',
    seaLevel: -0.02,
    colors: {
      deep: '#12284a',
      shallow: '#3c80b2',
      sand: '#b8c8d6',
      low: '#d9e5ef',
      high: '#a8bccd',
      rock: '#7a8da2',
      snow: '#ffffff',
      atmosphere: '#bfe3ff',
    },
  },
  {
    biome: 'Alien',
    seaLevel: 0.0,
    colors: {
      deep: '#1b0a40',
      shallow: '#4c2a90',
      sand: '#d2a6e6',
      low: '#8a3fa8',
      high: '#2f8a78',
      rock: '#3d2f50',
      snow: '#e6fff0',
      atmosphere: '#d98bff',
    },
  },
  {
    biome: 'Ocean',
    seaLevel: 0.22,
    colors: {
      deep: '#04254a',
      shallow: '#1a8ab8',
      sand: '#efe0b0',
      low: '#3fa04a',
      high: '#2a7034',
      rock: '#5f5a50',
      snow: '#f5fbff',
      atmosphere: '#7ad0ff',
    },
  },
];

// Moons: no liquid; the "sea" becomes dark matte lowlands (maria).
const MOON_BIOMES: readonly Biome[] = [
  {
    biome: 'Barren',
    seaLevel: -0.22,
    colors: {
      deep: '#2c2c30',
      shallow: '#3e3e44',
      sand: '#77767a',
      low: '#8d8c90',
      high: '#a3a2a6',
      rock: '#5c5b60',
      snow: '#d8d8dc',
      atmosphere: '#000000',
    },
  },
  {
    biome: 'Icy',
    seaLevel: -0.3,
    colors: {
      deep: '#5c7a94',
      shallow: '#7f9cb5',
      sand: '#c8d8e6',
      low: '#dde8f2',
      high: '#eef4fa',
      rock: '#9fb3c6',
      snow: '#ffffff',
      atmosphere: '#000000',
    },
  },
  {
    biome: 'Rust',
    seaLevel: -0.2,
    colors: {
      deep: '#3a1f16',
      shallow: '#55301f',
      sand: '#a0603a',
      low: '#b4704a',
      high: '#c98b62',
      rock: '#6e3b28',
      snow: '#e9c9a8',
      atmosphere: '#000000',
    },
  },
];

// ---------- names ----------

const SYL_A = [
  'ka',
  've',
  'lo',
  'mi',
  'zor',
  'tha',
  'qu',
  'ri',
  'an',
  'sel',
  'or',
  'pe',
  'du',
  'xe',
  'ny',
];
const SYL_B = [
  'ra',
  'lin',
  'mar',
  'tos',
  'vex',
  'dia',
  'ron',
  'sa',
  'li',
  'nok',
  'ber',
  'ta',
  'phi',
];
const SYL_C = ['', '', 'a', 'is', 'on', 'us', 'ia', 'ex', ' Prime', ' Minor'];

/** Deterministic pronounceable name, e.g. "Zortalin", "Kavexis". */
export function nameFromSeed(seed: number): string {
  const rand = mulberry32(hash32(seed, 0x6e616d65));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] ?? arr[0]!;
  const raw = pick(SYL_A) + pick(SYL_B) + (rand() < 0.5 ? pick(SYL_B) : '') + pick(SYL_C);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ---------- worlds ----------

export function worldFromSeed(seed: number): WorldParams {
  const rand = mulberry32(seed);
  const biome = PLANET_BIOMES[Math.floor(rand() * PLANET_BIOMES.length)] ?? PLANET_BIOMES[0]!;
  const range = (min: number, max: number) => min + rand() * (max - min);
  return {
    ...biome,
    seed,
    kind: 'planet',
    name: nameFromSeed(seed),
    offset: [range(-500, 500), range(-500, 500), range(-500, 500)],
    scale: range(0.7, 1.9),
    seaLevel: biome.seaLevel + range(-0.08, 0.08),
    mountains: range(0.25, 0.9),
    cloudCover: range(0.25, 0.7),
    hasAtmosphere: true,
    oceanGloss: 1,
  };
}

export function moonFromSeed(seed: number): WorldParams {
  const rand = mulberry32(hash32(seed, 0x6d6f6f6e));
  const biome = MOON_BIOMES[Math.floor(rand() * MOON_BIOMES.length)] ?? MOON_BIOMES[0]!;
  const range = (min: number, max: number) => min + rand() * (max - min);
  return {
    ...biome,
    seed,
    kind: 'moon',
    name: nameFromSeed(seed),
    offset: [range(-500, 500), range(-500, 500), range(-500, 500)],
    scale: range(1.4, 2.6),
    seaLevel: biome.seaLevel + range(-0.08, 0.08),
    mountains: range(0.5, 1.0),
    cloudCover: 0,
    hasAtmosphere: false,
    oceanGloss: 0,
  };
}

// ---------- moons of a planet ----------

/** A moon in units of its parent planet (radius 1), so any renderer can scale it. */
export interface MoonSpec {
  seed: number;
  world: WorldParams;
  /** Moon radius relative to the planet's radius. */
  radius: number;
  /** Orbit radius in planet radii. */
  orbit: number;
  /** Starting angle (radians). */
  phase: number;
  /** +1 counter-clockwise, -1 clockwise. */
  direction: 1 | -1;
  /** Orbit tilt for 3D display (radians). Simulations in a plane ignore it. */
  tilt: number;
}

/**
 * The moons of the planet with this seed. Planet Forge and every game call this,
 * so planet #1234 has the same moons everywhere.
 */
export function moonsForPlanet(planetSeed: number): MoonSpec[] {
  const rand = mulberry32(hash32(planetSeed, 0x73617473));
  const roll = rand();
  const count = roll < 0.3 ? 0 : roll < 0.7 ? 1 : roll < 0.92 ? 2 : 3;
  const moons: MoonSpec[] = [];
  let orbit = 1.9 + rand() * 0.4;
  for (let i = 0; i < count; i++) {
    const seed = hash32(planetSeed, 1000 + i) % 1_000_000;
    moons.push({
      seed,
      world: moonFromSeed(seed),
      radius: 0.16 + rand() * 0.16,
      orbit,
      phase: rand() * 6.283185307179586,
      direction: rand() < 0.85 ? 1 : -1,
      tilt: (rand() - 0.5) * 0.5,
    });
    orbit += 0.75 + rand() * 0.6;
  }
  return moons;
}

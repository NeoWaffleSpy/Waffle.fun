/**
 * World generator: the single source of truth for what a planet or moon looks
 * like for a given seed. Used by Planet Forge AND by games (e.g. Gravity
 * Courier), so improving the generator here improves every project.
 *
 * A world = an ARCHETYPE (Terran, Desert, Jungle…) that sets its terrain SHAPE
 * and global CLIMATE. The shader then derives a BIOME per pixel from local
 * temperature (latitude + altitude + noise) and humidity (noise), Whittaker
 * style: tundra, taiga, grassland, forest, jungle, savanna, desert, ice…
 * Inhabited worlds add CITIES: grey sprawl by day, warm lights at night.
 *
 * Pure data, no three.js: safe to import from simulations and hub-free code.
 *
 * ⚠ Only the LOOK lives here. Physics (radius, mass, orbits, moon layout) is in
 * system.ts / moonsForPlanet and is snapshot-tested: don't change it casually.
 */
import { mulberry32 } from '../random';
import { hash32 } from './dmath';

export type WorldKind = 'planet' | 'moon';

/** Large-scale terrain shape. Order matters: the index is sent to the shader. */
export const TERRAIN_TYPES = [
  'continents', // a few large landmasses
  'archipelago', // many small islands
  'pangaea', // one supercontinent
  'highlands', // terraced plateaus and mesas
  'canyons', // deep winding canyon networks
  'dunes', // rolling dune seas
  'cratered', // impact craters (moons, barren worlds)
] as const;
export type TerrainType = (typeof TERRAIN_TYPES)[number];

export interface Palette {
  deep: string;
  shallow: string;
  beach: string;
  tundra: string;
  taiga: string;
  grass: string;
  forest: string;
  jungle: string;
  savanna: string;
  desert: string;
  rock: string;
  snow: string;
  /** Urban areas seen from orbit (day side). */
  city: string;
  /** Night-side city lights. */
  lights: string;
  atmosphere: string;
}

/** Everything the planet shaders need to know about one world, derived from a seed. */
export interface WorldParams {
  seed: number;
  kind: WorldKind;
  name: string;
  /** Planet type shown to players, e.g. "Jungle world". */
  archetype: string;
  terrain: TerrainType;
  /** Large random offset into noise space: a different seed = a different world. */
  offset: [number, number, number];
  /** Feature frequency: low = huge continents, high = small features. */
  scale: number;
  seaLevel: number;
  mountains: number;
  /** Domain-warp strength: 0 = smooth blobs, 1 = twisty fjord coastlines. */
  warp: number;
  /** Global climate offsets, roughly -1..1 (added to latitude/altitude effects). */
  temperature: number;
  humidity: number;
  /** 0 = lifeless (rock coloured by altitude), 1 = full vegetation biomes. */
  life: number;
  /** 0 = uninhabited, 1 = densely urbanised. */
  cities: number;
  cloudCover: number;
  /** Atmosphere halo + rim light. Airless moons have none. */
  hasAtmosphere: boolean;
  /** 1 = glossy liquid oceans, 0 = matte lowlands (lunar maria). */
  oceanGloss: number;
  colors: Palette;
}

// ---------- palettes ----------

const EARTHLIKE: Palette = {
  deep: '#0a2a55',
  shallow: '#1d6fa6',
  beach: '#d9c58f',
  tundra: '#8a8f78',
  taiga: '#2f5236',
  grass: '#6b9a3e',
  forest: '#2e6b2c',
  jungle: '#1f5a1c',
  savanna: '#a9a052',
  desert: '#d8b679',
  rock: '#6e6258',
  snow: '#f2f5f8',
  city: '#9a958c',
  lights: '#ffc56a',
  atmosphere: '#6fb2ff',
};

/** Variation on a base palette (keeps the type recognisable). */
const palette = (over: Partial<Palette>): Palette => ({ ...EARTHLIKE, ...over });

interface Archetype {
  archetype: string;
  weight: number;
  terrain: readonly TerrainType[];
  seaLevel: [number, number];
  temperature: [number, number];
  humidity: [number, number];
  life: number;
  /** Chance of being inhabited, and density range when it is. */
  cityChance: number;
  cityDensity: [number, number];
  cloudCover: [number, number];
  colors: Palette;
}

const ARCHETYPES: readonly Archetype[] = [
  {
    archetype: 'Terran',
    weight: 3,
    terrain: ['continents', 'continents', 'pangaea', 'highlands'],
    seaLevel: [-0.02, 0.08],
    temperature: [-0.15, 0.15],
    humidity: [-0.15, 0.2],
    life: 1,
    cityChance: 0.65,
    cityDensity: [0.35, 1],
    cloudCover: [0.3, 0.6],
    colors: EARTHLIKE,
  },
  {
    archetype: 'Archipelago',
    weight: 2,
    terrain: ['archipelago'],
    seaLevel: [0.12, 0.22],
    temperature: [0.1, 0.4],
    humidity: [0.2, 0.5],
    life: 1,
    cityChance: 0.5,
    cityDensity: [0.3, 0.8],
    cloudCover: [0.35, 0.65],
    colors: palette({ shallow: '#1fa0c0', beach: '#efe2b4', atmosphere: '#7ad0ff' }),
  },
  {
    archetype: 'Pangaea',
    weight: 1.5,
    terrain: ['pangaea'],
    seaLevel: [-0.05, 0.05],
    temperature: [0, 0.3],
    humidity: [-0.35, 0],
    life: 1,
    cityChance: 0.4,
    cityDensity: [0.3, 0.7],
    cloudCover: [0.2, 0.45],
    colors: EARTHLIKE,
  },
  {
    archetype: 'Desert world',
    weight: 2,
    terrain: ['dunes', 'dunes', 'canyons', 'highlands'],
    seaLevel: [-0.45, -0.25],
    temperature: [0.35, 0.7],
    humidity: [-0.9, -0.55],
    life: 0.6,
    cityChance: 0.3,
    cityDensity: [0.2, 0.6],
    cloudCover: [0.05, 0.2],
    colors: palette({
      deep: '#103848',
      shallow: '#2a8a90',
      desert: '#e2b070',
      savanna: '#c49a55',
      rock: '#8a5a3a',
      atmosphere: '#ffb47a',
    }),
  },
  {
    archetype: 'Canyon world',
    weight: 1.2,
    terrain: ['canyons'],
    seaLevel: [-0.4, -0.2],
    temperature: [0.2, 0.5],
    humidity: [-0.7, -0.35],
    life: 0.4,
    cityChance: 0.25,
    cityDensity: [0.2, 0.5],
    cloudCover: [0.05, 0.25],
    colors: palette({
      desert: '#c8754a',
      savanna: '#b98a52',
      rock: '#7a3e28',
      beach: '#d9a070',
      atmosphere: '#ff9a6a',
    }),
  },
  {
    archetype: 'Jungle world',
    weight: 1.5,
    terrain: ['continents', 'archipelago', 'highlands'],
    seaLevel: [0, 0.12],
    temperature: [0.4, 0.7],
    humidity: [0.45, 0.85],
    life: 1,
    cityChance: 0.35,
    cityDensity: [0.2, 0.6],
    cloudCover: [0.5, 0.75],
    colors: palette({ jungle: '#17501a', forest: '#236b22', atmosphere: '#8fe0b0' }),
  },
  {
    archetype: 'Ice world',
    weight: 1.5,
    terrain: ['continents', 'highlands', 'canyons'],
    seaLevel: [-0.1, 0.05],
    temperature: [-0.95, -0.6],
    humidity: [-0.2, 0.3],
    life: 0.5,
    cityChance: 0.2,
    cityDensity: [0.15, 0.4],
    cloudCover: [0.3, 0.6],
    colors: palette({
      deep: '#12284a',
      shallow: '#3c80b2',
      tundra: '#a9b3b0',
      taiga: '#4a6655',
      atmosphere: '#bfe3ff',
    }),
  },
  {
    archetype: 'Ocean world',
    weight: 1,
    terrain: ['archipelago', 'continents'],
    seaLevel: [0.25, 0.35],
    temperature: [0, 0.35],
    humidity: [0.3, 0.6],
    life: 1,
    cityChance: 0.3,
    cityDensity: [0.2, 0.5],
    cloudCover: [0.4, 0.7],
    colors: palette({ deep: '#04254a', shallow: '#1a8ab8', atmosphere: '#7ad0ff' }),
  },
  {
    archetype: 'Alien',
    weight: 1.2,
    terrain: ['continents', 'archipelago', 'highlands', 'canyons'],
    seaLevel: [-0.05, 0.12],
    temperature: [-0.1, 0.4],
    humidity: [-0.1, 0.5],
    life: 1,
    cityChance: 0.35,
    cityDensity: [0.2, 0.7],
    cloudCover: [0.25, 0.55],
    colors: palette({
      deep: '#1b0a40',
      shallow: '#4c2a90',
      beach: '#d2a6e6',
      tundra: '#7f6f8f',
      taiga: '#3a2d6a',
      grass: '#8a3fa8',
      forest: '#5a2a8a',
      jungle: '#2f8a78',
      savanna: '#b05a9a',
      desert: '#d9a0c8',
      rock: '#3d2f50',
      snow: '#e6fff0',
      city: '#9fb0c0',
      lights: '#7ff0ff',
      atmosphere: '#d98bff',
    }),
  },
  {
    archetype: 'Barren world',
    weight: 0.8,
    terrain: ['cratered', 'highlands', 'canyons'],
    seaLevel: [-0.5, -0.3],
    temperature: [-0.3, 0.3],
    humidity: [-1, -0.8],
    life: 0,
    cityChance: 0.1,
    cityDensity: [0.1, 0.3],
    cloudCover: [0, 0.1],
    colors: palette({
      deep: '#3a3530',
      shallow: '#4f4842',
      beach: '#8c8070',
      desert: '#a08a72',
      rock: '#6a5c50',
      snow: '#e0dcd6',
      atmosphere: '#c8b8a0',
    }),
  },
];

// Moons: no liquid; the "sea" becomes dark matte lowlands (maria), heavy craters.
const MOON_TYPES: readonly { archetype: string; seaLevel: number; colors: Palette }[] = [
  {
    archetype: 'Barren moon',
    seaLevel: -0.22,
    colors: palette({
      deep: '#2c2c30',
      shallow: '#3e3e44',
      beach: '#77767a',
      desert: '#8d8c90',
      rock: '#5c5b60',
      snow: '#d8d8dc',
    }),
  },
  {
    archetype: 'Icy moon',
    seaLevel: -0.3,
    colors: palette({
      deep: '#5c7a94',
      shallow: '#7f9cb5',
      beach: '#c8d8e6',
      desert: '#dde8f2',
      rock: '#9fb3c6',
      snow: '#ffffff',
    }),
  },
  {
    archetype: 'Rust moon',
    seaLevel: -0.2,
    colors: palette({
      deep: '#3a1f16',
      shallow: '#55301f',
      beach: '#a0603a',
      desert: '#b4704a',
      rock: '#6e3b28',
      snow: '#e9c9a8',
    }),
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

function pickWeighted<T extends { weight: number }>(items: readonly T[], r: number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = r * total;
  for (const item of items) {
    x -= item.weight;
    if (x <= 0) return item;
  }
  return items[items.length - 1]!;
}

export function worldFromSeed(seed: number): WorldParams {
  const rand = mulberry32(seed);
  const range = ([min, max]: readonly [number, number]) => min + rand() * (max - min);
  const a = pickWeighted(ARCHETYPES, rand());
  const terrain = a.terrain[Math.floor(rand() * a.terrain.length)] ?? 'continents';
  const inhabited = rand() < a.cityChance;
  return {
    seed,
    kind: 'planet',
    name: nameFromSeed(seed),
    archetype: a.archetype,
    terrain,
    offset: [range([-500, 500]), range([-500, 500]), range([-500, 500])],
    // Archipelagos want small features; pangaeas one huge one.
    scale:
      terrain === 'archipelago'
        ? range([1.6, 2.6])
        : terrain === 'pangaea'
          ? range([0.55, 0.8])
          : range([0.8, 1.7]),
    seaLevel: range(a.seaLevel),
    mountains: range([0.3, 0.95]),
    warp: range([0.15, 0.9]),
    temperature: range(a.temperature),
    humidity: range(a.humidity),
    life: a.life,
    cities: inhabited ? range(a.cityDensity) : 0,
    cloudCover: range(a.cloudCover),
    hasAtmosphere: true,
    oceanGloss: 1,
    colors: a.colors,
  };
}

export function moonFromSeed(seed: number): WorldParams {
  const rand = mulberry32(hash32(seed, 0x6d6f6f6e));
  const m = MOON_TYPES[Math.floor(rand() * MOON_TYPES.length)] ?? MOON_TYPES[0]!;
  const range = (min: number, max: number) => min + rand() * (max - min);
  return {
    seed,
    kind: 'moon',
    name: nameFromSeed(seed),
    archetype: m.archetype,
    terrain: rand() < 0.8 ? 'cratered' : 'highlands',
    offset: [range(-500, 500), range(-500, 500), range(-500, 500)],
    scale: range(1.4, 2.6),
    seaLevel: m.seaLevel + range(-0.08, 0.08),
    mountains: range(0.5, 1.0),
    warp: range(0.1, 0.5),
    temperature: -0.2,
    humidity: -1,
    life: 0,
    cities: 0,
    cloudCover: 0,
    hasAtmosphere: false,
    oceanGloss: 0,
    colors: m.colors,
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
 * ⚠ Physics: the random draw order here is snapshot-tested (physics.test.ts).
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

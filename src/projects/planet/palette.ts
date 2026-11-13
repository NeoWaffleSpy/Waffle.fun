import { mulberry32 } from '../../shared/random';

/** Everything the shaders need to know about one world, derived from a seed. */
export interface WorldParams {
  biome: string;
  /** Large random offset into noise space: a different seed = a different world. */
  offset: [number, number, number];
  /** Feature frequency: low = huge continents, high = archipelagos. */
  scale: number;
  seaLevel: number;
  mountains: number;
  cloudCover: number;
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

type Biome = Omit<WorldParams, 'offset' | 'scale' | 'mountains' | 'cloudCover'>;

const BIOMES: readonly Biome[] = [
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

export function worldFromSeed(seed: number): WorldParams {
  const rand = mulberry32(seed);
  const biome = BIOMES[Math.floor(rand() * BIOMES.length)] ?? BIOMES[0]!;
  const range = (min: number, max: number) => min + rand() * (max - min);
  return {
    ...biome,
    offset: [range(-500, 500), range(-500, 500), range(-500, 500)],
    scale: range(0.7, 1.9),
    seaLevel: biome.seaLevel + range(-0.08, 0.08),
    mountains: range(0.25, 0.9),
    cloudCover: range(0.25, 0.7),
  };
}

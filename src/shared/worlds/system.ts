/**
 * Star-system generator for games, built on top of the world generator.
 * Each planet's look AND its moons come from `worldFromSeed` / `moonsForPlanet`,
 * so a system planet with seed N is exactly Planet Forge's `#/planet?seed=N`.
 *
 * Deterministic: integer hashing + IEEE-exact arithmetic + dsin/dcos only.
 * Units are arbitrary game units with G = 1 (gm = G·mass).
 */
import { mulberry32 } from '../random';
import { dcos, dsin, hash32, TAU } from './dmath';
import { moonsForPlanet, nameFromSeed, type WorldParams, worldFromSeed } from './world';

export interface SystemBody {
  index: number;
  kind: 'planet' | 'moon';
  name: string;
  /** Planet Forge seed of this world. */
  seed: number;
  world: WorldParams;
  /** Index of the body it orbits; -1 = the star. Parents always come first. */
  parent: number;
  radius: number;
  gm: number;
  orbitRadius: number;
  /** Signed angular velocity (rad / s). */
  angularVelocity: number;
  phase: number;
  /** Orbit tilt for display only. */
  tilt: number;
}

export interface StarSystem {
  seed: number;
  star: { name: string; radius: number; gm: number; color: string };
  bodies: SystemBody[];
  /** Beyond this distance from the star a ship is lost. */
  boundary: number;
}

const STAR_GM = 9000;
const DENSITY = 1.3; // gm = DENSITY · r³

const STAR_COLORS = ['#ffd27a', '#ffe9b0', '#ffb36b', '#fff4e0', '#ffc896'];

export function generateSystem(seed: number): StarSystem {
  const rand = mulberry32(hash32(seed, 0x73797374));
  const bodies: SystemBody[] = [];
  const planetCount = 4 + Math.floor(rand() * 3); // 4–6
  let orbit = 70 + rand() * 25;

  for (let p = 0; p < planetCount; p++) {
    const planetSeed = hash32(seed, p + 1) % 1_000_000;
    const world = worldFromSeed(planetSeed);
    const radius = 3.6 + rand() * 3.2;
    const gm = DENSITY * radius * radius * radius;
    const planetIndex = bodies.length;
    bodies.push({
      index: planetIndex,
      kind: 'planet',
      name: world.name,
      seed: planetSeed,
      world,
      parent: -1,
      radius,
      gm,
      orbitRadius: orbit,
      // Kepler: ω = sqrt(GM / r³). Every system orbits counter-clockwise.
      angularVelocity: Math.sqrt(STAR_GM / (orbit * orbit * orbit)),
      phase: rand() * TAU,
      tilt: 0,
    });

    // Moons come straight from the shared generator (same as Planet Forge).
    for (const m of moonsForPlanet(planetSeed)) {
      const mr = m.radius * radius;
      const mo = m.orbit * radius * 1.35;
      bodies.push({
        index: bodies.length,
        kind: 'moon',
        name: m.world.name,
        seed: m.seed,
        world: m.world,
        parent: planetIndex,
        radius: mr,
        gm: DENSITY * mr * mr * mr,
        orbitRadius: mo,
        angularVelocity: m.direction * Math.sqrt(gm / (mo * mo * mo)),
        phase: m.phase,
        tilt: m.tilt,
      });
    }
    orbit *= 1.38 + rand() * 0.22;
  }

  const outermost = bodies.reduce(
    (max, b) => (b.parent === -1 ? Math.max(max, b.orbitRadius) : max),
    0,
  );
  return {
    seed,
    star: {
      name: nameFromSeed(hash32(seed, 0x73746172)),
      radius: 12,
      gm: STAR_GM,
      color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)] ?? '#ffd27a',
    },
    bodies,
    boundary: outermost * 1.35 + 80,
  };
}

/**
 * Positions and velocities of every body at time `t` (seconds), written into
 * `pos` / `vel` as [x0, y0, x1, y1, ...]. Bodies move on analytic rails, so this
 * is exact for any t: no drift, trivially deterministic.
 */
export function bodyStates(
  system: StarSystem,
  t: number,
  pos: Float64Array,
  vel: Float64Array,
): void {
  for (const b of system.bodies) {
    const a = b.phase + b.angularVelocity * t;
    const c = dcos(a);
    const s = dsin(a);
    const i = b.index * 2;
    let px = b.orbitRadius * c;
    let py = b.orbitRadius * s;
    let vx = -b.orbitRadius * b.angularVelocity * s;
    let vy = b.orbitRadius * b.angularVelocity * c;
    if (b.parent >= 0) {
      const j = b.parent * 2;
      px += pos[j]!;
      py += pos[j + 1]!;
      vx += vel[j]!;
      vy += vel[j + 1]!;
    }
    pos[i] = px;
    pos[i + 1] = py;
    vel[i] = vx;
    vel[i + 1] = vy;
  }
}

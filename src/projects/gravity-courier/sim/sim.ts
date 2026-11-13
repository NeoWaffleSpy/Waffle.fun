/**
 * Gravity Courier simulation. Fixed timestep, pure TypeScript, deterministic:
 * the same seed + the same input bytes produce the same score on every browser
 * (and on a server, for verifying leaderboard submissions).
 *
 * Rules for this folder (enforced by ESLint): no Math.sin/cos/atan2/pow/exp/log,
 * no Date/performance/random. Only + - * / sqrt, floor/round, dsin/dcos.
 */
import { dcos, dsin } from '../../../shared/worlds/dmath';
import { bodyStates, type StarSystem } from '../../../shared/worlds/system';
import {
  DOCK_SPEED,
  DOCK_TICKS,
  DT,
  dockRadius,
  FUEL_BONUS_MAX,
  FUEL_LOW,
  FUEL_MAX,
  IN_LEFT,
  IN_RIGHT,
  IN_THRUST,
  LEG_BASE_SCORE,
  LEG_PAR_TICKS,
  MAX_TICKS,
  REFUEL,
  ROT_SPEED,
  SOFTENING2,
  SUBSTEPS,
  THRUST,
  TICK_RATE,
} from './constants';
import type { RunPlan } from './plan';

export type Outcome = 'flying' | 'complete' | 'crashed' | 'lost' | 'timeout';

// Event bit flags returned by step(), for audio / UI.
export const EV_THRUST = 1;
export const EV_DOCKED = 2;
export const EV_COMPLETE = 4;
export const EV_CRASH = 8;
export const EV_LOST = 16;
export const EV_LOW_FUEL = 32;

/** Index used for "the star" in collision results. */
export const STAR = -1;
const NONE = -2;

export interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

interface Accel {
  ax: number;
  ay: number;
  hit: number;
}

/** Gravity from the star + every body at (x, y); `hit` = body we're inside, if any. */
function gravity(system: StarSystem, pos: Float64Array, x: number, y: number, out: Accel): void {
  let ax = 0;
  let ay = 0;
  let hit = NONE;
  // Star at the origin.
  let d2 = x * x + y * y;
  if (d2 < system.star.radius * system.star.radius) hit = STAR;
  let inv = 1 / Math.sqrt(d2 + SOFTENING2);
  let f = system.star.gm * inv * inv * inv;
  ax -= x * f;
  ay -= y * f;
  for (const b of system.bodies) {
    const dx = pos[b.index * 2]! - x;
    const dy = pos[b.index * 2 + 1]! - y;
    d2 = dx * dx + dy * dy;
    if (d2 < b.radius * b.radius) hit = b.index;
    inv = 1 / Math.sqrt(d2 + SOFTENING2);
    f = b.gm * inv * inv * inv;
    ax += dx * f;
    ay += dy * f;
  }
  out.ax = ax;
  out.ay = ay;
  out.hit = hit;
}

const subTime = (tick: number, sub: number): number =>
  (tick * SUBSTEPS + sub) / (TICK_RATE * SUBSTEPS);

export class CourierSim {
  readonly system: StarSystem;
  readonly plan: RunPlan;
  readonly ship: Ship;
  /** Body positions / velocities at the current tick: [x0, y0, x1, y1, ...]. */
  readonly pos: Float64Array;
  readonly vel: Float64Array;
  /** Every input byte fed so far: this IS the replay. */
  readonly inputs: number[] = [];

  tick = 0;
  fuel = FUEL_MAX;
  leg = 0;
  legStart = 0;
  dockTicks = 0;
  outcome: Outcome = 'flying';
  /** Body the ship crashed into (STAR = the star), when outcome is 'crashed'. */
  crashedInto = NONE;
  readonly legScores: number[] = [];

  private readonly acc: Accel = { ax: 0, ay: 0, hit: NONE };

  constructor(system: StarSystem, plan: RunPlan) {
    this.system = system;
    this.plan = plan;
    const n = system.bodies.length * 2;
    this.pos = new Float64Array(n);
    this.vel = new Float64Array(n);
    bodyStates(system, 0, this.pos, this.vel);

    // Start in a circular, prograde orbit just outside the start body's dock zone.
    const s = system.bodies[plan.start]!;
    const r = dockRadius(s.radius) + 3;
    const v = Math.sqrt(s.gm / r);
    this.ship = {
      x: this.pos[s.index * 2]! + r,
      y: this.pos[s.index * 2 + 1]!,
      vx: this.vel[s.index * 2]!,
      vy: this.vel[s.index * 2 + 1]! + v,
      angle: 1.5707963267948966, // facing +y = prograde (no atan2 needed)
    };
  }

  /** A method (not a property) so TypeScript doesn't over-narrow it across step() calls. */
  isFlying(): boolean {
    return this.outcome === 'flying';
  }

  get target(): number {
    return this.plan.legs[this.leg] ?? -1;
  }

  /** Advance one tick with the given input byte. Returns EV_* flags. */
  step(input: number): number {
    if (this.outcome !== 'flying') return 0;
    this.inputs.push(input & 0xff);
    let ev = 0;
    const ship = this.ship;

    if (input & IN_LEFT) ship.angle -= ROT_SPEED * DT;
    if (input & IN_RIGHT) ship.angle += ROT_SPEED * DT;

    const thrusting = (input & IN_THRUST) !== 0 && this.fuel > 0;
    let tx = 0;
    let ty = 0;
    if (thrusting) {
      this.fuel--;
      ev |= EV_THRUST;
      if (this.fuel === FUEL_LOW) ev |= EV_LOW_FUEL;
      tx = dcos(ship.angle) * THRUST;
      ty = dsin(ship.angle) * THRUST;
    }

    // Semi-implicit Euler with substeps; bodies are exact analytic rails.
    const h = DT / SUBSTEPS;
    for (let sub = 0; sub < SUBSTEPS; sub++) {
      bodyStates(this.system, subTime(this.tick, sub), this.pos, this.vel);
      gravity(this.system, this.pos, ship.x, ship.y, this.acc);
      ship.vx += (this.acc.ax + tx) * h;
      ship.vy += (this.acc.ay + ty) * h;
      ship.x += ship.vx * h;
      ship.y += ship.vy * h;
      gravity(this.system, this.pos, ship.x, ship.y, this.acc);
      if (this.acc.hit !== NONE) {
        this.crashedInto = this.acc.hit;
        this.outcome = 'crashed';
        this.tick++;
        return ev | EV_CRASH;
      }
    }
    this.tick++;
    bodyStates(this.system, this.tick / TICK_RATE, this.pos, this.vel);

    const b = this.system.boundary;
    if (ship.x * ship.x + ship.y * ship.y > b * b) {
      this.outcome = 'lost';
      return ev | EV_LOST;
    }

    ev |= this.updateDocking();

    if (this.isFlying() && this.tick >= MAX_TICKS) this.outcome = 'timeout';
    return ev;
  }

  /** Relative distance / speed to the current target (for docking + HUD). */
  relativeToTarget(): { dist: number; speed: number; dockRadius: number } {
    const t = this.system.bodies[this.target];
    if (!t) return { dist: 0, speed: 0, dockRadius: 0 };
    const dx = this.ship.x - this.pos[t.index * 2]!;
    const dy = this.ship.y - this.pos[t.index * 2 + 1]!;
    const dvx = this.ship.vx - this.vel[t.index * 2]!;
    const dvy = this.ship.vy - this.vel[t.index * 2 + 1]!;
    return {
      dist: Math.sqrt(dx * dx + dy * dy),
      speed: Math.sqrt(dvx * dvx + dvy * dvy),
      dockRadius: dockRadius(t.radius),
    };
  }

  private updateDocking(): number {
    const rel = this.relativeToTarget();
    if (rel.dockRadius === 0) return 0;
    if (rel.dist < rel.dockRadius && rel.speed < DOCK_SPEED) this.dockTicks++;
    else this.dockTicks = 0;
    if (this.dockTicks < DOCK_TICKS) return 0;

    const legTicks = this.tick - this.legStart;
    this.legScores.push(LEG_BASE_SCORE + Math.max(0, Math.floor((LEG_PAR_TICKS - legTicks) / 6)));
    this.leg++;
    this.legStart = this.tick;
    this.dockTicks = 0;
    this.fuel = Math.min(FUEL_MAX, this.fuel + REFUEL);
    if (this.leg >= this.plan.legs.length) {
      this.outcome = 'complete';
      return EV_DOCKED | EV_COMPLETE;
    }
    return EV_DOCKED;
  }

  fuelBonus(): number {
    return this.outcome === 'complete' ? Math.floor((this.fuel * FUEL_BONUS_MAX) / FUEL_MAX) : 0;
  }

  /** Integer score: legs delivered (+ time bonus) + fuel bonus if all delivered. */
  score(): number {
    return this.legScores.reduce((a, b) => a + b, 0) + this.fuelBonus();
  }
}

/**
 * The body whose gravity dominates at the ship (largest pull among planets and
 * moons), or -2 when the star dominates. Display only: picks the frame in which
 * the trajectory is drawn, so an orbit around a moving planet looks like an orbit.
 */
export function dominantBody(sim: CourierSim): number {
  const { x, y } = sim.ship;
  const starPull = sim.system.star.gm / (x * x + y * y);
  let best = NONE;
  let bestPull = 0;
  for (const b of sim.system.bodies) {
    const dx = sim.pos[b.index * 2]! - x;
    const dy = sim.pos[b.index * 2 + 1]! - y;
    const pull = b.gm / (dx * dx + dy * dy);
    if (pull > bestPull) {
      bestPull = pull;
      best = b.index;
    }
  }
  return bestPull > starPull * 0.3 ? best : NONE;
}

/**
 * Ballistic forecast (no thrust) from the current state, used for the
 * trajectory line. Writes x, y pairs every `every` ticks into `out`.
 * With `frame` ≥ 0, points are drawn relative to that body (as if it stood
 * still at its current position). Returns the point count and the body the
 * path crashes into (-2 = none).
 */
export function predictPath(
  sim: CourierSim,
  ticks: number,
  every: number,
  out: Float32Array,
  scratch: { pos: Float64Array; vel: Float64Array },
  frame = NONE,
): { count: number; hit: number } {
  const acc: Accel = { ax: 0, ay: 0, hit: NONE };
  let { x, y, vx, vy } = sim.ship;
  const h = DT / SUBSTEPS;
  const fx = frame >= 0 ? sim.pos[frame * 2]! : 0;
  const fy = frame >= 0 ? sim.pos[frame * 2 + 1]! : 0;
  let count = 0;
  out[count * 2] = x;
  out[count * 2 + 1] = y;
  count++;
  const max = out.length / 2;
  for (let i = 0; i < ticks && count < max; i++) {
    for (let sub = 0; sub < SUBSTEPS; sub++) {
      bodyStates(sim.system, subTime(sim.tick + i, sub), scratch.pos, scratch.vel);
      gravity(sim.system, scratch.pos, x, y, acc);
      vx += acc.ax * h;
      vy += acc.ay * h;
      x += vx * h;
      y += vy * h;
    }
    gravity(sim.system, scratch.pos, x, y, acc);
    if (acc.hit !== NONE || (i + 1) % every === 0) {
      out[count * 2] = frame >= 0 ? x - scratch.pos[frame * 2]! + fx : x;
      out[count * 2 + 1] = frame >= 0 ? y - scratch.pos[frame * 2 + 1]! + fy : y;
      count++;
    }
    if (acc.hit !== NONE) return { count, hit: acc.hit };
  }
  return { count, hit: NONE };
}

/** Gameplay tuning. Changing any of these changes scores: bump REPLAY_VERSION. */

export const REPLAY_VERSION = 1;

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Integration substeps per tick (accuracy near planets). */
export const SUBSTEPS = 2;

/** Ship acceleration while thrusting (units / s²). */
export const THRUST = 6;
/** Turn rate (rad / s). */
export const ROT_SPEED = 3.2;
/** Fuel is counted in ticks of thrust: integer, so it's exactly reproducible. */
export const FUEL_MAX = 1500;
export const FUEL_LOW = 300;
/** Fuel granted on each delivery. */
export const REFUEL = 525;

/** Max speed relative to the target to count as docking. */
export const DOCK_SPEED = 4.5;
/** Ticks to hold inside the dock zone (1 s). */
export const DOCK_TICKS = 60;
/** Par time per leg: finishing faster earns a bonus. */
export const LEG_PAR_TICKS = 90 * TICK_RATE;
export const LEG_BASE_SCORE = 1000;
export const FUEL_BONUS_MAX = 1500;
/** Hard cap on a run: 8 minutes. */
export const MAX_TICKS = 8 * 60 * TICK_RATE;
/** Number of deliveries in a run. */
export const LEGS = 3;

/** Gravity softening (avoids singularities very close to a centre). */
export const SOFTENING2 = 0.25;

// Input bit flags, one byte per tick.
export const IN_THRUST = 1;
export const IN_LEFT = 2;
export const IN_RIGHT = 4;

/** Radius of the docking zone around a body. */
export function dockRadius(bodyRadius: number): number {
  return bodyRadius * 2.2 + 4;
}

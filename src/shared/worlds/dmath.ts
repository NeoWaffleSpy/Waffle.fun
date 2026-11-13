/**
 * Deterministic math for simulations that must replay identically everywhere.
 *
 * IEEE-754 guarantees bit-identical results for + - * / and Math.sqrt, but NOT
 * for Math.sin/cos/tan/atan2/pow/exp/log: engines may differ in the last bits,
 * which breaks replays and server-side verification. Use these instead in any
 * code under `shared/worlds/` or a game's `sim/` folder (ESLint enforces it).
 */

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

// Taylor coefficients for sin on [-π/2, π/2] (max error ≈ 7e-10).
const S3 = -1 / 6;
const S5 = 1 / 120;
const S7 = -1 / 5040;
const S9 = 1 / 362880;
const S11 = -1 / 39916800;
const S13 = 1 / 6227020800;

export function dsin(x: number): number {
  // Reduce to [-π, π], then fold into [-π/2, π/2] using sin(π - x) = sin(x).
  let r = x - Math.round(x / TAU) * TAU;
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  const r2 = r * r;
  return r * (1 + r2 * (S3 + r2 * (S5 + r2 * (S7 + r2 * (S9 + r2 * (S11 + r2 * S13))))));
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

/** 32-bit integer hash of two values (deterministic, Math.imul only). */
export function hash32(a: number, b = 0): number {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** FNV-1a string hash → uint32. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

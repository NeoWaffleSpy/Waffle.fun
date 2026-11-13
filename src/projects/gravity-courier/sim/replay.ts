/**
 * Replay codec. A run is just its seed + one input byte per tick, run-length
 * encoded with varints: a 3-minute run (10 800 ticks) is typically 1–3 KB,
 * small enough for localStorage, a URL, or a leaderboard submission.
 *
 * Layout: [version u8][seed u32 LE][tickCount varint]([input u8][runLength varint])*
 * then base64url.
 */
import { REPLAY_VERSION } from './constants';

export interface Replay {
  version: number;
  seed: number;
  inputs: Uint8Array;
}

function pushVarint(out: number[], n: number): void {
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

function readVarint(buf: Uint8Array, at: { i: number }): number {
  let result = 0;
  let shift = 0;
  for (;;) {
    if (at.i >= buf.length) throw new Error('Truncated replay');
    const byte = buf[at.i++]!;
    result += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) return result;
    shift += 7;
    if (shift > 28) throw new Error('Varint too long');
  }
}

function toBase64Url(bytes: number[]): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeReplay(seed: number, inputs: ArrayLike<number>): string {
  const out: number[] = [
    REPLAY_VERSION,
    seed & 0xff,
    (seed >>> 8) & 0xff,
    (seed >>> 16) & 0xff,
    (seed >>> 24) & 0xff,
  ];
  pushVarint(out, inputs.length);
  let i = 0;
  while (i < inputs.length) {
    const value = inputs[i]! & 0xff;
    let run = 1;
    while (i + run < inputs.length && inputs[i + run] === value) run++;
    out.push(value);
    pushVarint(out, run);
    i += run;
  }
  return toBase64Url(out);
}

const MAX_REPLAY_TICKS = 1_000_000;

export function decodeReplay(encoded: string): Replay {
  const buf = fromBase64Url(encoded);
  if (buf.length < 6) throw new Error('Replay too short');
  const version = buf[0]!;
  const seed = (buf[1]! | (buf[2]! << 8) | (buf[3]! << 16) | (buf[4]! << 24)) >>> 0;
  const at = { i: 5 };
  const total = readVarint(buf, at);
  if (total > MAX_REPLAY_TICKS) throw new Error('Replay too long');
  const inputs = new Uint8Array(total);
  let filled = 0;
  while (filled < total) {
    if (at.i >= buf.length) throw new Error('Truncated replay');
    const value = buf[at.i++]!;
    const run = readVarint(buf, at);
    if (run === 0 || filled + run > total) throw new Error('Corrupt replay');
    inputs.fill(value, filled, filled + run);
    filled += run;
  }
  return { version, seed, inputs };
}

/**
 * Waffle Tower game engine: pure TypeScript + Canvas 2D. No React, no three.js.
 * The React layer owns the lifecycle; this module owns the per-frame state so
 * the hot loop never triggers React renders.
 */

export const STAGE_W = 360;
const LAYER_H = 22;
const BASE_W = 200;
const PERFECT_TOLERANCE = 4;
const GRAVITY = 1400;

interface Layer {
  x: number;
  w: number;
  hue: number;
}

interface Moving extends Layer {
  dir: 1 | -1;
  speed: number;
}

interface Debris extends Layer {
  y: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
}

export type Phase = 'ready' | 'playing' | 'over';

export interface DropResult {
  phase: Phase;
  score: number;
  perfect: boolean;
}

export interface EngineOptions {
  reducedMotion: boolean;
}

export class TowerEngine {
  private layers: Layer[] = [];
  private moving: Moving | null = null;
  private debris: Debris[] = [];
  private camY = 0;
  private streak = 0;
  private lastFlash = 0;
  phase: Phase = 'ready';
  drops = 0;
  startedAt = 0;

  private readonly opts: EngineOptions;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.reset();
  }

  get score(): number {
    return this.layers.length - 1;
  }

  reset(): void {
    this.layers = [{ x: (STAGE_W - BASE_W) / 2, w: BASE_W, hue: 36 }];
    this.moving = null;
    this.debris = [];
    this.camY = 0;
    this.streak = 0;
    this.drops = 0;
    this.phase = 'ready';
  }

  start(now: number): void {
    this.reset();
    this.phase = 'playing';
    this.startedAt = now;
    this.spawn();
  }

  private top(): Layer {
    return this.layers[this.layers.length - 1]!;
  }

  private spawn(): void {
    const prev = this.top();
    const fromLeft = this.layers.length % 2 === 0;
    this.moving = {
      x: fromLeft ? -prev.w * 0.6 : STAGE_W - prev.w * 0.4,
      w: prev.w,
      hue: 36 + ((this.layers.length * 7) % 24) - 12,
      dir: fromLeft ? 1 : -1,
      speed: Math.min(130 + this.score * 7, 380),
    };
  }

  /** Player input. */
  drop(now: number): DropResult {
    const m = this.moving;
    if (this.phase !== 'playing' || !m) {
      return { phase: this.phase, score: this.score, perfect: false };
    }
    this.drops++;
    const prev = this.top();
    let perfect = false;

    if (Math.abs(m.x - prev.x) <= PERFECT_TOLERANCE) {
      perfect = true;
      this.streak++;
      // Reward streaks by growing the waffle back a little.
      const grow = this.streak >= 3 ? 6 : 0;
      const w = Math.min(prev.w + grow, BASE_W);
      this.layers.push({ x: prev.x - (w - prev.w) / 2, w, hue: m.hue });
      this.lastFlash = now;
    } else {
      this.streak = 0;
      const left = Math.max(m.x, prev.x);
      const right = Math.min(m.x + m.w, prev.x + prev.w);
      const overlap = right - left;
      const y = this.layers.length * LAYER_H;
      if (overlap <= 0) {
        this.addDebris({ x: m.x, w: m.w, hue: m.hue }, y, m.dir);
        this.moving = null;
        this.phase = 'over';
        return { phase: 'over', score: this.score, perfect: false };
      }
      const cutX = m.x < prev.x ? m.x : right;
      this.addDebris({ x: cutX, w: m.w - overlap, hue: m.hue }, y, m.x < prev.x ? -1 : 1);
      this.layers.push({ x: left, w: overlap, hue: m.hue });
    }
    this.spawn();
    return { phase: 'playing', score: this.score, perfect };
  }

  private addDebris(piece: Layer, y: number, dir: number): void {
    if (this.opts.reducedMotion) return;
    this.debris.push({ ...piece, y, vy: 0, vx: dir * 40, rot: 0, vr: dir * (1 + Math.random()) });
  }

  /** Advance simulation. Returns true while anything is still moving. */
  update(dt: number): boolean {
    let active = false;
    const m = this.moving;
    if (m && this.phase === 'playing') {
      m.x += m.dir * m.speed * dt;
      const minX = -m.w * 0.6;
      const maxX = STAGE_W - m.w * 0.4;
      if (m.x > maxX) {
        m.x = maxX;
        m.dir = -1;
      } else if (m.x < minX) {
        m.x = minX;
        m.dir = 1;
      }
      active = true;
    }

    for (const d of this.debris) {
      d.vy -= GRAVITY * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.rot += d.vr * dt;
    }
    this.debris = this.debris.filter((d) => d.y > this.camY - 400);
    if (this.debris.length) active = true;

    const target = Math.max(0, (this.layers.length - 8) * LAYER_H);
    if (this.opts.reducedMotion) {
      this.camY = target;
    } else {
      const diff = target - this.camY;
      this.camY += diff * Math.min(1, dt * 6);
      if (Math.abs(diff) > 0.5) active = true;
      else this.camY = target;
    }
    return active;
  }

  draw(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, now: number): void {
    const scale = Math.min(cssW / STAGE_W, cssH / 560);
    const offsetX = (cssW - STAGE_W * scale) / 2;
    const groundY = cssH / scale - 70; // logical units

    // Sky darkens as the tower grows: altitude feedback for free.
    const alt = Math.min(this.camY / 2000, 1);
    const sky = ctx.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, `hsl(${String(215 + alt * 40)} 55% ${String(68 - alt * 52)}%)`);
    sky.addColorStop(1, `hsl(${String(30 + alt * 200)} 70% ${String(86 - alt * 60)}%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.save();
    ctx.translate(offsetX, 0);
    ctx.scale(scale, scale);

    const toScreen = (y: number) => groundY - y + this.camY;

    // Plate
    const plateY = toScreen(0);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(STAGE_W / 2, plateY + 6, 150, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    const firstVisible = Math.max(0, Math.floor((this.camY - 60) / LAYER_H));
    for (let i = firstVisible; i < this.layers.length; i++) {
      const l = this.layers[i]!;
      drawWaffle(ctx, l.x, toScreen((i + 1) * LAYER_H), l.w, l.hue);
    }

    const m = this.moving;
    if (m) drawWaffle(ctx, m.x, toScreen((this.layers.length + 1) * LAYER_H), m.w, m.hue);

    for (const d of this.debris) {
      ctx.save();
      const cy = toScreen(d.y + LAYER_H) + LAYER_H / 2;
      ctx.translate(d.x + d.w / 2, cy);
      ctx.rotate(d.rot);
      drawWaffle(ctx, -d.w / 2, -LAYER_H / 2, d.w, d.hue);
      ctx.restore();
    }

    // "Perfect!" flash
    const since = now - this.lastFlash;
    if (since < 600 && this.phase === 'playing') {
      ctx.globalAlpha = 1 - since / 600;
      ctx.fillStyle = '#fff';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Perfect!', STAGE_W / 2, toScreen((this.layers.length + 2) * LAYER_H) - 6);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

/** Procedural waffle: rounded slab + grid of pockets. No sprite needed. */
function drawWaffle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hue: number) {
  if (w <= 0.5) return;
  const h = LAYER_H;
  const r = Math.min(6, w / 2);
  ctx.fillStyle = `hsl(${String(hue)} 78% 56%)`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = `hsl(${String(hue - 4)} 70% 40%)`;
  const cell = 9;
  const gap = 3;
  const cols = Math.floor((w - gap) / (cell + gap));
  if (cols > 0) {
    const used = cols * (cell + gap) - gap;
    const startX = x + (w - used) / 2;
    for (let c = 0; c < cols; c++) {
      ctx.fillRect(startX + c * (cell + gap), y + 3, cell, 6.5);
      ctx.fillRect(startX + c * (cell + gap), y + 12.5, cell, 6.5);
    }
  }
  ctx.strokeStyle = `hsl(${String(hue - 6)} 65% 32%)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

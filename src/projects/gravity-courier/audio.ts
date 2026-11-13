/**
 * Every sound is synthesized with Web Audio: zero audio files downloaded.
 * The context is created lazily on the first user gesture (browser policy).
 */
export class CourierAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: GainNode | null = null;
  private thrusting = false;
  private muted = false;

  /** Call from a user gesture (click / keydown). */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext as typeof AudioContext | undefined;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // Engine: looping brown-ish noise through a low-pass filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const engine = ctx.createGain();
    engine.gain.value = 0;
    noise.connect(filter).connect(engine).connect(master);
    noise.start();

    this.ctx = ctx;
    this.master = master;
    this.engine = engine;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  setThrust(on: boolean): void {
    if (on === this.thrusting || !this.engine || !this.ctx) return;
    this.thrusting = on;
    this.engine.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, on ? 0.04 : 0.1);
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.25,
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  docked(): void {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      this.tone(f, i * 0.09, 0.35, 'triangle');
    });
  }

  complete(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, i * 0.12, 0.6, 'triangle', 0.3);
    });
  }

  lowFuel(): void {
    this.tone(880, 0, 0.12, 'square', 0.08);
    this.tone(880, 0.18, 0.12, 'square', 0.08);
  }

  crash(): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.8;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.6;
    src.connect(g).connect(this.master);
    src.start();
    this.tone(90, 0, 0.6, 'sawtooth', 0.2);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.engine = null;
  }
}

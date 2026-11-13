import { IN_LEFT, IN_RIGHT, IN_THRUST } from './sim/constants';

const KEYMAP: Record<string, number> = {
  ArrowUp: IN_THRUST,
  KeyW: IN_THRUST,
  Space: IN_THRUST,
  ArrowLeft: IN_LEFT,
  KeyA: IN_LEFT,
  ArrowRight: IN_RIGHT,
  KeyD: IN_RIGHT,
};

/**
 * Collects held keys + on-screen touch buttons into the one input byte the sim
 * consumes each tick.
 */
export class InputState {
  private keys = 0;
  private touch = 0;

  get byte(): number {
    return this.keys | this.touch;
  }

  setTouch(bit: number, on: boolean): void {
    this.touch = on ? this.touch | bit : this.touch & ~bit;
  }

  clear(): void {
    this.keys = 0;
    this.touch = 0;
  }

  /** Returns true if the key is a flight control (caller may preventDefault). */
  key(code: string, down: boolean): boolean {
    const bit = KEYMAP[code];
    if (bit === undefined) return false;
    this.keys = down ? this.keys | bit : this.keys & ~bit;
    return true;
  }
}

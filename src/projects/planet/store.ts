import { create } from 'zustand';
import { prefersReducedMotion } from '../../shared/hooks/usePrefersReducedMotion';
import { randomSeed } from '../../shared/random';

/** User tweaks on top of the seed's generated values (reset on a new seed). */
export interface Tweaks {
  seaShift: number;
  tempShift: number;
  humidShift: number;
}

const NO_TWEAKS: Tweaks = { seaShift: 0, tempShift: 0, humidShift: 0 };

/** State private to this project. No other project imports it. */
interface PlanetState extends Tweaks {
  seed: number;
  autoRotate: boolean;
  showMoons: boolean;
  setSeed: (seed: number) => void;
  newSeed: () => void;
  setAutoRotate: (on: boolean) => void;
  setTweak: (key: keyof Tweaks, value: number) => void;
  resetTweaks: () => void;
  setShowMoons: (on: boolean) => void;
}

export const usePlanetStore = create<PlanetState>()((set) => ({
  seed: randomSeed(),
  // Respect reduced motion: start still; the user can opt in.
  autoRotate: !prefersReducedMotion(),
  showMoons: true,
  ...NO_TWEAKS,
  setSeed: (seed) => {
    set({ seed, ...NO_TWEAKS });
  },
  newSeed: () => {
    set({ seed: randomSeed(), ...NO_TWEAKS });
  },
  setAutoRotate: (autoRotate) => {
    set({ autoRotate });
  },
  setTweak: (key, value) => {
    set({ [key]: value });
  },
  resetTweaks: () => {
    set(NO_TWEAKS);
  },
  setShowMoons: (showMoons) => {
    set({ showMoons });
  },
}));

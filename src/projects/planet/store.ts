import { create } from 'zustand';
import { prefersReducedMotion } from '../../shared/hooks/usePrefersReducedMotion';
import { randomSeed } from '../../shared/random';

/** State private to this project. No other project imports it. */
interface PlanetState {
  seed: number;
  autoRotate: boolean;
  /** User offset added to the seed's sea level. */
  seaShift: number;
  showMoons: boolean;
  setSeed: (seed: number) => void;
  newSeed: () => void;
  setAutoRotate: (on: boolean) => void;
  setSeaShift: (v: number) => void;
  setShowMoons: (on: boolean) => void;
}

export const usePlanetStore = create<PlanetState>()((set) => ({
  seed: randomSeed(),
  // Respect reduced motion: start still; the user can opt in.
  autoRotate: !prefersReducedMotion(),
  seaShift: 0,
  setSeed: (seed) => {
    set({ seed, seaShift: 0 });
  },
  newSeed: () => {
    set({ seed: randomSeed(), seaShift: 0 });
  },
  setAutoRotate: (autoRotate) => {
    set({ autoRotate });
  },
  setSeaShift: (seaShift) => {
    set({ seaShift });
  },
  showMoons: true,
  setShowMoons: (showMoons) => {
    set({ showMoons });
  },
}));

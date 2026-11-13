import { create } from 'zustand';
import type { Phase } from './engine';

/** UI-facing state only. Per-frame game state lives in the engine, not React. */
interface TowerState {
  phase: Phase;
  score: number;
  setPhase: (phase: Phase) => void;
  setScore: (score: number) => void;
}

export const useTowerStore = create<TowerState>()((set) => ({
  phase: 'ready',
  score: 0,
  setPhase: (phase) => {
    set({ phase });
  },
  setScore: (score) => {
    set({ score });
  },
}));

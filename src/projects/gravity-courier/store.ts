import { create } from 'zustand';
import type { Outcome } from './sim/sim';

export type Phase = 'menu' | 'playing' | 'over';
export type Mode = 'daily' | 'random';

/** Throttled snapshot of the run for the HUD (the sim itself never lives in React). */
export interface Hud {
  fuel: number; // 0..1
  leg: number;
  legs: number;
  targetName: string;
  targetKind: 'planet' | 'moon';
  dist: number;
  relSpeed: number;
  dockSpeedOk: boolean;
  dockProgress: number; // 0..1
  inZone: boolean;
  seconds: number;
  score: number;
  /** Body the trajectory line is drawn relative to. */
  frameName: string;
}

export interface RunResult {
  outcome: Outcome;
  score: number;
  legScores: number[];
  fuelBonus: number;
  seconds: number;
  crashedInto: string | null;
  replay: string;
  ticks: number;
  isBest: boolean;
}

interface CourierState {
  phase: Phase;
  mode: Mode;
  seed: number;
  /** Incremented to (re)start a run with the current seed. */
  runId: number;
  paused: boolean;
  mapView: boolean;
  muted: boolean;
  hud: Hud | null;
  result: RunResult | null;
  setMode: (mode: Mode, seed: number) => void;
  start: () => void;
  finish: (result: RunResult) => void;
  toMenu: () => void;
  setPaused: (p: boolean) => void;
  toggleMap: () => void;
  setMuted: (m: boolean) => void;
  setHud: (hud: Hud) => void;
}

export const useCourierStore = create<CourierState>()((set) => ({
  phase: 'menu',
  mode: 'daily',
  seed: 0,
  runId: 0,
  paused: false,
  mapView: false,
  muted: false,
  hud: null,
  result: null,
  setMode: (mode, seed) => {
    set({ mode, seed });
  },
  start: () => {
    set((s) => ({
      phase: 'playing',
      runId: s.runId + 1,
      paused: false,
      mapView: false,
      result: null,
      hud: null,
    }));
  },
  finish: (result) => {
    set({ phase: 'over', result, paused: false });
  },
  toMenu: () => {
    set({ phase: 'menu', paused: false, mapView: false, result: null, hud: null });
  },
  setPaused: (paused) => {
    set({ paused });
  },
  toggleMap: () => {
    set((s) => ({ mapView: !s.mapView }));
  },
  setMuted: (muted) => {
    set({ muted });
  },
  setHud: (hud) => {
    set({ hud });
  },
}));

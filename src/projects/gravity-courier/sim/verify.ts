/**
 * Headless re-simulation of a replay: the anti-cheat primitive.
 *
 * Today it powers ghosts. When a backend arrives, the server runs exactly this
 * (it has no DOM/three.js dependencies) on a submitted replay and stores the
 * score IT computed, never the score the client claims.
 */
import { generateSystem } from '../../../shared/worlds/system';
import { REPLAY_VERSION } from './constants';
import { generatePlan } from './plan';
import { decodeReplay } from './replay';
import { CourierSim, type Outcome } from './sim';

export interface VerifiedRun {
  seed: number;
  score: number;
  outcome: Outcome;
  ticks: number;
  legs: number;
}

export function createSim(seed: number): CourierSim {
  const system = generateSystem(seed);
  return new CourierSim(system, generatePlan(system));
}

export function verifyRun(encoded: string): VerifiedRun {
  const replay = decodeReplay(encoded);
  if (replay.version !== REPLAY_VERSION)
    throw new Error(`Unsupported replay version ${String(replay.version)}`);
  const sim = createSim(replay.seed);
  for (const input of replay.inputs) {
    if (sim.outcome !== 'flying') break;
    sim.step(input);
  }
  return {
    seed: replay.seed,
    score: sim.score(),
    outcome: sim.outcome,
    ticks: sim.tick,
    legs: sim.leg,
  };
}

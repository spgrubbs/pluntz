import type { World } from './types';
import { makeRng } from './rng';

/**
 * Save/resume: the sim is plain data except for the rng closures, whose
 * mulberry32 internal state is a single u32 — swap them for their state on
 * save and rebuild them on load. Because makeRng(state) resumes the exact
 * sequence, a loaded world continues deterministically.
 */
export interface SavedWorld {
  rngState: number;
  plantRngStates: number[];
  world: unknown;
}

export function worldToSave(world: World): SavedWorld {
  const { rng, plants, events, ...rest } = world;
  return {
    rngState: rng.state(),
    plantRngStates: plants.map((p) => p.rng.state()),
    world: {
      ...rest,
      plants: plants.map(({ rng: _r, ...p }) => p),
      events: [],
    },
  };
}

export function worldFromSave(saved: SavedWorld): World {
  const raw = saved.world as World & { plants: Omit<World['plants'][number], 'rng'>[] };
  return {
    ...raw,
    rng: makeRng(saved.rngState),
    plants: raw.plants.map((p, i) => ({
      ...p,
      rng: makeRng(saved.plantRngStates[i] ?? 1),
    })),
    events: [],
  } as World;
}

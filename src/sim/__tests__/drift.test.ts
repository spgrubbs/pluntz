import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, launchHeir, hashWorld } from '../world';
import { buyDriftMutation } from '../stats';
import { colonyMods } from '../stats';
import { TUNING } from '../../content/tuning';
import type { MapDef, World } from '../types';

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

const driftMap: MapDef = {
  id: 'drf',
  name: 'drf',
  width: 2000,
  height: 1400,
  sun: { angleDeg: 270, cycle: false, cyclePeriodSec: 240 },
  drift: true,
  asteroids: [
    { x: -400, y: 0, r: 80 }, // home
    { x: 380, y: 0, r: 80 }, // landfall
  ],
  colonies: [{ name: 'Line', faction: 'pinophyta', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

describe('The Drift — follow-the-propagule mode (GDD §15)', () => {
  it('the starting plant is the first Heir', () => {
    const w = createWorld(driftMap, 3);
    expect(w.drift).toBe(true);
    expect(w.colonies[0].heirPlantId).toBe(w.plants[0].id);
    expect(w.colonies[0].heirSeedId).toBe(-1);
  });

  it('launchHeir flings a followed Heir Seed once the garden has energy', () => {
    const w = createWorld(driftMap, 3);
    w.debrisPerMin = 0;
    // a drained garden can't launch
    w.plants[0].energy = 1;
    expect(launchHeir(w, w.colonies[0].id, { x: 380, y: 0 })).toBe(false);
    run(w, 600); // grow the garden
    w.plants[0].energy = 55; // a matured garden has banked energy to launch
    const ok = launchHeir(w, w.colonies[0].id, { x: 380, y: 0 });
    expect(ok).toBe(true);
    const seed = w.seeds.find((s) => s.id === w.colonies[0].heirSeedId);
    expect(seed).toBeDefined();
    expect(seed!.heir).toBe(true);
  });

  it('a landed Heir founds the next garden and retires the old one to Legacy', () => {
    const w = createWorld(driftMap, 7);
    w.debrisPerMin = 0;
    run(w, 600);
    const homeId = w.colonies[0].heirPlantId;
    w.plants[0].energy = 55;
    expect(launchHeir(w, w.colonies[0].id, { x: 380, y: 0 })).toBe(true);
    // let the seed cross and root
    run(w, 400);
    const colony = w.colonies[0];
    // the heir moved to a new plant, and the old home retired into Legacy
    expect(colony.heirPlantId).not.toBe(homeId);
    expect(colony.heirSeedId).toBe(-1);
    const home = w.plants.find((p) => p.id === homeId)!;
    expect(home.legacy).toBe(true);
    // the retired garden trickles Legacy to the lineage
    const before = colony.legacy;
    run(w, 300);
    expect(colony.legacy).toBeGreaterThan(before);
  });

  it('the mutation shop spends Legacy and applies a strand mod', () => {
    const w = createWorld(driftMap, 3);
    const c = w.colonies[0];
    // can't afford it broke
    expect(buyDriftMutation(w, c.id, 'drift_longshot')).toBe(false);
    c.legacy = 500;
    expect(buyDriftMutation(w, c.id, 'drift_longshot')).toBe(true);
    expect(c.mutations).toContain('drift_longshot');
    expect(colonyMods(c).seedRange).toBeGreaterThan(1);
    // costs scale: a second buy of the same card is refused (already owned)
    expect(buyDriftMutation(w, c.id, 'drift_longshot')).toBe(false);
  });

  it('stays deterministic: same seed, same hash after a launch', () => {
    const build = (): World => {
      const w = createWorld(driftMap, 11);
      w.debrisPerMin = 0;
      run(w, 600);
      w.plants[0].energy = 55;
      launchHeir(w, w.colonies[0].id, { x: 380, y: 0 });
      run(w, 500);
      return w;
    };
    expect(hashWorld(build())).toBe(hashWorld(build()));
  });
});

import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt, setPing } from '../world';
import { DEV01 } from '../../content/maps/dev01';
import { TUNING } from '../../content/tuning';
import type { MapDef } from '../types';

const TWIN_MAP: MapDef = {
  id: 'twin',
  name: 'twin',
  width: 1600,
  height: 1200,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  asteroids: [
    { x: 0, y: 0, r: 90 },
    { x: 500, y: 0, r: 80 },
  ],
  colonies: [{ name: 'P', faction: 'pinophyta', player: true }],
  spawns: [
    { asteroid: 0, anchorDeg: -90, colony: 0 },
    { asteroid: 0, anchorDeg: 90, colony: 0 },
  ],
};

describe('reproduction (M4)', () => {
  it('a mature colony cones up, fires, and the seed sprouts a new plant', () => {
    const w = createWorld(DEV01, 7);
    w.debrisPerMin = 0; // keep the run clean
    const before = w.plants.length;
    for (let i = 0; i < 7000; i++) {
      stepWorld(w, TUNING.simDt);
      if (w.plants.length > before) break;
    }
    expect(w.plants.length).toBeGreaterThan(before);
    const sprouted = w.plants[w.plants.length - 1];
    expect(sprouted.alive).toBe(true);
    expect(sprouted.colonyId).toBe(w.plants[0].colonyId);
    expect(sprouted.asteroidId).not.toBe(w.plants[0].asteroidId); // spread out
  });

  it('sprouting fails when the spot is crowded (minSpacing)', () => {
    const w = createWorld(DEV01, 7);
    const ast = w.asteroids[1]; // empty rock
    const colonyId = w.colonies[0].id;
    expect(sproutAt(w, colonyId, 'pinophyta', ast, 0)).toBe(true);
    expect(sproutAt(w, colonyId, 'pinophyta', ast, 0.1)).toBe(false); // ~7u away
    expect(sproutAt(w, colonyId, 'pinophyta', ast, Math.PI)).toBe(true); // far side
  });

  it('colony pool: thriving plants feed struggling siblings', () => {
    const w = createWorld(TWIN_MAP, 11);
    w.debrisPerMin = 0;
    for (let i = 0; i < 2000; i++) stepWorld(w, TUNING.simDt);
    const [a, b] = w.plants;
    a.energy = a.capacity; // flush donor
    b.energy = 0;
    // b is at zero but income-positive (it's lit), so no starvation race here
    for (let i = 0; i < 100; i++) stepWorld(w, TUNING.simDt);
    expect(b.energy).toBeGreaterThan(3);
  });

  it('ping expires after 60 seconds', () => {
    const w = createWorld(DEV01, 7);
    setPing(w, w.colonies[0].id, { x: 100, y: 100 });
    expect(w.ping).not.toBeNull();
    for (let i = 0; i < 620; i++) stepWorld(w, TUNING.simDt);
    expect(w.ping).toBeNull();
  });
});

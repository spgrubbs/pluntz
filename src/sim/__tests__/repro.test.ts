import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt, setPing, spawnDebris } from '../world';
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

  it('substrate sharing: a rich neighbor feeds a poor one within range', () => {
    const w = createWorld(TWIN_MAP, 11);
    w.debrisPerMin = 0;
    for (let i = 0; i < 2000; i++) stepWorld(w, TUNING.simDt);
    const [a, b] = w.plants; // both on rock 0, anchors ~180u apart (< shareRange)
    a.energy = a.capacity; // flush donor
    b.energy = 0;
    // b is at zero but income-positive (it's lit), so no starvation race here
    for (let i = 0; i < 100; i++) stepWorld(w, TUNING.simDt);
    expect(b.energy).toBeGreaterThan(3);
  });

  it('substrate sharing does NOT reach distant outposts', () => {
    const w = createWorld(TWIN_MAP, 11);
    w.debrisPerMin = 0;
    for (let i = 0; i < 500; i++) stepWorld(w, TUNING.simDt);
    // plant a far outpost on the second rock (500u away)
    const colonyId = w.colonies[0].id;
    expect(sproutAt(w, colonyId, 'pinophyta', w.asteroids[1], Math.PI)).toBe(true);
    const outpost = w.plants[w.plants.length - 1];
    w.plants[0].energy = w.plants[0].capacity;
    outpost.energy = 1;
    const gained = outpost.energy;
    // one tick: no sharing link can have fed it (its own income may add a little)
    stepWorld(w, TUNING.simDt);
    expect(outpost.energy - gained).toBeLessThan(1); // no 6/s flow jump
  });

  it('a seed can ride drifting debris and colonize where it crashes', () => {
    const w = createWorld(DEV01, 7);
    w.debrisPerMin = 0;
    w.debris.length = 0;
    const target = w.asteroids[3]; // some far rock
    // a debris drifting toward that rock, and a seed placed on the debris
    const from = { x: target.pos.x - 400, y: target.pos.y };
    const speed = 90;
    const vx = ((target.pos.x - from.x) / 400) * speed;
    const vy = ((target.pos.y - from.y) / 400) * speed;
    spawnDebris(w, from, { x: vx, y: vy }, 10);
    const rock = w.debris[0];
    const before = w.plants.length;
    w.seeds.push({
      id: w.nextId++,
      colonyId: w.colonies[0].id,
      faction: 'pinophyta',
      pos: { x: rock.pos.x, y: rock.pos.y },
      vel: { x: 0, y: 0 },
      age: 0,
      maxAge: 0.1, // would fizzle almost immediately if it weren't riding
      riding: -1,
      ridingFauna: -1,
      ignoreAst: -1,
    });
    // the seed's own maxAge (0.1s) would fizzle it in flight; only by mounting
    // the debris and riding to impact can it reach and colonize the far rock
    for (let i = 0; i < 400 && w.plants.length === before; i++) stepWorld(w, TUNING.simDt);
    expect(w.plants.length).toBeGreaterThan(before);
    expect(w.plants[w.plants.length - 1].asteroidId).toBe(target.id);
  });

  it('ping expires after 60 seconds', () => {
    const w = createWorld(DEV01, 7);
    setPing(w, w.colonies[0].id, { x: 100, y: 100 });
    expect(w.ping).not.toBeNull();
    for (let i = 0; i < 620; i++) stepWorld(w, TUNING.simDt);
    expect(w.ping).toBeNull();
  });
});

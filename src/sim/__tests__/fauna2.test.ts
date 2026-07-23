import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, hashWorld, placeLure } from '../world';
import { TUNING } from '../../content/tuning';
import type { MapDef, World } from '../types';

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

const TITANS: MapDef = {
  id: 'titans',
  name: 'titans',
  width: 2200,
  height: 1600,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  fauna: { frugivora: 0, phytophaga: 1, anthophila: 1, scarabaeidae: 1, araneae: 1, lampyridae: 1 },
  asteroids: [
    { x: 0, y: 0, r: 95 },
    { x: 640, y: -220, r: 80 },
  ],
  colonies: [{ name: 'Bloom', faction: 'anthophyta', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

describe('new fauna (13.4)', () => {
  it('a Scarabaeidae shoves an asteroid across the void', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    const starts = w.asteroids.map((a) => ({ x: a.pos.x, y: a.pos.y }));
    // long enough for at least one full shove (rest <=8s + travel + 22s push)
    run(w, 1200);
    const moved = w.asteroids.some(
      (a, i) => Math.hypot(a.pos.x - starts[i].x, a.pos.y - starts[i].y) > 15,
    );
    expect(moved).toBe(true);
    // the garden survives the ride: plants stay anchored to their moving rock
    const plant = w.plants[0];
    const home = w.asteroids.find((a) => a.id === plant.asteroidId)!;
    expect(plant.astPos.x).toBeCloseTo(home.pos.x, 5);
    expect(plant.alive).toBe(true);
  });

  it('a shoved rock never gets pushed into another rock', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    run(w, 3000);
    for (let i = 0; i < w.asteroids.length; i++) {
      for (let j = i + 1; j < w.asteroids.length; j++) {
        const a = w.asteroids[i];
        const b = w.asteroids[j];
        expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThan(
          a.radius + b.radius,
        );
      }
    }
  });

  it('an Araneae nests in a grown plant and kills fauna that stray close', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    let ticks = 0;
    const spider = w.fauna.find((f) => f.kind === 'araneae')!;
    // step just until the vine is grown enough for the spider to move in
    while (spider.state !== 'nest' && ticks < 3000) {
      stepWorld(w, TUNING.simDt);
      ticks++;
    }
    expect(spider.state).toBe('nest');
    const host = w.plants.find((p) => p.id === spider.targetPlant)!;
    // walk a grazer straight into the web (if it hasn't been eaten already)
    const grazer = w.fauna.find((f) => f.kind === 'phytophaga')!;
    expect(grazer).toBeDefined();
    const perch = {
      x: host.astPos.x + host.parts[host.trunkTip].tip.x,
      y: host.astPos.y + host.parts[host.trunkTip].tip.y,
    };
    grazer.state = 'graze';
    grazer.targetPlant = host.id;
    grazer.satiety = 0;
    grazer.pos = { x: perch.x + 20, y: perch.y };
    run(w, 300); // 30s in the spider's parlor
    expect(w.fauna.some((f) => f.kind === 'phytophaga')).toBe(false);
    expect(w.faunaRespawns.some((r) => r.kind === 'phytophaga')).toBe(true);
  });

  it('moving rocks stay deterministic: same seed, same hash', () => {
    const a = createWorld(TITANS, 23);
    const b = createWorld(TITANS, 23);
    run(a, 1500);
    run(b, 1500);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });

  it('a Lampyridae parked over a shaded leaf lights it up', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    w.fauna = w.fauna.filter((f) => f.kind === 'lampyridae' || f.kind === 'anthophila');
    run(w, 1500);
    const plant = w.plants[0];
    const dark = plant.parts.find((p) => !p.dead && p.kind === 'leaf' && p.shade > 0);
    expect(dark).toBeDefined();
    const lamp = w.fauna.find((f) => f.kind === 'lampyridae')!;
    lamp.pos = { x: plant.astPos.x + dark!.tip.x, y: plant.astPos.y + dark!.tip.y };
    lamp.vel = { x: 0, y: 0 };
    stepWorld(w, TUNING.simDt);
    expect(dark!.shade).toBe(0); // bathed in lantern light
  });

  it('the lure is universal: it tugs a nesting spider off its host', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    const spider = w.fauna.find((f) => f.kind === 'araneae')!;
    let ticks = 0;
    while (spider.state !== 'nest' && ticks++ < 3000) stepWorld(w, TUNING.simDt);
    expect(spider.state).toBe('nest');
    const far = w.asteroids[1];
    placeLure(w, w.colonies[0].id, { x: far.pos.x, y: far.pos.y });
    run(w, 10);
    expect(spider.state).toBe('wander'); // evicted
    const d0 = Math.hypot(spider.pos.x - far.pos.x, spider.pos.y - far.pos.y);
    run(w, 150);
    const d1 = Math.hypot(spider.pos.x - far.pos.x, spider.pos.y - far.pos.y);
    expect(d1).toBeLessThan(d0); // and drawn toward the scent
  });

  it('seeds hitch rides on scarabs and hop off at the next rock', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    const scarab = w.fauna.find((f) => f.kind === 'scarabaeidae')!;
    // park the titan in open space and toss a seed onto its shell
    scarab.pos = { x: -300, y: 600 };
    scarab.vel = { x: 0, y: 0 };
    scarab.state = 'wander';
    scarab.timer = 999; // no shove: we drive it by hand
    w.seeds.push({
      id: w.nextId++,
      colonyId: w.colonies[0].id,
      faction: 'anthophyta',
      pos: { x: scarab.pos.x + 4, y: scarab.pos.y },
      vel: { x: 0, y: 0 },
      age: 0,
      maxAge: 3,
      riding: -1,
      ridingFauna: -1,
      heir: false,
      steers: 0,
      ignoreAst: w.asteroids[0].id,
    });
    stepWorld(w, TUNING.simDt);
    const seed = w.seeds[w.seeds.length - 1];
    expect(seed.ridingFauna).toBe(scarab.id); // mounted
    // carry it to the empty second rock; the seed should hop off and sprout
    const dest = w.asteroids[1];
    scarab.pos = { x: dest.pos.x - dest.radius - 20, y: dest.pos.y };
    stepWorld(w, TUNING.simDt);
    expect(w.plants.some((p) => p.asteroidId === dest.id)).toBe(true);
  });

  it('webs never snare a Scarabaeidae', () => {
    const w = createWorld(TITANS, 11);
    w.debrisPerMin = 0;
    const spider = w.fauna.find((f) => f.kind === 'araneae')!;
    let ticks = 0;
    while (spider.state !== 'nest' && ticks++ < 3000) stepWorld(w, TUNING.simDt);
    const host = w.plants.find((p) => p.id === spider.targetPlant)!;
    const perch = {
      x: host.astPos.x + host.parts[host.trunkTip].tip.x,
      y: host.astPos.y + host.parts[host.trunkTip].tip.y,
    };
    const scarab = w.fauna.find((f) => f.kind === 'scarabaeidae')!;
    // remove other snareable fauna, park the titan in the web's face
    w.fauna = w.fauna.filter((f) => f.kind === 'araneae' || f.kind === 'scarabaeidae');
    scarab.pos = { x: perch.x + 10, y: perch.y };
    scarab.state = 'wander';
    run(w, 20);
    expect(spider.webPrey).toBe(-1);
  });
});

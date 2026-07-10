import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, placeLure } from '../world';
import { TUNING } from '../../content/tuning';
import type { MapDef, World } from '../types';

const GARDEN: MapDef = {
  id: 'garden',
  name: 'garden',
  width: 1800,
  height: 1400,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  fauna: { frugivora: 2, phytophaga: 1, anthophila: 3 },
  asteroids: [
    { x: 0, y: 0, r: 95 },
    { x: 560, y: -180, r: 80 },
    { x: -520, y: 300, r: 70 },
  ],
  colonies: [{ name: 'Bloom', faction: 'anthophyta', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

const run = (w: World, ticks: number): void => {
  for (let i = 0; i < ticks; i++) stepWorld(w, TUNING.simDt);
};

describe('Anthophyta & fauna (M7)', () => {
  it('vines hug the rock instead of towering', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    run(w, 2500);
    const plant = w.plants[0];
    expect(plant.parts.length).toBeGreaterThan(40);
    let maxHeight = 0;
    const r = w.asteroids[0].radius;
    for (const p of plant.parts) {
      if (p.dead || p.kind !== 'stem') continue;
      maxHeight = Math.max(maxHeight, Math.hypot(p.tip.x, p.tip.y) - r);
    }
    expect(maxHeight).toBeLessThan(95); // a Pinophyta spire reaches ~120+
  });

  it('flowers ripen into fruit and Frugivora deliver seeds to new rocks', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    let delivered = false;
    for (let i = 0; i < 9000 && !delivered; i++) {
      stepWorld(w, TUNING.simDt);
      delivered = w.plants.length > 1;
    }
    expect(delivered).toBe(true);
    const sprout = w.plants[w.plants.length - 1];
    expect(sprout.faction).toBe('anthophyta');
  });

  it('a grazing Phytophaga chews through leaves', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    run(w, 1200); // let leaves exist
    const plant = w.plants[0];
    const grazer = w.fauna.find((f) => f.kind === 'phytophaga')!;
    const leaf = plant.parts.find((p) => !p.dead && p.kind === 'leaf')!;
    grazer.state = 'graze';
    grazer.targetPlant = plant.id;
    grazer.targetPart = leaf.id;
    grazer.satiety = 0.2; // hungry
    grazer.pos = {
      x: plant.astPos.x + leaf.tip.x,
      y: plant.astPos.y + leaf.tip.y,
    };
    const hp0 = leaf.hp;
    run(w, 20); // 2s of nibbling
    expect(leaf.dead || leaf.hp < hp0).toBe(true);
  });

  it('a lure pulls a grazing beetle off its current meal', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    // two rocks with vines so there is somewhere else to be lured to
    run(w, 1500);
    const grazer = w.fauna.find((f) => f.kind === 'phytophaga')!;
    const home = w.plants[0];
    // force it grazing the home plant
    grazer.state = 'graze';
    grazer.targetPlant = home.id;
    grazer.satiety = 0.2;
    grazer.pos = { ...home.astPos };
    // drop a lure far away, off toward rock 2
    const far = w.asteroids[2];
    placeLure(w, w.colonies[0].id, far.pos);
    run(w, 200); // 20s
    // it should have abandoned home and be near the lured rock (or grazing there)
    expect(Math.hypot(grazer.pos.x - far.pos.x, grazer.pos.y - far.pos.y)).toBeLessThan(
      Math.hypot(home.astPos.x - far.pos.x, home.astPos.y - far.pos.y),
    );
  });

  it('a stuffed grazer stops eating and wanders off', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    run(w, 1500);
    const grazer = w.fauna.find((f) => f.kind === 'phytophaga')!;
    const home = w.plants[0];
    grazer.state = 'graze';
    grazer.targetPlant = home.id;
    grazer.satiety = 0.98; // nearly full
    run(w, 40); // it tops off then must leave
    expect(grazer.state).toBe('wander');
  });

  it('lure places the scent marker, cools down, and expires', () => {
    const w = createWorld(GARDEN, 7);
    const c = w.colonies[0];
    expect(placeLure(w, c.id, { x: 100, y: 50 })).toBe(true);
    expect(w.lure).not.toBeNull();
    expect(placeLure(w, c.id, { x: 0, y: 0 })).toBe(false); // cooling
    run(w, 450); // 45s > 40s lifetime
    expect(w.lure).toBeNull();
  });

  it('pollinated flowers charge faster than lonely ones', () => {
    const w1 = createWorld(GARDEN, 7);
    const w2 = createWorld(GARDEN, 7);
    for (const w of [w1, w2]) w.debrisPerMin = 0;
    w2.fauna = w2.fauna.filter((f) => f.kind !== 'anthophila'); // no pollinators
    const firstFlowerAt = (w: World): number => {
      for (let i = 0; i < 9000; i++) {
        stepWorld(w, TUNING.simDt);
        for (const p of w.plants[0].parts) {
          if (!p.dead && p.kind === 'cone' && p.armedAt >= 0) return w.tick;
        }
      }
      return Infinity;
    };
    const withBees = firstFlowerAt(w1);
    const without = firstFlowerAt(w2);
    expect(withBees).toBeLessThanOrEqual(without);
  });
});

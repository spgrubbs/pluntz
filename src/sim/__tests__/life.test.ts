import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, spawnDebris } from '../world';
import { damagePart, pruneAlongPath } from '../plant';
import { DEV01 } from '../../content/maps/dev01';
import { TUNING } from '../../content/tuning';
import { add, norm, scale, sub } from '../vec';
import type { World, Plant } from '../types';

function grownWorld(ticks = 3000): World {
  const w = createWorld(DEV01, 7);
  for (let i = 0; i < ticks; i++) stepWorld(w, TUNING.simDt);
  return w;
}

const aliveCount = (p: Plant): number => p.parts.filter((x) => !x.dead).length;

describe('death & husks', () => {
  it('killing the heart kills the whole colony into a husk', () => {
    const w = grownWorld(1000);
    const plant = w.plants[0];
    damagePart(plant, 0, 9999);
    expect(plant.alive).toBe(false);
    expect(plant.parts.every((p) => p.dead)).toBe(true);
  });

  it('a fully shaded colony starves to death through the cascade', () => {
    const w = grownWorld();
    const plant = w.plants[0];
    // giant umbrella rock between colony and sun
    const home = w.asteroids[0];
    const blocker = w.asteroids[2];
    blocker.radius = 400;
    blocker.pos.x = home.pos.x + Math.cos(w.sun.angle) * 600;
    blocker.pos.y = home.pos.y + Math.sin(w.sun.angle) * 600;
    plant.energy = 0; // skip the reserve drain, straight to starvation
    w.colonies[0].reserve = 0; // and empty the colony pool it would sip from

    // needles wither first
    for (let i = 0; i < 300; i++) stepWorld(w, TUNING.simDt); // 30s
    expect(plant.totalLeaves).toBe(0);
    expect(plant.alive).toBe(true); // wood holds longer

    // then wood, then the heart
    for (let i = 0; i < 2600; i++) stepWorld(w, TUNING.simDt);
    expect(plant.alive).toBe(false);
  });

  it('debris damages what it hits (bark may hold, but it costs hp)', () => {
    const w = grownWorld();
    w.debrisPerMin = 0; // no ambient spawns muddying the assertion
    w.debris.length = 0; // and none left over from the grow-up phase
    const plant = w.plants[0];
    const hpSum = (): number =>
      plant.parts.reduce((n, p) => n + (p.dead ? 0 : p.hp), 0);
    const before = hpSum();
    const ast = w.asteroids[0];
    // fire a heavy rock straight at the crown
    const crown = add(ast.pos, plant.parts[plant.trunkTip].tip);
    const from = { x: crown.x, y: crown.y - 300 };
    spawnDebris(w, from, scale(norm(sub(crown, from)), 80), 12);
    for (let i = 0; i < 100; i++) stepWorld(w, TUNING.simDt);
    // natural needle drop can also lower the sum; the impact must at minimum
    // have landed: debris gone and hp strictly below the pre-impact total
    expect(hpSum()).toBeLessThan(before);
    expect(w.debris.length).toBe(0); // shattered on impact
  });
});

describe('prune', () => {
  it('cuts the subtree, refunds energy, and the trunk regrows', () => {
    const w = grownWorld();
    const plant = w.plants[0];
    const ast = w.asteroids[0];
    plant.energy = 10; // low, so the refund is visible

    // swipe horizontally through a mid-trunk segment
    const target = plant.parts.find(
      (p) => p.kind === 'stem' && !p.onBranch && p.depth === 7 && !p.dead,
    )!;
    const mid = add(ast.pos, {
      x: (target.base.x + target.tip.x) / 2,
      y: (target.base.y + target.tip.y) / 2,
    });
    const res = pruneAlongPath(w, plant, [
      { x: mid.x - 40, y: mid.y },
      { x: mid.x + 40, y: mid.y },
    ]);

    expect(res.cut).toBeGreaterThan(1); // the segment plus its subtree
    expect(res.refund).toBeGreaterThan(0);
    expect(plant.energy).toBeGreaterThan(10);
    expect(plant.alive).toBe(true);
    expect(plant.parts[target.id].dead).toBe(true);
    // trunk tip repaired below the cut
    expect(plant.parts[plant.trunkTip].dead).toBe(false);
    expect(plant.trunkSegs).toBeLessThan(7);

    // and the spire regrows through the wound
    const cutAlive = aliveCount(plant);
    const cutSegs = plant.trunkSegs;
    for (let i = 0; i < 1200; i++) stepWorld(w, TUNING.simDt);
    expect(aliveCount(plant)).toBeGreaterThan(cutAlive);
    expect(plant.trunkSegs).toBeGreaterThan(cutSegs);
  });

  it('the heart is uncuttable', () => {
    const w = grownWorld(600);
    const plant = w.plants[0];
    const ast = w.asteroids[0];
    const heart = add(ast.pos, plant.parts[0].base);
    pruneAlongPath(w, plant, [
      { x: heart.x - 30, y: heart.y },
      { x: heart.x + 30, y: heart.y },
    ]);
    expect(plant.alive).toBe(true);
    expect(plant.parts[0].dead).toBe(false);
  });
});

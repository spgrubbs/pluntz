import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../world';
import { damagePart } from '../plant';
import { CONTACT01 } from '../../content/maps/contact01';
import { TUNING } from '../../content/tuning';
import type { MapDef, World, Plant } from '../types';

/** Two rival colonies planted nearly on top of each other on one rock. */
const CLASH_MAP: MapDef = {
  id: 'clash',
  name: 'clash',
  width: 1600,
  height: 1200,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  asteroids: [{ x: 0, y: 0, r: 90 }],
  colonies: [
    { name: 'A', faction: 'pinophyta', player: true, palette: 0 },
    { name: 'B', faction: 'pinophyta', palette: 1 },
  ],
  spawns: [
    { asteroid: 0, anchorDeg: -105, colony: 0 },
    { asteroid: 0, anchorDeg: -75, colony: 1 },
  ],
};

const colonyPlants = (w: World, idx: number): Plant[] =>
  w.plants.filter((p) => p.colonyId === w.colonies[idx].id);

describe('competition (M5)', () => {
  it('overgrowth contact damages both rival canopies', () => {
    const w = createWorld(CLASH_MAP, 7);
    w.debrisPerMin = 0;
    for (let i = 0; i < 4000; i++) stepWorld(w, TUNING.simDt);
    const woundedOrDead = (ps: Plant[]): number =>
      ps.reduce(
        (n, pl) => n + pl.parts.filter((p) => p.dead || p.hp < p.maxHp * 0.95).length,
        0,
      );
    expect(woundedOrDead(colonyPlants(w, 0))).toBeGreaterThan(0);
    expect(woundedOrDead(colonyPlants(w, 1))).toBeGreaterThan(0);
  });

  it('domination: killing every rival heart wins the round', () => {
    const w = createWorld(CONTACT01, 7);
    for (let i = 0; i < 100; i++) stepWorld(w, TUNING.simDt);
    for (const p of colonyPlants(w, 1)) damagePart(p, 0, 9999);
    for (let i = 0; i < 20; i++) stepWorld(w, TUNING.simDt);
    expect(w.roundState).toBe('won');
    expect(w.endedAt).toBeGreaterThan(0);
  });

  it('losing every player heart loses the round', () => {
    const w = createWorld(CONTACT01, 7);
    for (let i = 0; i < 100; i++) stepWorld(w, TUNING.simDt);
    for (const p of colonyPlants(w, 0)) damagePart(p, 0, 9999);
    for (let i = 0; i < 20; i++) stepWorld(w, TUNING.simDt);
    expect(w.roundState).toBe('lost');
  });

  it('sudden death dims the sun and income with it', () => {
    const w = createWorld(CONTACT01, 7);
    w.roundSec = 5; // fast-forward the timer
    for (let i = 0; i < 600; i++) stepWorld(w, TUNING.simDt); // 60s: 55s into the ramp
    expect(w.sunFactor).toBeLessThan(0.8);
    expect(w.sunFactor).toBeGreaterThan(0.1);
  });

  it('seeds bruise rival growth they strike', () => {
    const w = createWorld(CLASH_MAP, 7);
    w.debrisPerMin = 0;
    for (let i = 0; i < 1500; i++) stepWorld(w, TUNING.simDt);
    const rival = colonyPlants(w, 1)[0];
    const n0 = rival.parts.length; // growth during flight must not mask the hit
    // hp *deficit* is immune to bark-hardening noise (it raises hp & maxHp equally)
    const hpSum = (): number =>
      rival.parts.slice(0, n0).reduce((n, p) => n - (p.dead ? p.maxHp : p.maxHp - p.hp), 0);
    // fire a player seed straight down at the rival crown
    const crown = {
      x: rival.astPos.x + rival.parts[rival.trunkTip].tip.x,
      y: rival.astPos.y + rival.parts[rival.trunkTip].tip.y,
    };
    const before = hpSum();
    w.seeds.push({
      id: w.nextId++,
      colonyId: w.colonies[0].id,
      faction: 'pinophyta',
      pos: { x: crown.x, y: crown.y - 120 },
      vel: { x: 0, y: 95 },
      age: 0,
      maxAge: 5,
      riding: -1,
      ridingFauna: -1,
      heir: false,
      steers: 0,
      ignoreAst: -1,
    });
    for (let i = 0; i < 30; i++) stepWorld(w, TUNING.simDt);
    // (other colonies may have seeds in flight; ours resolved within maxAge)
    expect(hpSum()).toBeLessThan(before);
  });
});

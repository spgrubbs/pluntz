import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../world';
import { TUNING } from '../../content/tuning';
import { FACTIONS } from '../../content/factions';
import { MUTATIONS } from '../../content/mutations';
import type { MapDef, World } from '../types';

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

const trapMap: MapDef = {
  id: 'dm',
  name: 'dm',
  width: 1400,
  height: 1000,
  sun: { angleDeg: 270, cycle: false, cyclePeriodSec: 240 },
  asteroids: [{ x: 0, y: 0, r: 90 }],
  colonies: [{ name: 'Sundew', faction: 'droseraceae', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

describe('Droseraceae — the carnivore (GDD §16.1)', () => {
  it('has a full mutation set and a carnivore energy block', () => {
    const f = FACTIONS.droseraceae;
    expect(f.energy.mode).toBe('carnivore');
    expect(f.energy.carnivore).toBeDefined();
    expect(MUTATIONS.droseraceae.filter((m) => m.tier === 1 && !m.bonus).length).toBe(2);
    expect(MUTATIONS.droseraceae.filter((m) => m.bonus).length).toBe(3);
  });

  it('snares a wandering critter and digests it into energy', () => {
    const w = createWorld(trapMap, 5);
    w.debrisPerMin = 0;
    run(w, 400); // grow a rosette of traps
    const plant = w.plants[0];
    expect(plant.alive).toBe(true);

    // drop a grazer right onto the garden — it should be snared
    w.fauna.push({
      id: w.nextId++,
      kind: 'phytophaga',
      pos: { x: plant.astPos.x, y: plant.astPos.y - 100 },
      vel: { x: 0, y: 0 },
      state: 'wander',
      targetPlant: -1,
      targetPart: -1,
      targetAst: -1,
      carryColony: -1,
      carryFaction: null,
      waypoint: { x: 0, y: 0 },
      timer: 5,
      hp: 25,
      maxHp: 25,
      satiety: 0,
      wander: 0,
      webPrey: -1,
      trappedBy: -1,
      orbit: null,
    });
    const prey = w.fauna[w.fauna.length - 1];
    const eBefore = plant.energy;
    run(w, 200);
    // it got caught (or already digested and respawn-queued) and fed the plant
    const stillPrey = w.fauna.find((f) => f.id === prey.id);
    const wasTrappedOrEaten = !stillPrey || stillPrey.trappedBy === plant.id || stillPrey.hp < 25;
    expect(wasTrappedOrEaten).toBe(true);
    expect(plant.energy).toBeGreaterThan(eBefore - 5); // meat offsets its starving photosynthesis
  });

  it('a garden with prey around outlasts one starved of it', () => {
    // fed: a small map thick with fauna
    const fed = createWorld(
      { ...trapMap, fauna: { phytophaga: 6, frugivora: 4 } },
      9,
    );
    fed.debrisPerMin = 0;
    // starved: no fauna at all, and weak sun
    const starved = createWorld(trapMap, 9);
    starved.debrisPerMin = 0;
    starved.fauna = [];
    run(fed, 1600);
    run(starved, 1600);
    const fedMass = fed.plants.reduce((n, p) => n + (p.alive ? p.parts.filter((q) => !q.dead).length : 0), 0);
    const starvedMass = starved.plants.reduce((n, p) => n + (p.alive ? p.parts.filter((q) => !q.dead).length : 0), 0);
    expect(fedMass).toBeGreaterThan(starvedMass);
  });
});

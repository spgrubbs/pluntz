import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../world';
import { chooseMutation } from '../stats';
import { pruneAlongPath } from '../plant';
import { MUTATIONS, MUTATION_TIMING } from '../../content/mutations';
import { CONTACT01 } from '../../content/maps/contact01';
import { TUNING } from '../../content/tuning';
import { add } from '../vec';
import type { MapDef, World } from '../types';

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

const GARDEN: MapDef = {
  id: 'mgarden',
  name: 'mgarden',
  width: 1800,
  height: 1400,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  fauna: { frugivora: 0, phytophaga: 1, anthophila: 0 },
  asteroids: [
    { x: 0, y: 0, r: 95 },
    { x: 560, y: -180, r: 80 },
  ],
  colonies: [{ name: 'Bloom', faction: 'anthophyta', player: true }],
  spawns: [{ asteroid: 0, anchorDeg: -90, colony: 0 }],
};

describe('time-gated mutations (13.3)', () => {
  it('the clock deals offers: AI picks instantly, the player holds two cards', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    run(w, Math.ceil((MUTATION_TIMING.firstAt + 2) / TUNING.simDt));
    const player = w.colonies.find((c) => c.isPlayer)!;
    const ai = w.colonies.find((c) => !c.isPlayer)!;
    expect(player.pendingOffer).toHaveLength(2);
    expect(player.mutations).toHaveLength(0);
    expect(ai.mutations).toHaveLength(1);
    expect(ai.pendingOffer).toBeNull();
  });

  it('choosing applies the mutation and schedules the next offer', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    run(w, Math.ceil((MUTATION_TIMING.firstAt + 2) / TUNING.simDt));
    const player = w.colonies.find((c) => c.isPlayer)!;
    expect(chooseMutation(w, player.id, 'not-on-offer')).toBe(false);
    const pick = player.pendingOffer![0];
    expect(chooseMutation(w, player.id, pick)).toBe(true);
    expect(player.mutations).toContain(pick);
    expect(player.pendingOffer).toBeNull();
    expect(player.nextMutationAt).toBeCloseTo(w.time + MUTATION_TIMING.interval, 1);
  });

  it('tier gating: maxTier 1 only ever offers tier-1 cards, then runs dry', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    const player = w.colonies.find((c) => c.isPlayer)!;
    const tier1 = MUTATIONS[player.faction].filter((m) => m.tier === 1).map((m) => m.id);
    for (let round = 0; round < 2; round++) {
      while (!player.pendingOffer && w.time < 1e5) run(w, 50);
      for (const id of player.pendingOffer!) expect(tier1).toContain(id);
      chooseMutation(w, player.id, player.pendingOffer![0]);
    }
    // both tier-1 mutations owned; the pool is dry at this depth
    run(w, Math.ceil((MUTATION_TIMING.interval + 5) / TUNING.simDt));
    expect(player.pendingOffer).toBeNull();
    expect(player.mutations).toHaveLength(2);
  });

  it('deeper tiers unlock when maxTier rises', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    const player = w.colonies.find((c) => c.isPlayer)!;
    player.maxTier = 3;
    const owned = new Set<string>();
    for (let round = 0; round < 4; round++) {
      while (!player.pendingOffer && w.time < 1e5) run(w, 50);
      chooseMutation(w, player.id, player.pendingOffer![0]);
    }
    for (const id of player.mutations) owned.add(id);
    const tiers = MUTATIONS[player.faction]
      .filter((m) => owned.has(m.id))
      .map((m) => m.tier);
    expect(Math.max(...tiers)).toBeGreaterThan(1); // dug past tier 1
  });

  it('succulence: pruning a living vine sows seeds instead of just wounds', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    w.fauna = []; // no grazer interference
    run(w, 1500);
    const plant = w.plants[0];
    const colony = w.colonies[0];
    colony.mutations.push('succulence');
    const stem = plant.parts.find((p) => !p.dead && p.kind === 'stem' && p.depth > 1)!;
    const mid = add(plant.astPos, {
      x: (stem.base.x + stem.tip.x) / 2,
      y: (stem.base.y + stem.tip.y) / 2,
    });
    const before = w.seeds.length;
    const res = pruneAlongPath(w, plant, [
      { x: mid.x - 30, y: mid.y },
      { x: mid.x + 30, y: mid.y },
    ]);
    expect(res.cut).toBeGreaterThan(0);
    expect(w.seeds.length).toBeGreaterThan(before);
  });

  it('thorns kill a stubborn grazer, and a replacement is scheduled', () => {
    const w = createWorld(GARDEN, 7);
    w.debrisPerMin = 0;
    run(w, 1500);
    const plant = w.plants[0];
    w.colonies[0].mutations.push('thornvine');
    const grazer = w.fauna.find((f) => f.kind === 'phytophaga')!;
    grazer.hp = 5;
    grazer.state = 'graze';
    grazer.targetPlant = plant.id;
    grazer.satiety = 0; // stays hungry through the pain
    const leaf = plant.parts.find((p) => !p.dead && p.kind === 'leaf')!;
    grazer.pos = { x: plant.astPos.x + leaf.tip.x, y: plant.astPos.y + leaf.tip.y };
    run(w, 60); // 6s of bleeding on the thorns
    expect(w.fauna.some((f) => f.kind === 'phytophaga')).toBe(false);
    expect(w.faunaRespawns).toHaveLength(1);
    // and the respawn eventually hatches a fresh grazer
    run(w, Math.ceil(80 / TUNING.simDt));
    expect(w.fauna.some((f) => f.kind === 'phytophaga')).toBe(true);
    expect(w.faunaRespawns).toHaveLength(0);
  });

  it('virulent infection rots faster than the baseline', () => {
    const worlds = [0, 1].map(() => {
      const w = createWorld(CONTACT01, 7);
      w.debrisPerMin = 0;
      run(w, 600);
      return w;
    });
    worlds[1].colonies[0].mutations.push('virulence');
    const deficits: number[] = [];
    for (const w of worlds) {
      const attacker = w.colonies[0];
      const victim = w.plants.find((p) => p.colonyId !== attacker.id)!;
      const target = victim.parts.find((p) => !p.dead && p.kind === 'stem')!;
      target.infectedBy = attacker.id;
      const hp0 = target.hp;
      run(w, 100); // 10s of rot
      deficits.push(hp0 - target.hp);
    }
    expect(deficits[1]).toBeGreaterThan(deficits[0] * 1.5);
  });
});

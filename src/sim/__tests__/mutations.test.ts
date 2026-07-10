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

  it('drafts run 1..3 in order, two base cards each, then the colony is done', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    const player = w.colonies.find((c) => c.isPlayer)!;
    for (let draft = 1; draft <= 3; draft++) {
      while (!player.pendingOffer && w.time < 1e5) run(w, 50);
      const expected = MUTATIONS[player.faction]
        .filter((m) => m.tier === draft && !m.bonus)
        .map((m) => m.id);
      expect(player.pendingOffer!.slice().sort()).toEqual(expected.slice().sort());
      chooseMutation(w, player.id, player.pendingOffer![0]);
    }
    // all three keeps made; no fourth draft ever arrives
    run(w, Math.ceil((MUTATION_TIMING.interval + 5) / TUNING.simDt));
    expect(player.pendingOffer).toBeNull();
    expect(player.mutations).toHaveLength(3);
  });

  it('wins widen drafts: bonusDepth adds the third card to drafts 1..depth', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    const player = w.colonies.find((c) => c.isPlayer)!;
    player.bonusDepth = 1; // one win with this clade
    // draft 1 deals three cards, including the win-unlocked bonus
    while (!player.pendingOffer && w.time < 1e5) run(w, 50);
    expect(player.pendingOffer).toHaveLength(3);
    const bonus1 = MUTATIONS[player.faction].find((m) => m.tier === 1 && m.bonus)!;
    expect(player.pendingOffer).toContain(bonus1.id);
    chooseMutation(w, player.id, player.pendingOffer![0]);
    // draft 2 is still a plain two-card deal at depth 1
    while (!player.pendingOffer && w.time < 1e5) run(w, 50);
    expect(player.pendingOffer).toHaveLength(2);
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

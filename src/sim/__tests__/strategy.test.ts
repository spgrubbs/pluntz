import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt, computeCanopyControl } from '../world';
import { buyTrait, bless, colonyMods } from '../stats';
import { damagePart } from '../plant';
import { CONTACT01 } from '../../content/maps/contact01';
import { TUNING } from '../../content/tuning';

describe('strategy layer (M6)', () => {
  it('buyTrait spends essence, applies mods, and rejects the unaffordable', () => {
    const w = createWorld(CONTACT01, 7);
    const c = w.colonies[0];
    c.essence = 4;
    expect(buyTrait(w, c.id, 'longshot')).toBe(false); // costs 5
    expect(buyTrait(w, c.id, 'swiftcones')).toBe(true); // costs 4
    expect(c.essence).toBe(0);
    expect(buyTrait(w, c.id, 'swiftcones')).toBe(false); // already owned
    expect(colonyMods(c).chargeRate).toBeGreaterThan(colonyMods(w.colonies[1]).chargeRate);
  });

  it('instinct sliders shift the mods', () => {
    const w = createWorld(CONTACT01, 7);
    const c = w.colonies[0];
    c.instincts.expand = 1;
    c.instincts.vertical = 1;
    const aggressive = colonyMods(c);
    c.instincts.expand = 0;
    c.instincts.vertical = 0;
    const defensive = colonyMods(c);
    expect(aggressive.chargeRate).toBeGreaterThan(defensive.chargeRate);
    expect(defensive.partHp).toBeGreaterThan(aggressive.partHp);
    expect(aggressive.trunkTargetMult).toBeGreaterThan(defensive.trunkTargetMult);
  });

  it('colonizing a fresh rock pays the essence bonus', () => {
    const w = createWorld(CONTACT01, 7);
    const c = w.colonies[0];
    const before = c.essence;
    expect(sproutAt(w, c.id, 'pinophyta', w.asteroids[3], 0)).toBe(true);
    expect(c.essence).toBe(before + TUNING.essence.newRockBonus);
    // second sprout on the same rock: no bonus
    expect(sproutAt(w, c.id, 'pinophyta', w.asteroids[3], Math.PI)).toBe(true);
    expect(c.essence).toBe(before + TUNING.essence.newRockBonus);
  });

  it('a rival plant death pays essence to the other colonies', () => {
    const w = createWorld(CONTACT01, 7);
    for (let i = 0; i < 50; i++) stepWorld(w, TUNING.simDt);
    const player = w.colonies[0];
    const before = player.essence;
    const rivalPlant = w.plants.find((p) => p.colonyId === w.colonies[1].id)!;
    damagePart(rivalPlant, 0, 9999);
    for (let i = 0; i < 5; i++) stepWorld(w, TUNING.simDt);
    expect(player.essence).toBeGreaterThanOrEqual(before + TUNING.essence.rivalDeathBonus);
  });

  it('bless costs essence and accelerates growth', () => {
    const w = createWorld(CONTACT01, 7);
    const plant = w.plants[0];
    const c = w.colonies[0];
    c.essence = 10;
    expect(bless(w, plant)).toBe(true);
    expect(c.essence).toBe(10 - TUNING.verbs.blessCost);
    expect(plant.blessedUntil).toBeGreaterThan(0);
    expect(bless(w, plant)).toBe(false); // already surging
  });

  it('canopy control: the sole surviving colony holds the light and wins', () => {
    const w = createWorld(CONTACT01, 7);
    w.debrisPerMin = 0;
    // give the player plants on many rocks, remove the rival's growth influence
    for (const ast of w.asteroids) sproutAt(w, w.colonies[0].id, 'pinophyta', ast, -1.2);
    const rival = w.plants.filter((p) => p.colonyId === w.colonies[1].id);
    for (const p of rival) damagePart(p, 0, 9999);
    // domination would end it — verify canopy math directly instead
    const shares = computeCanopyControl(w);
    expect(shares.get(w.colonies[0].id)!).toBeGreaterThan(0.1);
    expect(shares.get(w.colonies[1].id)!).toBe(0);
    // and the round ends won (domination check fires on the dead rival)
    for (let i = 0; i < 20; i++) stepWorld(w, TUNING.simDt);
    expect(w.roundState).toBe('won');
  });
});

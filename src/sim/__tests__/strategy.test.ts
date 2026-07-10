import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt, computeCanopyControl, placeLure, setPing } from '../world';
import { bless, colonyMods, verbCooldown, verbReady } from '../stats';
import { damagePart } from '../plant';
import { CONTACT01 } from '../../content/maps/contact01';
import { TUNING } from '../../content/tuning';

describe('strategy layer (M6)', () => {
  it('owned mutations shape the colony mods', () => {
    const w = createWorld(CONTACT01, 7);
    const c = w.colonies[0];
    c.mutations.push('everbloom');
    expect(colonyMods(c).chargeRate).toBeGreaterThan(colonyMods(w.colonies[1]).chargeRate);
    c.mutations.push('ironwood');
    const m = colonyMods(c);
    expect(m.contactTaken).toBeLessThan(1);
    expect(m.hardenBonusAdd).toBeGreaterThan(0);
  });

  it('bless works once, then cools down; a second cast during cooldown fails', () => {
    const w = createWorld(CONTACT01, 7);
    const plant = w.plants[0];
    const other = w.plants.find((p) => p.colonyId === w.colonies[0].id && p !== plant);
    const c = w.colonies[0];
    expect(bless(w, plant)).toBe(true);
    expect(plant.blessedUntil).toBeGreaterThan(0);
    expect(verbReady(w, c, 'bless')).toBe(false);
    // even a different (unblessed) target is refused while cooling
    if (other) expect(bless(w, other)).toBe(false);
    // ride out the cooldown and it works again — on a fresh target
    const until = c.verbReadyAt.bless;
    while (w.time <= Math.max(until, plant.blessedUntil)) stepWorld(w, TUNING.simDt);
    expect(bless(w, plant)).toBe(true);
  });

  it('ping and lure run on cooldowns too', () => {
    const w = createWorld(CONTACT01, 7);
    const c = w.colonies[0];
    expect(setPing(w, c.id, { x: 0, y: 0 })).toBe(true);
    expect(setPing(w, c.id, { x: 50, y: 0 })).toBe(false); // cooling
    expect(placeLure(w, c.id, { x: 0, y: 0 })).toBe(true);
    expect(placeLure(w, c.id, { x: 0, y: 50 })).toBe(false);
    expect(w.lure).not.toBeNull();
  });

  it('clades flavor their verb cooldowns (verbHaste)', () => {
    const w = createWorld(CONTACT01, 7);
    const pine = w.colonies[0]; // contact01 player is pinophyta
    expect(verbCooldown(pine, 'bless')).toBeLessThan(TUNING.verbs.cooldown.bless);
    expect(verbCooldown(pine, 'lure')).toBe(TUNING.verbs.cooldown.lure);
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

import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, hashWorld } from '../world';
import { worldToSave, worldFromSave } from '../serialize';
import { generateSkirmish } from '../../content/maps/gen';
import { C01_FIRST_LIGHT, C03_GLOOMFALL } from '../../content/maps/campaign';
import { TUNING } from '../../content/tuning';

describe('meta shell (M9)', () => {
  it('skirmish generator is deterministic per seed and playable', () => {
    const a = generateSkirmish(123);
    const b = generateSkirmish(123);
    const c = generateSkirmish(456);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    expect(a.asteroids.length).toBeGreaterThanOrEqual(6);
    expect(a.colonies.length).toBe(2);
    const [s0, s1] = a.spawns;
    const r0 = a.asteroids[s0.asteroid];
    const r1 = a.asteroids[s1.asteroid];
    expect(Math.hypot(r0.x - r1.x, r0.y - r1.y)).toBeGreaterThan(800); // fair start
    // and it actually runs
    const w = createWorld(a, 123);
    for (let i = 0; i < 300; i++) stepWorld(w, TUNING.simDt);
    expect(w.plants.every((p) => p.alive)).toBe(true);
  });

  it('save -> load -> continue is bit-identical to never having saved', () => {
    const w1 = createWorld(C01_FIRST_LIGHT, 42);
    const w2 = createWorld(C01_FIRST_LIGHT, 42);
    for (let i = 0; i < 800; i++) {
      stepWorld(w1, TUNING.simDt);
      stepWorld(w2, TUNING.simDt);
    }
    // serialize w2 through JSON exactly like localStorage would
    const restored = worldFromSave(JSON.parse(JSON.stringify(worldToSave(w2))));
    expect(hashWorld(restored)).toBe(hashWorld(w1));
    for (let i = 0; i < 500; i++) {
      stepWorld(w1, TUNING.simDt);
      stepWorld(restored, TUNING.simDt);
    }
    expect(hashWorld(restored)).toBe(hashWorld(w1));
  });

  it('campaign maps stand up; Gloomfall locks its fungal antagonist', () => {
    const w1 = createWorld(C01_FIRST_LIGHT, 9);
    const w3 = createWorld(C03_GLOOMFALL, 9);
    for (let i = 0; i < 200; i++) {
      stepWorld(w1, TUNING.simDt);
      stepWorld(w3, TUNING.simDt);
    }
    expect(w1.plants.every((p) => p.alive)).toBe(true);
    expect(C03_GLOOMFALL.colonies[1].lockFaction).toBe(true);
    expect(w3.colonies[1].faction).toBe('basidiomycota');
    // the Gloom's head start: two webs from the first tick
    expect(w3.plants.filter((p) => p.colonyId === w3.colonies[1].id).length).toBe(2);
  });
});

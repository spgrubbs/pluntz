import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, hashWorld } from '../world';
import { DEV01 } from '../../content/maps/dev01';
import { TUNING } from '../../content/tuning';

describe('world simulation', () => {
  it('same seed -> identical state hash after 2000 ticks (determinism)', () => {
    const a = createWorld(DEV01, 42);
    const b = createWorld(DEV01, 42);
    for (let i = 0; i < 2000; i++) {
      stepWorld(a, TUNING.simDt);
      stepWorld(b, TUNING.simDt);
    }
    expect(hashWorld(a)).toBe(hashWorld(b));
    expect(a.plants[0].parts.length).toBe(b.plants[0].parts.length);
  });

  it('different seeds diverge', () => {
    const a = createWorld(DEV01, 1);
    const b = createWorld(DEV01, 2);
    for (let i = 0; i < 2000; i++) {
      stepWorld(a, TUNING.simDt);
      stepWorld(b, TUNING.simDt);
    }
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });

  it('the spawned plant grows: roots, stems and needles appear', () => {
    const w = createWorld(DEV01, 7);
    for (let i = 0; i < 3000; i++) stepWorld(w, TUNING.simDt); // 5 sim-minutes
    const plant = w.plants[0];
    const kinds = (k: string): number => plant.parts.filter((p) => p.kind === k).length;
    expect(kinds('root')).toBeGreaterThanOrEqual(2);
    expect(kinds('stem')).toBeGreaterThan(5);
    expect(kinds('leaf')).toBeGreaterThan(5);
  });

  it('a lit plant sustains positive net energy once grown', () => {
    const w = createWorld(DEV01, 7);
    for (let i = 0; i < 3000; i++) stepWorld(w, TUNING.simDt);
    const plant = w.plants[0];
    expect(plant.lastIncome).toBeGreaterThan(plant.lastUpkeep);
    expect(plant.litLeaves).toBeGreaterThan(0);
  });

  it('growth stalls and energy drains when the colony is fully shaded', () => {
    const w = createWorld(DEV01, 7);
    for (let i = 0; i < 3000; i++) stepWorld(w, TUNING.simDt);
    const plant = w.plants[0];
    // debug-drag a big rock directly sunward of the home rock
    const toSunX = Math.cos(w.sun.angle);
    const toSunY = Math.sin(w.sun.angle);
    const home = w.asteroids[0];
    const blocker = w.asteroids[2]; // r=130
    blocker.radius = 400; // giant umbrella, guarantees full occlusion
    blocker.pos.x = home.pos.x + toSunX * 600;
    blocker.pos.y = home.pos.y + toSunY * 600;

    const energyBefore = plant.energy;
    for (let i = 0; i < 600; i++) stepWorld(w, TUNING.simDt); // 1 sim-minute shaded
    expect(plant.litLeaves).toBe(0);
    expect(plant.lastIncome).toBeLessThan(plant.lastUpkeep);
    expect(plant.energy).toBeLessThan(energyBefore);
  });

  it('a grown tree self-shades: some needles sit under its own canopy', () => {
    const w = createWorld(DEV01, 7);
    for (let i = 0; i < 3000; i++) stepWorld(w, TUNING.simDt);
    const plant = w.plants[0];
    expect(plant.canopyLeaves).toBeGreaterThan(0); // interior needles half-earn
    // the sun-side rim stays bright: a healthy spire keeps a solid lit fraction
    expect(plant.litLeaves).toBeGreaterThan(plant.totalLeaves * 0.25);
    // and self-shading must not flip the colony into deficit on open ground
    expect(plant.lastIncome).toBeGreaterThan(plant.lastUpkeep);
  });

  it('day cycle moves the sun', () => {
    const w = createWorld(DEV01, 7);
    w.sun.cycle = true;
    const a0 = w.sun.angle;
    for (let i = 0; i < 100; i++) stepWorld(w, TUNING.simDt);
    expect(w.sun.angle).not.toBe(a0);
  });
});

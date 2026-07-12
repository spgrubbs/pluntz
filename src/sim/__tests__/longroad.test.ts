import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt } from '../world';
import { R01_SHADOW_CANYON } from '../../content/maps/longroad';
import { TUNING } from '../../content/tuning';
import type { World } from '../types';

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

describe('The Long Road I (GDD §14): the Dimming and the vanguard', () => {
  it('the Dimming advances and ends photosynthesis behind the front', () => {
    const w = createWorld(R01_SHADOW_CANYON, 7);
    w.debrisPerMin = 0;
    const x0 = w.dimming!.x;
    run(w, 600); // let the home garden grow needles in the light
    expect(w.dimming!.x).toBeGreaterThan(x0); // never rests
    const plant = w.plants[0];
    const litIncome = plant.lastIncome;
    expect(litIncome).toBeGreaterThan(0.5);
    // the front overtakes the home rock
    w.dimming!.x = plant.astPos.x + 400;
    run(w, 20);
    expect(plant.lastIncome).toBeLessThan(litIncome * 0.35); // the light is gone
  });

  it('decomposers stroll through the dark untouched', () => {
    const w = createWorld(R01_SHADOW_CANYON, 7);
    w.debrisPerMin = 0;
    // a fungal squatter on the rich western rock
    expect(sproutAt(w, w.colonies[1].id, 'basidiomycota', w.asteroids[2], Math.PI / 2)).toBe(true);
    const fungus = w.plants[w.plants.length - 1];
    run(w, 300);
    w.dimming!.x = fungus.astPos.x + 400; // deep inside the swallowed lands
    run(w, 20);
    expect(fungus.alive).toBe(true);
    expect(fungus.lastIncome).toBeGreaterThan(1); // the dark is their country
  });

  it('holding the threshold rock long enough wins the region (vanguard)', () => {
    const w = createWorld(R01_SHADOW_CANYON, 7);
    w.debrisPerMin = 0;
    const threshold = w.asteroids[14];
    expect(w.vanguard!.asteroidId).toBe(threshold.id);
    expect(sproutAt(w, w.colonies[0].id, 'pinophyta', threshold, -Math.PI / 2)).toBe(true);
    run(w, Math.ceil((w.vanguard!.holdSec + 3) / TUNING.simDt));
    expect(w.roundState).toBe('won');
    expect(w.endReason).toBe('vanguard');
  });

  it('a contested threshold never counts down', () => {
    const w = createWorld(R01_SHADOW_CANYON, 7);
    w.debrisPerMin = 0;
    const threshold = w.asteroids[14];
    expect(sproutAt(w, w.colonies[0].id, 'pinophyta', threshold, -Math.PI / 2)).toBe(true);
    expect(sproutAt(w, w.colonies[1].id, 'anthophyta', threshold, Math.PI / 2)).toBe(true);
    run(w, Math.ceil(40 / TUNING.simDt));
    expect(w.roundState).toBe('playing'); // stalemate on the doorstep
    expect(w.vanguardHeldSec).toBe(0);
  });
});

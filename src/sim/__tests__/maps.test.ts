import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../world';
import { MAPS } from '../../content/maps/index';
import { TUNING } from '../../content/tuning';

describe('registered maps', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    it(`${id} creates, steps 300 ticks, and every spawn survives the opening`, () => {
      const w = createWorld(map, 7);
      for (let i = 0; i < 300; i++) stepWorld(w, TUNING.simDt);
      expect(w.plants.length).toBeGreaterThanOrEqual(map.spawns.length);
      for (const p of w.plants) expect(p.alive).toBe(true);
      // authored rocks must not overlap (scarabs respect this at runtime too)
      for (let i = 0; i < w.asteroids.length; i++) {
        for (let j = i + 1; j < w.asteroids.length; j++) {
          const a = w.asteroids[i];
          const b = w.asteroids[j];
          expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThan(
            a.radius + b.radius,
          );
        }
      }
    });
  }
});

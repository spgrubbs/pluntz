import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';
import { FACTIONS } from '../content/factions';
import type { Lerper } from './lerp';

/** Airborne seeds: luminous motes with motion trails. Additive — alive things glow. */
export class SeedView {
  readonly g = new Graphics();

  constructor() {
    this.g.blendMode = 'add';
  }

  update(world: World, lerper?: Lerper): void {
    const g = this.g;
    g.clear();
    for (const s of world.seeds) {
      const at = lerper ? lerper.pos(s.id, s.pos) : s.pos;
      const colony = world.colonies.find((c) => c.id === s.colonyId);
      const pal = FACTIONS[s.faction].palettes[colony?.palette ?? 0];
      const sp = Math.hypot(s.vel.x, s.vel.y) || 1;
      if (s.heir) {
        // the Drift's Heir Seed: a bright comet the camera rides, wearing a
        // corona and a long trail — unmistakably the lineage's future
        const tx = at.x - (s.vel.x / sp) * 30;
        const ty = at.y - (s.vel.y / sp) * 30;
        g.moveTo(tx, ty).lineTo(at.x, at.y).stroke({ width: 3, color: pal.seed, alpha: 0.4 });
        const pulse = 10 + Math.sin(s.age * 8) * 2;
        g.circle(at.x, at.y, pulse).fill({ color: pal.heartCore, alpha: 0.12 });
        g.circle(at.x, at.y, 6).fill({ color: pal.seed, alpha: 0.35 });
        g.circle(at.x, at.y, 3.4).fill({ color: 0xffffff, alpha: 0.95 });
        if (s.steers > 0) {
          // steer charges: little sparks orbiting the comet
          for (let k = 0; k < s.steers; k++) {
            const a = s.age * 3 + (k / Math.max(1, s.steers)) * Math.PI * 2;
            g.circle(at.x + Math.cos(a) * 13, at.y + Math.sin(a) * 13, 1.6).fill({
              color: pal.heartCore,
              alpha: 0.9,
            });
          }
        }
        continue;
      }
      if (FACTIONS[s.faction].repro.infects) {
        // spores drift as soft luminous puffs
        const wob = Math.sin(s.age * 6 + s.id) * 2;
        g.circle(at.x + wob, at.y - wob, 7).fill({ color: pal.seed, alpha: 0.1 });
        g.circle(at.x, at.y, 4).fill({ color: pal.seed, alpha: 0.22 });
        g.circle(at.x, at.y, 1.8).fill({ color: pal.seed, alpha: 0.85 });
      } else {
        const tx = at.x - (s.vel.x / sp) * 14;
        const ty = at.y - (s.vel.y / sp) * 14;
        g.moveTo(tx, ty)
          .lineTo(at.x, at.y)
          .stroke({ width: 2, color: pal.seed, alpha: 0.35 });
        g.circle(at.x, at.y, 6).fill({ color: pal.seed, alpha: 0.14 });
        g.circle(at.x, at.y, 2.8).fill({ color: pal.seed, alpha: 0.95 });
      }
    }
  }
}

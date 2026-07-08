import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';
import { FACTIONS } from '../content/factions';

/** Airborne seeds: a bright mote with a motion trail. Redrawn per frame. */
export class SeedView {
  readonly g = new Graphics();

  update(world: World): void {
    const g = this.g;
    g.clear();
    for (const s of world.seeds) {
      const colony = world.colonies.find((c) => c.id === s.colonyId);
      const pal = FACTIONS[s.faction].palettes[colony?.palette ?? 0];
      const sp = Math.hypot(s.vel.x, s.vel.y) || 1;
      if (FACTIONS[s.faction].repro.infects) {
        // spores drift as soft fuzzy puffs
        const wob = Math.sin(s.age * 6 + s.id) * 2;
        g.circle(s.pos.x + wob, s.pos.y - wob, 6).fill({ color: pal.seed, alpha: 0.12 });
        g.circle(s.pos.x, s.pos.y, 4).fill({ color: pal.seed, alpha: 0.25 });
        g.circle(s.pos.x, s.pos.y, 1.8).fill({ color: pal.seed, alpha: 0.9 });
      } else {
        const tx = s.pos.x - (s.vel.x / sp) * 14;
        const ty = s.pos.y - (s.vel.y / sp) * 14;
        g.moveTo(tx, ty)
          .lineTo(s.pos.x, s.pos.y)
          .stroke({ width: 2, color: pal.seed, alpha: 0.4 });
        g.circle(s.pos.x, s.pos.y, 5.5).fill({ color: pal.seed, alpha: 0.18 });
        g.circle(s.pos.x, s.pos.y, 2.8).fill({ color: pal.seed });
      }
    }
  }
}

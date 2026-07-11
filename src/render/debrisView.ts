import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';
import type { Lerper } from './lerp';

/** Drifting rocks: small spinning polygons, redrawn each frame (they're few). */
export class DebrisView {
  readonly g = new Graphics();

  update(world: World, lerper?: Lerper): void {
    const g = this.g;
    g.clear();
    for (const d of world.debris) {
      const at = lerper ? lerper.pos(d.id, d.pos) : d.pos;
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = d.angle + (i / 6) * Math.PI * 2;
        const r = d.radius * (i % 2 === 0 ? 1 : 0.78);
        pts.push(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
      }
      g.poly(pts).fill({ color: 0x77706a }).stroke({ width: 1, color: 0x2c2925 });
      g.circle(
        at.x + Math.cos(d.angle) * d.radius * 0.35,
        at.y + Math.sin(d.angle) * d.radius * 0.35,
        d.radius * 0.22,
      ).fill({ color: 0x4d4741 });
    }
  }
}

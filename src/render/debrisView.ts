import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';

/** Drifting rocks: small spinning polygons, redrawn each frame (they're few). */
export class DebrisView {
  readonly g = new Graphics();

  update(world: World): void {
    const g = this.g;
    g.clear();
    for (const d of world.debris) {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = d.angle + (i / 6) * Math.PI * 2;
        const r = d.radius * (i % 2 === 0 ? 1 : 0.78);
        pts.push(d.pos.x + Math.cos(a) * r, d.pos.y + Math.sin(a) * r);
      }
      g.poly(pts).fill({ color: 0x77706a }).stroke({ width: 1, color: 0x2c2925 });
      g.circle(
        d.pos.x + Math.cos(d.angle) * d.radius * 0.35,
        d.pos.y + Math.sin(d.angle) * d.radius * 0.35,
        d.radius * 0.22,
      ).fill({ color: 0x4d4741 });
    }
  }
}

import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';

/**
 * Geometric critters, redrawn per frame: Frugivora are kite-birds,
 * Phytophaga rounded beetles, Anthophila glowing motes.
 */
export class FaunaView {
  readonly g = new Graphics();

  update(world: World): void {
    const g = this.g;
    g.clear();
    for (const fn of world.fauna) {
      const a = Math.atan2(fn.vel.y, fn.vel.x);
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      const P = (fx: number, fy: number): [number, number] => [
        fn.pos.x + fx * cs - fy * sn,
        fn.pos.y + fx * sn + fy * cs,
      ];
      switch (fn.kind) {
        case 'frugivora': {
          // a kite bird: two swept wings
          const flap = Math.sin(world.time * 9 + fn.id) * 3;
          g.poly([...P(7, 0), ...P(-5, -5 - flap), ...P(-2, 0)]).fill({ color: 0xc2c9dd });
          g.poly([...P(7, 0), ...P(-5, 5 + flap), ...P(-2, 0)]).fill({ color: 0x9aa3bd });
          if (fn.carryFaction) {
            g.circle(...P(-6, 0), 2.6).fill({ color: 0xffd9a0 }); // the carried seed
          }
          break;
        }
        case 'phytophaga': {
          // rounded beetle with nibbling mandibles
          g.circle(fn.pos.x, fn.pos.y, 5).fill({ color: 0x9aa3bd });
          g.circle(...P(3, 0), 2.8).fill({ color: 0x767f99 });
          const nib = fn.state === 'graze' ? Math.sin(world.time * 14) * 1.5 : 0;
          g.moveTo(...P(5, -1.5 - nib)).lineTo(...P(8, -2.5 - nib)).stroke({ width: 1, color: 0x555e78 });
          g.moveTo(...P(5, 1.5 + nib)).lineTo(...P(8, 2.5 + nib)).stroke({ width: 1, color: 0x555e78 });
          break;
        }
        case 'anthophila': {
          const tw = 0.6 + 0.4 * Math.sin(world.time * 7 + fn.id * 2);
          g.circle(fn.pos.x, fn.pos.y, 3.5).fill({ color: 0xdde6fa, alpha: 0.25 * tw });
          g.circle(fn.pos.x, fn.pos.y, 1.6).fill({ color: 0xdde6fa, alpha: 0.9 });
          break;
        }
      }
    }
  }
}

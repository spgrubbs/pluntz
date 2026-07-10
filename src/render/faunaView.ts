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
          // a kite bird: two swept wings, tail feather, and an eye
          const flap = Math.sin(world.time * 9 + fn.id) * 5.5;
          g.poly([...P(13, 0), ...P(-9, -9 - flap), ...P(-4, 0)]).fill({ color: 0xc2c9dd });
          g.poly([...P(13, 0), ...P(-9, 9 + flap), ...P(-4, 0)]).fill({ color: 0x9aa3bd });
          g.poly([...P(-4, 0), ...P(-12, -2.5), ...P(-12, 2.5)]).fill({ color: 0x848daa });
          g.circle(...P(8, 0), 1.4).fill({ color: 0x2a3046 });
          if (fn.carryFaction) {
            g.circle(...P(-10, 0), 4).fill({ color: 0xffd9a0 }); // the carried seed
            g.circle(...P(-10, 0), 5.5).stroke({ width: 1, color: 0xffd9a0, alpha: 0.5 });
          }
          break;
        }
        case 'phytophaga': {
          // rounded beetle with shell seam and nibbling mandibles
          g.circle(fn.pos.x, fn.pos.y, 9).fill({ color: 0x9aa3bd });
          g.moveTo(...P(-8, 0)).lineTo(...P(6, 0)).stroke({ width: 1, color: 0x767f99 });
          g.circle(...P(6, 0), 5).fill({ color: 0x767f99 });
          const nib = fn.state === 'graze' ? Math.sin(world.time * 14) * 2.5 : 0;
          g.moveTo(...P(9, -2.5 - nib)).lineTo(...P(14, -4.5 - nib)).stroke({ width: 1.6, color: 0x555e78 });
          g.moveTo(...P(9, 2.5 + nib)).lineTo(...P(14, 4.5 + nib)).stroke({ width: 1.6, color: 0x555e78 });
          // stubby legs
          for (const lx of [-5, 0, 5]) {
            g.moveTo(...P(lx, -8)).lineTo(...P(lx - 2, -11)).stroke({ width: 1.2, color: 0x555e78 });
            g.moveTo(...P(lx, 8)).lineTo(...P(lx - 2, 11)).stroke({ width: 1.2, color: 0x555e78 });
          }
          break;
        }
        case 'anthophila': {
          const tw = 0.6 + 0.4 * Math.sin(world.time * 7 + fn.id * 2);
          g.circle(fn.pos.x, fn.pos.y, 5.5).fill({ color: 0xdde6fa, alpha: 0.25 * tw });
          g.circle(fn.pos.x, fn.pos.y, 2.4).fill({ color: 0xdde6fa, alpha: 0.9 });
          break;
        }
        case 'scarabaeidae': {
          // the rock-shover: a broad horned titan. Straining legs while pushing.
          const strain = fn.state === 'push' ? Math.sin(world.time * 6 + fn.id) * 1.6 : 0;
          g.circle(fn.pos.x, fn.pos.y, 13).fill({ color: 0x8a7f6a });
          g.moveTo(...P(-11, 0)).lineTo(...P(9, 0)).stroke({ width: 1.2, color: 0x6b6252 });
          g.circle(...P(8, 0), 7).fill({ color: 0x6b6252 });
          // the horn, thrown forward into the work
          g.poly([...P(12, -2.5), ...P(22 + strain, 0), ...P(12, 2.5)]).fill({ color: 0x55503f });
          for (const lx of [-8, -1, 6]) {
            g.moveTo(...P(lx, -12)).lineTo(...P(lx - 3 - strain, -16)).stroke({ width: 1.8, color: 0x55503f });
            g.moveTo(...P(lx, 12)).lineTo(...P(lx - 3 - strain, 16)).stroke({ width: 1.8, color: 0x55503f });
          }
          // effort motes while shoving
          if (fn.state === 'push') {
            const k = (world.time * 3 + fn.id) % 1;
            g.circle(...P(-15 - k * 10, (fn.id % 2 ? 1 : -1) * 4), 1.6 * (1 - k)).fill({
              color: 0xcfc4a8,
              alpha: 0.5 * (1 - k),
            });
          }
          break;
        }
        case 'araneae': {
          // the nesting hunter: a small dark body on long angular legs
          const crouch = Math.sin(world.time * 3 + fn.id) * 0.8;
          for (const s of [-1, 1]) {
            for (const [ox, oy] of [[7, 3], [3, 7], [-3, 7], [-7, 4]] as const) {
              g.moveTo(fn.pos.x, fn.pos.y)
                .lineTo(fn.pos.x + ox * 1.6, fn.pos.y + s * (oy * 1.6 + crouch))
                .stroke({ width: 1.1, color: 0x4a3550 });
            }
          }
          g.circle(fn.pos.x, fn.pos.y, 4.5).fill({ color: 0x5e4468 });
          g.circle(fn.pos.x + 3, fn.pos.y, 2.6).fill({ color: 0x77558a });
          g.circle(fn.pos.x + 4, fn.pos.y - 1, 0.9).fill({ color: 0xd7b8ff });
          break;
        }
      }
    }
  }
}

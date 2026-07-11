import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/types';
import type { Lerper } from './lerp';

/**
 * Geometric critters, reimagined for the void and redrawn per frame:
 * - Frugivora: a kite-bird with iridescent wingtips.
 * - Phytophaga: a moss-backed grazing beetle.
 * - Anthophila: glowing pollinator motes.
 * - Scarabaeidae: a titan armored in harvested rock — its shell is a little
 *   asteroid of plates and mineral veins, with ember light in the seams.
 * - Araneae: a crystalline cyclops — faceted glass body, one huge eye.
 * - Lampyridae: the wandering lantern.
 * A separate additive layer gives every living thing its glow.
 */
export class FaunaView {
  readonly container = new Container();
  readonly glow = new Graphics();
  readonly g = new Graphics();

  constructor() {
    this.glow.blendMode = 'add';
    this.container.addChild(this.glow, this.g);
  }

  update(world: World, lerper?: Lerper): void {
    const g = this.g;
    const gl = this.glow;
    g.clear();
    gl.clear();
    for (const fn of world.fauna) {
      const at = lerper ? lerper.pos(fn.id, fn.pos) : fn.pos;
      const a = Math.atan2(fn.vel.y, fn.vel.x);
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      const P = (fx: number, fy: number): [number, number] => [
        at.x + fx * cs - fy * sn,
        at.y + fx * sn + fy * cs,
      ];
      switch (fn.kind) {
        case 'frugivora': {
          // a kite bird: two swept wings, tail feather, and an eye
          const flap = Math.sin(world.time * 9 + fn.id) * 5.5;
          gl.circle(at.x, at.y, 15).fill({ color: 0xaebafc, alpha: 0.05 });
          g.poly([...P(13, 0), ...P(-9, -9 - flap), ...P(-4, 0)]).fill({ color: 0xc2c9dd });
          g.poly([...P(13, 0), ...P(-9, 9 + flap), ...P(-4, 0)]).fill({ color: 0x9aa3bd });
          g.poly([...P(-4, 0), ...P(-12, -2.5), ...P(-12, 2.5)]).fill({ color: 0x848daa });
          // iridescent wingtips catch the starlight as the wings beat
          const shim = 0.5 + 0.5 * Math.sin(world.time * 9 + fn.id);
          gl.circle(...P(-9, -9 - flap), 1.6).fill({ color: 0x8af2ff, alpha: 0.5 * shim });
          gl.circle(...P(-9, 9 + flap), 1.6).fill({ color: 0xc59aff, alpha: 0.5 * (1 - shim) });
          g.circle(...P(8, 0), 1.4).fill({ color: 0x2a3046 });
          if (fn.carryFaction) {
            g.circle(...P(-10, 0), 4).fill({ color: 0xffd9a0 });
            gl.circle(...P(-10, 0), 7).fill({ color: 0xffd9a0, alpha: 0.35 });
          }
          break;
        }
        case 'phytophaga': {
          // moss-backed grazer: a beetle wearing a little living meadow
          gl.circle(at.x, at.y, 14).fill({ color: 0x5fe8a0, alpha: 0.04 });
          g.circle(at.x, at.y, 9).fill({ color: 0x8a9a8f });
          g.moveTo(...P(-8, 0)).lineTo(...P(6, 0)).stroke({ width: 1, color: 0x6a7a70 });
          // the moss garden on its shell (its own tiny canopy)
          for (const [mx, my, mr] of [[-4, -3, 2.2], [-1, 3, 1.8], [-5, 2, 1.5], [2, -3, 1.6]] as const) {
            g.circle(...P(mx, my), mr).fill({ color: 0x3e9a6c, alpha: 0.9 });
          }
          gl.circle(...P(-3, 0), 5).fill({ color: 0x3ee89c, alpha: 0.08 });
          g.circle(...P(6, 0), 5).fill({ color: 0x767f99 });
          const nib = fn.state === 'graze' ? Math.sin(world.time * 14) * 2.5 : 0;
          g.moveTo(...P(9, -2.5 - nib)).lineTo(...P(14, -4.5 - nib)).stroke({ width: 1.6, color: 0x555e78 });
          g.moveTo(...P(9, 2.5 + nib)).lineTo(...P(14, 4.5 + nib)).stroke({ width: 1.6, color: 0x555e78 });
          for (const lx of [-5, 0, 5]) {
            g.moveTo(...P(lx, -8)).lineTo(...P(lx - 2, -11)).stroke({ width: 1.2, color: 0x555e78 });
            g.moveTo(...P(lx, 8)).lineTo(...P(lx - 2, 11)).stroke({ width: 1.2, color: 0x555e78 });
          }
          break;
        }
        case 'anthophila': {
          const tw = 0.6 + 0.4 * Math.sin(world.time * 7 + fn.id * 2);
          gl.circle(at.x, at.y, 8).fill({ color: 0xdde6fa, alpha: 0.3 * tw });
          g.circle(at.x, at.y, 5.5).fill({ color: 0xdde6fa, alpha: 0.25 * tw });
          g.circle(at.x, at.y, 2.4).fill({ color: 0xdde6fa, alpha: 0.9 });
          break;
        }
        case 'scarabaeidae': {
          // the rock-harvester: armored in plates of gathered stone, ember
          // light leaking from the seams. Straining legs while it shoves.
          const strain = fn.state === 'push' ? Math.sin(world.time * 6 + fn.id) * 1.6 : 0;
          const ember = fn.state === 'push' ? 0.75 : 0.35;
          // under-glow: the furnace inside the shell
          gl.circle(at.x, at.y, 17).fill({ color: 0xff9a4a, alpha: 0.06 + ember * 0.06 });
          // stone plates (a little asteroid on legs)
          g.circle(at.x, at.y, 13).fill({ color: 0x4c463d }); // dark under-shell
          const plates: [number, number, number[]][] = [
            [-4, -6, [-11, -3, -5, -11, 2, -8, -2, -1]],
            [-4, 6, [-11, 3, -5, 11, 2, 8, -2, 1]],
            [3, 0, [-1, -7, 8, -5, 10, 0, 8, 5, -1, 7]],
            [-9, 0, [-13, -4, -8, -7, -6, 0, -8, 7, -13, 4]],
          ];
          for (let pi = 0; pi < plates.length; pi++) {
            const pts: number[] = [];
            const poly = plates[pi][2];
            for (let k = 0; k < poly.length; k += 2) pts.push(...P(poly[k], poly[k + 1]));
            g.poly(pts).fill({ color: pi % 2 ? 0x6e675a : 0x7d766a });
            g.poly(pts).stroke({ width: 0.8, color: 0x35302a, alpha: 0.9 });
          }
          // ember seams between the plates
          gl.moveTo(...P(-2, -1)).lineTo(...P(-1, -7)).stroke({ width: 1.2, color: 0xffb36b, alpha: ember });
          gl.moveTo(...P(-2, 1)).lineTo(...P(-1, 7)).stroke({ width: 1.2, color: 0xffb36b, alpha: ember });
          gl.moveTo(...P(-6, 0)).lineTo(...P(-1, 0)).stroke({ width: 1.2, color: 0xffb36b, alpha: ember * 0.8 });
          // mineral flecks: it wears what it mines
          g.circle(...P(-6, -5), 1.1).fill({ color: 0xc9a4ff, alpha: 0.9 });
          g.circle(...P(-2, 5), 0.9).fill({ color: 0x9adfff, alpha: 0.8 });
          // the horn, thrown forward into the work
          g.poly([...P(11, -2.8), ...P(22 + strain, 0), ...P(11, 2.8)]).fill({ color: 0x55503f });
          gl.circle(...P(22 + strain, 0), 2).fill({ color: 0xffb36b, alpha: ember * 0.5 });
          for (const lx of [-8, -1, 6]) {
            g.moveTo(...P(lx, -12)).lineTo(...P(lx - 3 - strain, -16)).stroke({ width: 1.8, color: 0x55503f });
            g.moveTo(...P(lx, 12)).lineTo(...P(lx - 3 - strain, 16)).stroke({ width: 1.8, color: 0x55503f });
          }
          break;
        }
        case 'araneae': {
          // the web first: a sagging strand out to any reeling catch
          if (fn.webPrey >= 0) {
            const prey = world.fauna.find((o) => o.id === fn.webPrey);
            if (prey) {
              const pat = lerper ? lerper.pos(prey.id, prey.pos) : prey.pos;
              const mx = (at.x + pat.x) / 2;
              const my = (at.y + pat.y) / 2 + 6;
              g.moveTo(at.x, at.y)
                .quadraticCurveTo(mx, my, pat.x, pat.y)
                .stroke({ width: 1.1, color: 0xcfeef8, alpha: 0.75 });
              const wob = Math.sin(world.time * 12) * 1.5;
              g.circle(pat.x, pat.y, 8 + wob).stroke({ width: 1, color: 0xcfeef8, alpha: 0.55 });
              g.circle(pat.x, pat.y, 5 - wob * 0.4).stroke({ width: 0.8, color: 0xcfeef8, alpha: 0.4 });
            }
          }
          // the crystalline cyclops: faceted glass on prismatic legs
          const crouch = Math.sin(world.time * 3 + fn.id) * 0.8;
          for (const s of [-1, 1]) {
            for (const [ox, oy] of [[8, 3], [4, 8], [-4, 8], [-8, 4]] as const) {
              const jx = at.x + ox * 1.7;
              const jy = at.y + s * (oy * 1.7 + crouch);
              g.moveTo(at.x, at.y).lineTo(jx, jy).stroke({ width: 1, color: 0x9fd8e8, alpha: 0.8 });
              g.circle(jx, jy, 0.8).fill({ color: 0xd8f4ff, alpha: 0.7 }); // joint gleam
            }
          }
          // faceted body: a glass kite with an inner facet
          g.poly([at.x + 7, at.y, at.x, at.y - 5.5, at.x - 6, at.y, at.x, at.y + 5.5]).fill({
            color: 0x6ab8d2,
            alpha: 0.92,
          });
          g.poly([at.x + 7, at.y, at.x, at.y - 5.5, at.x, at.y + 5.5]).fill({
            color: 0x9fdcef,
            alpha: 0.6,
          });
          // THE EYE: one huge lens, always watching
          const blink = Math.min(1, Math.abs(Math.sin(world.time * 0.7 + fn.id)) * 8);
          gl.circle(at.x + 2, at.y, 7).fill({ color: 0xc59aff, alpha: 0.22 });
          g.circle(at.x + 2, at.y, 3).fill({ color: 0xefe0ff });
          g.circle(at.x + 2.6, at.y, 1.6 * blink).fill({ color: 0x8a4fd0 });
          g.circle(at.x + 3.2, at.y - 0.8, 0.6).fill({ color: 0xffffff });
          break;
        }
        case 'lampyridae': {
          // the wandering lantern: layered warm glow around a bright grain
          const breathe = 0.75 + 0.25 * Math.sin(world.time * 2.4 + fn.id * 1.7);
          gl.circle(at.x, at.y, 30 * breathe).fill({ color: 0xffe9a8, alpha: 0.08 });
          gl.circle(at.x, at.y, 15 * breathe).fill({ color: 0xffe9a8, alpha: 0.18 });
          g.circle(at.x, at.y, 7).fill({ color: 0xfff3c4, alpha: 0.45 });
          g.circle(at.x, at.y, 3).fill({ color: 0xfffbe8 });
          const a2 = Math.atan2(fn.vel.y, fn.vel.x);
          const wx = -Math.sin(a2) * 4;
          const wy = Math.cos(a2) * 4;
          g.circle(at.x + wx, at.y + wy, 1.6).fill({ color: 0xc9a24f, alpha: 0.8 });
          g.circle(at.x - wx, at.y - wy, 1.6).fill({ color: 0xc9a24f, alpha: 0.8 });
          break;
        }
      }
    }
  }
}

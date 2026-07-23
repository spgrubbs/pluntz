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
      // Droseraceae: a glistening sticky strand out to the trap that holds it
      if (fn.trappedBy >= 0) {
        const host = world.plants.find((p) => p.id === fn.trappedBy);
        if (host) {
          const hx = host.astPos.x + host.parts[0].tip.x;
          const hy = host.astPos.y + host.parts[0].tip.y;
          const sag = Math.sin(world.time * 9 + fn.id) * 2;
          g.moveTo(hx, hy)
            .quadraticCurveTo((hx + at.x) / 2, (hy + at.y) / 2 + 8 + sag, at.x, at.y)
            .stroke({ width: 1.2, color: 0xffd0dc, alpha: 0.7 });
          gl.circle(at.x, at.y, 8).fill({ color: 0xff6a8a, alpha: 0.18 });
        }
      }
      switch (fn.kind) {
        case 'frugivora': {
          // a solar-sail ray: it doesn't flap, it TACKS — two translucent
          // sail membranes on rib-spars, breathing slowly as it rides light
          const tack = Math.sin(world.time * 3.2 + fn.id) * 3;
          gl.circle(at.x, at.y, 16).fill({ color: 0xaebafc, alpha: 0.05 });
          for (const sd of [-1, 1] as const) {
            const span = 11 + sd * tack;
            // membrane: nose -> wingtip -> trailing notch
            g.poly([...P(12, 0), ...P(-4, sd * span), ...P(-8, sd * span * 0.55), ...P(-3, 0)]).fill({
              color: sd < 0 ? 0xbcc6e6 : 0x93a0c6,
              alpha: 0.55,
            });
            // rib-spars: the sail's rigid bones
            g.moveTo(...P(11, 0)).lineTo(...P(-4, sd * span)).stroke({ width: 1.1, color: 0xd8dff2, alpha: 0.9 });
            g.moveTo(...P(4, 0)).lineTo(...P(-7, sd * span * 0.6)).stroke({ width: 0.8, color: 0xd8dff2, alpha: 0.6 });
            // sail edge catches starlight
            const shim = 0.5 + 0.5 * Math.sin(world.time * 3.2 + fn.id + sd);
            gl.circle(...P(-4, sd * span), 1.8).fill({
              color: sd < 0 ? 0x8af2ff : 0xc59aff,
              alpha: 0.55 * shim,
            });
          }
          // the keel body and twin tail-streamers
          g.poly([...P(13, 0), ...P(-2, -2.2), ...P(-9, 0), ...P(-2, 2.2)]).fill({ color: 0xdde3f5 });
          for (const sd of [-1, 1]) {
            const wave = Math.sin(world.time * 6 + fn.id + sd) * 1.5;
            g.moveTo(...P(-9, sd * 1))
              .lineTo(...P(-16, sd * 2.5 + wave))
              .stroke({ width: 0.9, color: 0x9aa3bd, alpha: 0.7 });
          }
          g.circle(...P(9, 0), 1.3).fill({ color: 0x2a3046 });
          if (fn.carryFaction) {
            // the carried seed rides in a light-cradle under the keel
            g.circle(...P(-6, 0), 4).fill({ color: 0xffd9a0 });
            gl.circle(...P(-6, 0), 8).fill({ color: 0xffd9a0, alpha: 0.35 });
            gl.moveTo(...P(-2, -2)).lineTo(...P(-10, 0)).stroke({ width: 1, color: 0xffd9a0, alpha: 0.5 });
            gl.moveTo(...P(-2, 2)).lineTo(...P(-10, 0)).stroke({ width: 1, color: 0xffd9a0, alpha: 0.5 });
          }
          break;
        }
        case 'phytophaga': {
          // the walking terrarium: everything it eats grows again under a
          // glass dome on its back — a tiny stolen garden, lit from within
          gl.circle(at.x, at.y, 14).fill({ color: 0x5fe8a0, alpha: 0.05 });
          // legs first (under the body)
          for (const lx of [-5, 0, 5]) {
            g.moveTo(...P(lx, -7)).lineTo(...P(lx - 2, -11)).stroke({ width: 1.2, color: 0x555e78 });
            g.moveTo(...P(lx, 7)).lineTo(...P(lx - 2, 11)).stroke({ width: 1.2, color: 0x555e78 });
          }
          // dark body plate + head
          g.poly([...P(8, -4), ...P(8, 4), ...P(-8, 6), ...P(-10, 0), ...P(-8, -6)]).fill({ color: 0x4d5568 });
          g.circle(...P(8, 0), 4.6).fill({ color: 0x656e85 });
          const nib = fn.state === 'graze' ? Math.sin(world.time * 14) * 2.5 : 0;
          g.moveTo(...P(10, -2.5 - nib)).lineTo(...P(15, -4.5 - nib)).stroke({ width: 1.6, color: 0x555e78 });
          g.moveTo(...P(10, 2.5 + nib)).lineTo(...P(15, 4.5 + nib)).stroke({ width: 1.6, color: 0x555e78 });
          // the terrarium dome: glass over a captive meadow
          const domeR = 7.5;
          const dx = at.x + -3 * cs;
          const dy = at.y + -3 * sn;
          // interior garden: soil line, moss tufts, one little sprout
          g.circle(dx, dy, domeR - 0.5).fill({ color: 0x1e2b26, alpha: 0.9 });
          for (const [mx, my, mr] of [[-3, 2, 2.0], [1, 3, 1.6], [3, -1, 1.4]] as const) {
            g.circle(dx + mx, dy + my, mr).fill({ color: 0x3e9a6c, alpha: 0.95 });
          }
          const sway = Math.sin(world.time * 2.5 + fn.id) * 0.8;
          g.moveTo(dx - 1, dy + 2)
            .lineTo(dx - 1 + sway, dy - 3)
            .stroke({ width: 1, color: 0x5fc98a });
          g.circle(dx - 1 + sway, dy - 3.5, 1.1).fill({ color: 0x8af2b0 });
          // a trapped light-mote drifting inside
          const ma = world.time * 1.6 + fn.id * 2;
          gl.circle(dx + Math.cos(ma) * 3, dy + Math.sin(ma) * 2.4, 1.2).fill({
            color: 0xfff3c4,
            alpha: 0.7,
          });
          gl.circle(dx, dy, domeR + 2).fill({ color: 0x9df5c4, alpha: 0.05 });
          // the glass itself: rim + a crescent highlight
          g.circle(dx, dy, domeR).stroke({ width: 1.1, color: 0xcfe6f0, alpha: 0.65 });
          g.circle(dx - 2, dy - 2, domeR - 2.4).stroke({ width: 0.9, color: 0xffffff, alpha: 0.25 });
          break;
        }
        case 'anthophila': {
          // a pollen orrery: three petal-motes orbiting a bright core, each
          // trailing a whisper of light — a constellation doing a bee's job
          const tw = 0.6 + 0.4 * Math.sin(world.time * 7 + fn.id * 2);
          gl.circle(at.x, at.y, 9).fill({ color: 0xdde6fa, alpha: 0.28 * tw });
          g.circle(at.x, at.y, 2.2).fill({ color: 0xffffff, alpha: 0.95 });
          const spin = world.time * 4 + fn.id;
          const tilt = 0.55; // squashed orbits read as a 3D gyre
          const tints = [0xffd9ec, 0xd9e6ff, 0xfff3c4];
          for (let q = 0; q < 3; q++) {
            const oa = spin + (q / 3) * Math.PI * 2;
            const ox = Math.cos(oa) * 6.5;
            const oy = Math.sin(oa) * 6.5 * tilt;
            g.circle(at.x + ox, at.y + oy, 1.5).fill({ color: tints[q], alpha: 0.9 });
            // short orbital trail
            const ta = oa - 0.5;
            gl.moveTo(at.x + Math.cos(ta) * 6.5, at.y + Math.sin(ta) * 6.5 * tilt)
              .lineTo(at.x + ox, at.y + oy)
              .stroke({ width: 1, color: tints[q], alpha: 0.35 });
          }
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
          // the lantern-jelly: a glowing paper bell trailing ribbons of
          // light, with a live flame flickering in its heart
          const breathe = 0.75 + 0.25 * Math.sin(world.time * 2.4 + fn.id * 1.7);
          gl.circle(at.x, at.y, 30 * breathe).fill({ color: 0xffe9a8, alpha: 0.08 });
          gl.circle(at.x, at.y, 15 * breathe).fill({ color: 0xffe9a8, alpha: 0.18 });
          // the bell: a soft pentagonal paper shade, seams showing
          const bell: number[] = [];
          for (let q = 0; q < 6; q++) {
            const ba = -Math.PI / 2 + (q / 6) * Math.PI * 2;
            const br = 6.5 * (q % 2 ? 0.92 : 1.05) * breathe;
            bell.push(at.x + Math.cos(ba) * br, at.y + Math.sin(ba) * br);
          }
          g.poly(bell).fill({ color: 0xfff3c4, alpha: 0.5 });
          g.poly(bell).stroke({ width: 0.8, color: 0xc9a24f, alpha: 0.7 });
          // the flame: flickers with its own mind
          const flick = 0.7 + 0.3 * Math.sin(world.time * 11 + fn.id * 3) * Math.sin(world.time * 5.3);
          g.circle(at.x, at.y, 2.6 * flick).fill({ color: 0xfffbe8 });
          gl.circle(at.x, at.y, 5 * flick).fill({ color: 0xffd257, alpha: 0.4 });
          // trailing light-ribbons, waving against the direction of travel
          const a2 = Math.atan2(fn.vel.y, fn.vel.x);
          for (const sd of [-1, 0, 1]) {
            const rx = -Math.cos(a2);
            const ry = -Math.sin(a2);
            const px = -ry * sd * 3;
            const py = rx * sd * 3;
            const w1 = Math.sin(world.time * 4 + fn.id + sd * 2) * 3;
            gl.moveTo(at.x + px, at.y + py)
              .quadraticCurveTo(
                at.x + px + rx * 8 - ry * w1 * 0.5,
                at.y + py + ry * 8 + rx * w1 * 0.5,
                at.x + px + rx * 15 - ry * w1,
                at.y + py + ry * 15 + rx * w1,
              )
              .stroke({ width: 1.1, color: 0xffe9a8, alpha: 0.4 - Math.abs(sd) * 0.1 });
          }
          break;
        }
      }
    }
  }
}

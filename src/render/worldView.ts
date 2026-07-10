import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/types';
import { toSunVec, isLit } from '../sim/light';
import { dot, scale, add } from '../sim/vec';

const SHADOW_ALPHA = 0.42;
const ROCK_FILL = 0x3c4353;
const ROCK_FILL_RICH = 0x4a4360;
const ROCK_RIM_LIT = 0xd8e2f2;
const ROCK_DARK = 0x0a0d18;

/**
 * Draws suns, parallel-light shadow volumes, and asteroids (lit rim +
 * faceted dark side). Redrawn every frame — trivially cheap at map scale.
 */
export class WorldView {
  readonly container = new Container();
  private shadows = new Graphics();
  private rocks = new Graphics();
  private sun = new Graphics();
  private rays = new Graphics();

  constructor() {
    this.container.addChild(this.rays, this.shadows, this.rocks, this.sun);
    this.sun.blendMode = 'add';
    this.rays.blendMode = 'add';
  }

  update(world: World, judder?: Map<number, { x: number; y: number }>): void {
    const toSun = toSunVec(world.sun);
    const diag = Math.hypot(world.width, world.height);
    const shadowLen = diag * 1.5;

    // --- Shadow volumes -----------------------------------------------------
    const sh = this.shadows;
    sh.clear();
    for (const a of world.asteroids) {
      const px = -toSun.y * a.radius;
      const py = toSun.x * a.radius;
      const ax = a.pos.x + px;
      const ay = a.pos.y + py;
      const bx = a.pos.x - px;
      const by = a.pos.y - py;
      sh.poly([
        ax, ay,
        bx, by,
        bx - toSun.x * shadowLen, by - toSun.y * shadowLen,
        ax - toSun.x * shadowLen, ay - toSun.y * shadowLen,
      ]).fill({ color: 0x000000, alpha: SHADOW_ALPHA });
    }

    // --- Asteroids ------------------------------------------------------------
    const g = this.rocks;
    g.clear();
    for (const a of world.asteroids) {
      // a scarab's shove makes the whole rock judder (render-only offset)
      const j = judder?.get(a.id);
      const apos = j ? { x: a.pos.x + j.x, y: a.pos.y + j.y } : a.pos;
      // is this rock itself standing in another rock's shadow? Sample the
      // sunward face so the drawn lighting agrees with what plants feel.
      const perp = { x: -toSun.y, y: toSun.x };
      let litFrac = 0;
      for (const off of [-0.65, 0, 0.65]) {
        const sample = {
          x: a.pos.x + toSun.x * a.radius * 0.9 + perp.x * a.radius * off,
          y: a.pos.y + toSun.y * a.radius * 0.9 + perp.y * a.radius * off,
        };
        if (isLit(sample, toSun, world.asteroids)) litFrac += 1 / 3;
      }
      const world_pts: number[] = [];
      for (const p of a.shape) world_pts.push(apos.x + p.x, apos.y + p.y);
      g.poly(world_pts).fill({ color: a.rich ? ROCK_FILL_RICH : ROCK_FILL });
      if (litFrac < 0.99) {
        // eclipsed: the whole face falls dark, matching the shadow volume
        g.poly(world_pts).fill({ color: ROCK_DARK, alpha: (1 - litFrac) * 0.5 });
      }

      // faceted dark side: consecutive vertices facing away from the sun + center
      const n = a.shape.length;
      let darkPts: number[] | null = null;
      for (let i = 0; i <= n; i++) {
        const p = a.shape[i % n];
        const facing = dot(p, toSun) / Math.hypot(p.x, p.y);
        if (facing < 0.05) {
          if (!darkPts) darkPts = [];
          darkPts.push(apos.x + p.x, apos.y + p.y);
        } else if (darkPts && darkPts.length >= 4) {
          darkPts.push(apos.x, apos.y);
          g.poly(darkPts).fill({ color: ROCK_DARK, alpha: 0.5 });
          darkPts = null;
        } else {
          darkPts = null;
        }
      }
      if (darkPts && darkPts.length >= 4) {
        darkPts.push(apos.x, apos.y);
        g.poly(darkPts).fill({ color: ROCK_DARK, alpha: 0.5 });
      }

      // lit rim segments
      for (let i = 0; i < n; i++) {
        const p0 = a.shape[i];
        const p1 = a.shape[(i + 1) % n];
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const facing = dot(mid, toSun) / Math.hypot(mid.x, mid.y);
        if (facing > 0.3) {
          g.moveTo(apos.x + p0.x, apos.y + p0.y)
            .lineTo(apos.x + p1.x, apos.y + p1.y)
            .stroke({
              width: 2.5,
              color: ROCK_RIM_LIT,
              alpha: (0.28 + facing * 0.45) * (0.15 + 0.85 * litFrac),
            });
        }
      }

      if (a.rich) {
        // mineral veins: sparkle dots
        for (let i = 0; i < 5; i++) {
          const p = a.shape[(i * 3) % n];
          g.circle(apos.x + p.x * 0.55, apos.y + p.y * 0.55, 2.2).fill({
            color: 0xc9a4ff,
            alpha: 0.8,
          });
        }
      }
    }

    // --- Sun disc + glow + faint parallel rays (dims in sudden death) --------
    const dim = world.sunFactor;
    const sunPos = scale(toSun, diag * 0.62);
    const s = this.sun;
    s.clear();
    s.circle(sunPos.x, sunPos.y, 260).fill({ color: 0xfff2c9, alpha: 0.05 * dim });
    s.circle(sunPos.x, sunPos.y, 150).fill({ color: 0xfff2c9, alpha: 0.09 * dim });
    s.circle(sunPos.x, sunPos.y, 80).fill({ color: 0xfff6da, alpha: 0.35 * dim });
    s.circle(sunPos.x, sunPos.y, 52).fill({
      color: dim > 0.5 ? 0xfffbef : 0xffcf9e,
      alpha: 0.35 + dim * 0.65,
    });

    const r = this.rays;
    r.clear();
    const perp = { x: -toSun.y, y: toSun.x };
    for (let i = -5; i <= 5; i++) {
      const off = i * diag * 0.09;
      const start = add(sunPos, scale(perp, off));
      const end = add(start, scale(toSun, -diag * 1.35));
      r.moveTo(start.x, start.y)
        .lineTo(end.x, end.y)
        .stroke({ width: 2, color: 0xfff2c9, alpha: 0.035 * dim });
    }
  }
}

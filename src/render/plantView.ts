import { Container, Graphics } from 'pixi.js';
import type { Plant, World } from '../sim/types';
import { FACTIONS, type FactionColors } from '../content/factions';
import { rot, scale, add } from '../sim/vec';
import { substrateHalfAngle } from '../sim/plant';

interface Entry {
  g: Graphics;
  key: string;
}

const HUSK_STEM = 0x5a5348;
const HUSK_ROOT = 0x49423a;
const HUSK_HEART = 0x6b6257;
const WOUND = 0x3a2c22;

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    ((ar + (br - ar) * t) << 16) | (((ag + (bg - ag) * t) & 0xff) << 8) | ((ab + (bb - ab) * t) & 0xff)
  );
}

/**
 * One cached Graphics per plant (rebuilt when its render key changes) plus a
 * shared per-frame overlay for armed-cone pulses and charge arcs.
 */
export class PlantView {
  readonly container = new Container();
  readonly overlay = new Graphics();
  private entries = new Map<number, Entry>();

  constructor() {
    this.container.addChild(this.overlay);
  }

  update(world: World): void {
    const alive = new Set<number>();
    for (const plant of world.plants) {
      alive.add(plant.id);
      const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
      if (!ast) continue;

      let e = this.entries.get(plant.id);
      if (!e) {
        e = { g: new Graphics(), key: '' };
        this.container.addChildAt(e.g, this.container.children.length - 1); // under overlay
        this.entries.set(plant.id, e);
      }
      e.g.position.set(ast.pos.x, ast.pos.y);

      const starveBand = Math.floor((plant.energy / Math.max(plant.capacity, 1)) * 10);
      const chargeSig = plant.parts
        .filter((p) => !p.dead && p.kind === 'cone')
        .map((p) => Math.floor(p.charge / 5))
        .join('.');
      const key = `${plant.version}:${starveBand}:${chargeSig}`;
      if (key !== e.key) {
        e.key = key;
        drawPlant(e.g, plant, paletteFor(world, plant));
      }
    }
    for (const [id, e] of this.entries) {
      if (!alive.has(id)) {
        e.g.destroy();
        this.entries.delete(id);
      }
    }
    this.drawOverlay(world);
  }

  /** Pulsing rings on armed cones (any colony — a visible threat/promise). */
  private drawOverlay(world: World): void {
    const g = this.overlay;
    g.clear();
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 5);
    for (const plant of world.plants) {
      if (!plant.alive) continue;
      const pal = paletteFor(world, plant);
      if (world.time < plant.blessedUntil) {
        const hb = plant.parts[0].base;
        g.circle(plant.astPos.x + hb.x, plant.astPos.y + hb.y, 16 + pulse * 6).stroke({
          width: 2,
          color: pal.heartCore,
          alpha: 0.3 + pulse * 0.4,
        });
      }
      for (const p of plant.parts) {
        if (p.dead || p.kind !== 'cone' || p.armedAt < 0) continue;
        const x = plant.astPos.x + p.tip.x;
        const y = plant.astPos.y + p.tip.y;
        g.circle(x, y, 8 + pulse * 4).stroke({
          width: 1.8,
          color: pal.coneArmed,
          alpha: 0.35 + pulse * 0.45,
        });
      }
    }
  }
}

function paletteFor(world: World, plant: Plant): FactionColors {
  const colony = world.colonies.find((c) => c.id === plant.colonyId);
  const palettes = FACTIONS[plant.faction].palettes;
  return palettes[Math.min(colony?.palette ?? 0, palettes.length - 1)];
}

function drawPlant(g: Graphics, plant: Plant, c: FactionColors): void {
  const f = FACTIONS[plant.faction];
  const starving = plant.alive && plant.energy < plant.capacity * 0.15;
  g.clear();

  // terraformed substrate bed: an arc of shed litter around the anchor.
  // Beds of one colony that touch are also the energy-sharing network.
  if (plant.alive) {
    const r = Math.hypot(plant.parts[0].base.x, plant.parts[0].base.y);
    const half = substrateHalfAngle(plant);
    const a0 = plant.anchorAngle - half;
    g.moveTo(Math.cos(a0) * (r + 1.5), Math.sin(a0) * (r + 1.5))
      .arc(0, 0, r + 1.5, a0, plant.anchorAngle + half)
      .stroke({ width: 4.5, color: c.litter, alpha: 0.9 });
  }

  for (const p of plant.parts) {
    if (p.dead && (p.kind === 'leaf' || p.kind === 'cone')) continue; // they drop
    const dmg = p.dead ? 0 : 1 - p.hp / p.maxHp;
    switch (p.kind) {
      case 'root': {
        const color = p.dead ? HUSK_ROOT : dmg > 0.05 ? lerpColor(c.root, WOUND, dmg * 0.8) : c.root;
        g.moveTo(p.base.x, p.base.y)
          .lineTo(p.tip.x, p.tip.y)
          .stroke({ width: 3.5, color, alpha: 0.9 });
        break;
      }
      case 'stem': {
        const width = p.onBranch ? 2.2 : Math.max(4.5 - p.depth * 0.18, 2.6);
        let color: number;
        if (p.dead) color = HUSK_STEM;
        else {
          color = p.hardened ? c.stemOld : c.stem;
          if (dmg > 0.05) color = lerpColor(color, WOUND, dmg * 0.85);
        }
        g.moveTo(p.base.x, p.base.y)
          .lineTo(p.tip.x, p.tip.y)
          .stroke({ width, color, alpha: p.dead ? 0.8 : 1 });
        // visible crack on badly wounded wood
        if (!p.dead && dmg > 0.35) {
          const mx = (p.base.x + p.tip.x) / 2;
          const my = (p.base.y + p.tip.y) / 2;
          const perp = rot(p.dir, Math.PI / 2);
          const cl = width * 0.9 + dmg * 2;
          g.moveTo(mx - perp.x * cl, my - perp.y * cl)
            .lineTo(mx + perp.x * cl, my + perp.y * cl)
            .stroke({ width: 1, color: 0x14100c, alpha: 0.9 });
        }
        break;
      }
      case 'leaf': {
        const color = starving
          ? c.leafStarving
          : p.shade === 0
            ? c.leaf
            : p.shade === 1
              ? c.leafCanopy
              : c.leafShaded;
        const alpha = p.shade === 0 ? 0.95 : p.shade === 1 ? 0.7 : 0.5;
        if (f.render.leaf === 'broad') {
          // broad leaf: a pointed oval blade with a midrib
          const perp = rot(p.dir, Math.PI / 2);
          const w = p.len * 0.32;
          const m1 = add(p.base, scale(p.dir, p.len * 0.45));
          g.poly([
            p.base.x, p.base.y,
            m1.x + perp.x * w, m1.y + perp.y * w,
            p.tip.x, p.tip.y,
            m1.x - perp.x * w, m1.y - perp.y * w,
          ]).fill({ color, alpha });
          g.moveTo(p.base.x, p.base.y)
            .lineTo(p.tip.x, p.tip.y)
            .stroke({ width: 0.8, color: 0x1c3318, alpha: alpha * 0.7 });
        } else {
          for (const spread of [-0.38, 0, 0.38]) {
            const d = rot(p.dir, spread);
            const tip = add(p.base, scale(d, p.len * (spread === 0 ? 1 : 0.8)));
            g.moveTo(p.base.x, p.base.y)
              .lineTo(tip.x, tip.y)
              .stroke({ width: 1.6, color, alpha });
          }
        }
        break;
      }
      case 'cone': {
        const frac = Math.min(p.charge / f.repro.coneEnergy, 1);
        const armed = p.armedAt >= 0;
        if (f.render.repro === 'flower') {
          const at = add(p.base, scale(p.dir, 3));
          if (armed) {
            // ripe fruit: a glossy orb
            g.circle(at.x, at.y, 4.6).fill({ color: c.coneArmed });
            g.circle(at.x - 1.3, at.y - 1.3, 1.3).fill({ color: 0xfff2d9, alpha: 0.85 });
          } else {
            // flower: petal rosette blooming with charge
            const r = 1.6 + frac * 3.2;
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * Math.PI * 2;
              g.circle(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, r * 0.75).fill({
                color: c.cone,
                alpha: 0.9,
              });
            }
            g.circle(at.x, at.y, r * 0.55).fill({ color: c.heartCore });
          }
        } else {
          const w = 2.5 + frac * 2.5;
          const l = 4 + frac * 5;
          const perp = rot(p.dir, Math.PI / 2);
          const tip = add(p.base, scale(p.dir, l));
          g.poly([
            p.base.x + perp.x * w, p.base.y + perp.y * w,
            tip.x, tip.y,
            p.base.x - perp.x * w, p.base.y - perp.y * w,
          ]).fill({ color: armed ? c.coneArmed : c.cone });
          if (!armed && frac > 0.02) {
            // charge arc around the ripening cone
            g.moveTo(p.base.x, p.base.y - 7)
              .arc(p.base.x, p.base.y, 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
              .stroke({ width: 1.4, color: c.coneArmed, alpha: 0.7 });
          }
        }
        break;
      }
      case 'heart': {
        if (f.render.heart === 'bulb') {
          // Anthophyta heartseed: a swollen tuber-bulb, glow = stored energy
          const up = plant.up;
          const at = add(p.base, scale(up, 5));
          if (p.dead) {
            g.circle(at.x, at.y, 8).fill({ color: HUSK_HEART, alpha: 0.75 });
            break;
          }
          const ratio = Math.max(0, Math.min(1, plant.energy / plant.capacity));
          const body = dmg > 0.05 ? lerpColor(c.heart, WOUND, dmg * 0.7) : c.heart;
          g.circle(at.x, at.y, 8).fill({ color: body });
          g.circle(at.x, at.y, 8).stroke({ width: 1.2, color: 0x241a20, alpha: 0.6 });
          const glow = starving ? c.leafStarving : c.heartCore;
          g.circle(at.x, at.y, 2 + ratio * 4.5).fill({ color: glow, alpha: 0.4 + ratio * 0.5 });
          break;
        }
        // The heartseed is a pinecone sitting on the rock, oriented along the
        // plant's up vector. Energy = the cone's inner glow filling upward.
        const up = plant.up;
        const perp = rot(up, Math.PI / 2);
        const at = (t: number, w: number): [number, number] => [
          p.base.x + up.x * t + perp.x * w,
          p.base.y + up.y * t + perp.y * w,
        ];
        const kite = (s: number): number[] => [
          ...at(0.5 * s, -7 * s),
          ...at(9 * s, -5.2 * s),
          ...at(16 * s, 0),
          ...at(9 * s, 5.2 * s),
          ...at(0.5 * s, 7 * s),
        ];
        if (p.dead) {
          g.poly(kite(1)).fill({ color: HUSK_HEART, alpha: 0.75 });
          break;
        }
        const ratio = Math.max(0, Math.min(1, plant.energy / plant.capacity));
        const body = dmg > 0.05 ? lerpColor(c.cone, WOUND, dmg * 0.7) : c.cone;
        g.poly(kite(1)).fill({ color: body });
        // energy glow fills the cone from its base upward
        if (ratio > 0.03) {
          const glow = starving ? c.leafStarving : c.heartCore;
          g.poly(kite(0.34 + 0.56 * ratio)).fill({ color: glow, alpha: 0.35 + ratio * 0.45 });
          g.circle(p.base.x + up.x * 4, p.base.y + up.y * 4, 2.6).fill({ color: glow });
        }
        // scale chevrons for the pinecone read
        for (const t of [4.5, 8.5, 12]) {
          const w = 6 * (1 - t / 18);
          g.moveTo(...at(t + 2.2, -w))
            .lineTo(...at(t, 0))
            .lineTo(...at(t + 2.2, w))
            .stroke({ width: 1.1, color: 0x241a10, alpha: 0.65 });
        }
        break;
      }
    }
  }
}

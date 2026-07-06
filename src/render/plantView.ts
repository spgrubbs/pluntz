import { Container, Graphics } from 'pixi.js';
import type { Plant, World } from '../sim/types';
import { FACTIONS, type FactionColors } from '../content/factions';
import { rot, scale, add } from '../sim/vec';

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
        for (const spread of [-0.38, 0, 0.38]) {
          const d = rot(p.dir, spread);
          const tip = add(p.base, scale(d, p.len * (spread === 0 ? 1 : 0.8)));
          g.moveTo(p.base.x, p.base.y)
            .lineTo(tip.x, tip.y)
            .stroke({ width: 1.6, color, alpha });
        }
        break;
      }
      case 'cone': {
        const frac = Math.min(p.charge / f.repro.coneEnergy, 1);
        const armed = p.armedAt >= 0;
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
        break;
      }
      case 'heart': {
        if (p.dead) {
          g.circle(p.base.x, p.base.y, 9).fill({ color: HUSK_HEART, alpha: 0.7 });
          g.circle(p.base.x, p.base.y, 4.2).fill({ color: 0x3a352e });
          break;
        }
        const ratio = Math.max(0, Math.min(1, plant.energy / plant.capacity));
        const heartColor = dmg > 0.05 ? lerpColor(c.heart, WOUND, dmg * 0.7) : c.heart;
        g.circle(p.base.x, p.base.y, 9).fill({ color: heartColor, alpha: 0.9 });
        g.circle(p.base.x, p.base.y, 4.2).fill({ color: c.heartCore });
        if (ratio > 0.02) {
          g.moveTo(p.base.x, p.base.y - 13)
            .arc(p.base.x, p.base.y, 13, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2)
            .stroke({ width: 2.5, color: starving ? c.leafStarving : c.heartCore, alpha: 0.9 });
        }
        break;
      }
    }
  }
}

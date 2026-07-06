import { Container, Graphics } from 'pixi.js';
import type { Plant, World } from '../sim/types';
import { FACTIONS } from '../content/factions';
import { rot, scale, add } from '../sim/vec';

interface Entry {
  g: Graphics;
  key: string;
}

/**
 * One Graphics per plant, drawn in asteroid-local coordinates and positioned
 * at the asteroid — so dragging a rock moves its garden for free. Rebuilt
 * only when the plant's render key changes (structure, lighting, starvation).
 */
export class PlantView {
  readonly container = new Container();
  private entries = new Map<number, Entry>();

  update(world: World): void {
    const alive = new Set<number>();
    for (const plant of world.plants) {
      alive.add(plant.id);
      const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
      if (!ast) continue;

      let e = this.entries.get(plant.id);
      if (!e) {
        e = { g: new Graphics(), key: '' };
        this.container.addChild(e.g);
        this.entries.set(plant.id, e);
      }
      e.g.position.set(ast.pos.x, ast.pos.y);

      const starveBand = Math.floor((plant.energy / Math.max(plant.capacity, 1)) * 10);
      const key = `${plant.version}:${starveBand}`;
      if (key !== e.key) {
        e.key = key;
        drawPlant(e.g, plant);
      }
    }
    for (const [id, e] of this.entries) {
      if (!alive.has(id)) {
        e.g.destroy();
        this.entries.delete(id);
      }
    }
  }
}

const HUSK_STEM = 0x5a5348;
const HUSK_ROOT = 0x49423a;
const HUSK_HEART = 0x6b6257;

function drawPlant(g: Graphics, plant: Plant): void {
  const f = FACTIONS[plant.faction];
  const c = f.colors;
  const starving = plant.alive && plant.energy < plant.capacity * 0.15;
  g.clear();

  for (const p of plant.parts) {
    if (p.dead && p.kind === 'leaf') continue; // dead needles simply drop
    switch (p.kind) {
      case 'root': {
        g.moveTo(p.base.x, p.base.y)
          .lineTo(p.tip.x, p.tip.y)
          .stroke({ width: 3.5, color: p.dead ? HUSK_ROOT : c.root, alpha: 0.9 });
        break;
      }
      case 'stem': {
        const old = p.hardened;
        const width = p.onBranch ? 2.2 : Math.max(4.5 - p.depth * 0.18, 2.6);
        g.moveTo(p.base.x, p.base.y)
          .lineTo(p.tip.x, p.tip.y)
          .stroke({
            width,
            color: p.dead ? HUSK_STEM : old ? c.stemOld : c.stem,
            alpha: p.dead ? 0.8 : 1,
          });
        break;
      }
      case 'leaf': {
        // needle fan: three blades around the leaf direction
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
      case 'heart': {
        if (p.dead) {
          g.circle(p.base.x, p.base.y, 9).fill({ color: HUSK_HEART, alpha: 0.7 });
          g.circle(p.base.x, p.base.y, 4.2).fill({ color: 0x3a352e });
          break;
        }
        const ratio = Math.max(0, Math.min(1, plant.energy / plant.capacity));
        g.circle(p.base.x, p.base.y, 9).fill({ color: c.heart, alpha: 0.9 });
        g.circle(p.base.x, p.base.y, 4.2).fill({ color: c.heartCore });
        // energy ring
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

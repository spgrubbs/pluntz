import { Graphics } from 'pixi.js';
import type { SimEvent, World } from '../sim/types';
import { FACTIONS } from '../content/factions';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  drag: number;
}

const MAX_PARTICLES = 700;

/**
 * Render-only particle layer. Bursts come from sim events (impacts, deaths,
 * launches); a slow ambient pass makes wounded parts visibly bleed motes so
 * part health reads at a glance without a health bar.
 */
export class FxView {
  readonly g = new Graphics();
  private ps: Particle[] = [];
  private rand = (a: number, b: number): number => a + Math.random() * (b - a);

  ingest(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'impact':
          this.burst(e.x, e.y, Math.min(4 + (e.power ?? 5) * 0.4, 14), 0xffd9a0, 60, 0.35);
          this.burst(e.x, e.y, 3, 0x9aa2b0, 40, 0.5);
          break;
        case 'partDied': {
          const pal = e.faction ? FACTIONS[e.faction].palettes[0] : null;
          if (e.kind === 'leaf') this.burst(e.x, e.y, 4, pal?.leafShaded ?? 0x2e8f66, 22, 0.8);
          else if (e.kind === 'heart') {
            this.burst(e.x, e.y, 16, pal?.heartCore ?? 0xffd257, 55, 1.4);
            this.burst(e.x, e.y, 10, pal?.leaf ?? 0x3ee89c, 35, 1.8);
          } else this.burst(e.x, e.y, 5, 0x8a6d4f, 30, 0.7);
          break;
        }
        case 'shatter':
          this.burst(e.x, e.y, 6 + (e.power ?? 6) * 0.5, 0x8a8f9c, 45, 0.6);
          break;
        case 'seedLaunch':
          this.burst(e.x, e.y, 6, 0xf5eecb, 35, 0.5);
          break;
        case 'seedLand':
        case 'sprout':
          this.burst(e.x, e.y, 8, 0xcfc4a8, 30, 0.6); // dust
          this.burst(e.x, e.y, 6, 0x9df5c4, 25, 1.1); // green spark
          break;
        case 'seedFizzle':
          this.burst(e.x, e.y, 4, 0x6a705f, 18, 0.9);
          break;
      }
    }
  }

  /** Wounded parts (hp < 50%) shed faint amber motes — living damage readout. */
  ambientWounds(world: World, dt: number): void {
    for (const plant of world.plants) {
      if (!plant.alive) continue;
      for (const p of plant.parts) {
        if (p.dead || p.hp >= p.maxHp * 0.5) continue;
        if (Math.random() < dt * 1.2) {
          const x = plant.astPos.x + (p.base.x + p.tip.x) / 2;
          const y = plant.astPos.y + (p.base.y + p.tip.y) / 2;
          this.spawn({
            x,
            y,
            vx: this.rand(-4, 4),
            vy: this.rand(-8, -2),
            life: 0,
            maxLife: this.rand(0.8, 1.4),
            size: 1.4,
            color: 0xe8b054,
            drag: 0.9,
          });
        }
      }
    }
  }

  private burst(
    x: number,
    y: number,
    count: number,
    color: number,
    speed: number,
    lifeScale: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * this.rand(0.3, 1);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        maxLife: this.rand(0.3, 0.7) * lifeScale,
        size: this.rand(1.2, 2.6),
        color,
        drag: 0.86,
      });
    }
  }

  private spawn(p: Particle): void {
    if (this.ps.length >= MAX_PARTICLES) this.ps.shift();
    this.ps.push(p);
  }

  update(dt: number): void {
    const g = this.g;
    g.clear();
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.ps.splice(i, 1);
        continue;
      }
      const damp = Math.pow(p.drag, dt * 60);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.life / p.maxLife;
      g.circle(p.x, p.y, p.size * (0.5 + t * 0.5)).fill({ color: p.color, alpha: t * 0.9 });
    }
  }
}

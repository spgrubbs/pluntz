import { Graphics } from 'pixi.js';
import type { SimEvent, World } from '../sim/types';
import { FACTIONS } from '../content/factions';

type ParticleKind = 'mote' | 'spark' | 'chip' | 'petal';

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
  kind?: ParticleKind; // default 'mote'
  spin?: number; // chips & petals tumble
  angle?: number;
}

const MAX_PARTICLES = 1000;

/**
 * Render-only particle layer. Bursts come from sim events (impacts, deaths,
 * launches); a slow ambient pass makes wounded parts visibly bleed motes so
 * part health reads at a glance without a health bar.
 */
export class FxView {
  readonly g = new Graphics();
  private ps: Particle[] = [];
  private rand = (a: number, b: number): number => a + Math.random() * (b - a);

  constructor() {
    this.g.blendMode = 'add'; // everything glows — Reassembly-style
  }

  /** A crisp expanding shockwave ring of particles. */
  private ring(x: number, y: number, count: number, color: number, speed: number, life: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0,
        maxLife: life,
        size: 1.8,
        color,
        drag: 0.9,
      });
    }
  }

  ingest(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'impact':
          this.burst(e.x, e.y, Math.min(4 + (e.power ?? 5) * 0.4, 12), 0xffd9a0, 90, 0.4, 'spark');
          this.burst(e.x, e.y, 3, 0x9aa2b0, 40, 0.5, 'chip');
          break;
        case 'partDied': {
          const pal = e.faction ? FACTIONS[e.faction].palettes[0] : null;
          if (e.kind === 'leaf') this.burst(e.x, e.y, 4, pal?.leafShaded ?? 0x2e8f66, 22, 1.1, 'petal');
          else if (e.kind === 'cone') {
            // plucked fruit / spent cone: petals and scales scatter
            this.burst(e.x, e.y, 7, pal?.cone ?? 0x9a6b3f, 35, 1.1, 'petal');
          } else if (e.kind === 'heart') {
            this.ring(e.x, e.y, 22, pal?.heartCore ?? 0xffd257, 85, 0.9);
            this.burst(e.x, e.y, 14, pal?.heartCore ?? 0xffd257, 80, 1.2, 'spark');
            this.burst(e.x, e.y, 10, pal?.leaf ?? 0x3ee89c, 35, 1.8, 'petal');
          } else this.burst(e.x, e.y, 5, 0x8a6d4f, 30, 0.7, 'chip');
          break;
        }
        case 'shatter':
          this.ring(e.x, e.y, 10, 0xb9c0cf, 70, 0.4);
          this.burst(e.x, e.y, 6 + (e.power ?? 6) * 0.5, 0x8a8f9c, 55, 0.8, 'chip');
          this.burst(e.x, e.y, 4, 0xffd9a0, 90, 0.35, 'spark');
          break;
        case 'seedLaunch':
          this.ring(e.x, e.y, 10, 0xf5eecb, 60, 0.35);
          this.burst(e.x, e.y, 6, 0xf5eecb, 70, 0.5, 'spark');
          break;
        case 'seedLand':
        case 'sprout':
          this.ring(e.x, e.y, 12, 0x9df5c4, 55, 0.5);
          this.burst(e.x, e.y, 6, 0xcfc4a8, 35, 0.6, 'chip'); // kicked-up dirt
          this.burst(e.x, e.y, 6, 0x9df5c4, 25, 1.3, 'petal'); // new life
          break;
        case 'seedFizzle':
          this.burst(e.x, e.y, 4, 0x6a705f, 18, 0.9);
          break;
        case 'grow':
          this.burst(e.x, e.y, 2, 0xaef5cf, 14, 0.8, 'petal');
          break;
        case 'bless':
          this.ring(e.x, e.y, 16, 0xffd257, 70, 0.7);
          this.burst(e.x, e.y, 18, 0xffd257, 45, 1.6);
          this.burst(e.x, e.y, 8, 0xfff2c9, 20, 2.2);
          break;
        case 'ping':
          this.ring(e.x, e.y, 14, 0x69d2ff, 90, 0.6);
          this.burst(e.x, e.y, 8, 0x69d2ff, 40, 1.0);
          break;
        case 'lure':
          this.ring(e.x, e.y, 14, 0xff8ac2, 80, 0.7);
          this.burst(e.x, e.y, 10, 0xff8ac2, 40, 1.2);
          break;
      }
    }
  }

  /** Continuous ambience: seed trails, blessed motes, drifting space dust. */
  ambientFlow(world: World, dt: number): void {
    // seed contrails
    for (const s of world.seeds) {
      if (Math.random() < dt * 30) {
        this.spawn({
          x: s.pos.x + this.rand(-2, 2),
          y: s.pos.y + this.rand(-2, 2),
          vx: -s.vel.x * 0.08 + this.rand(-4, 4),
          vy: -s.vel.y * 0.08 + this.rand(-4, 4),
          life: 0,
          maxLife: this.rand(0.4, 0.9),
          size: 1.5,
          color: 0xe8f5c0,
          drag: 0.92,
        });
      }
    }
    // blessed plants radiate rising gold motes
    for (const plant of world.plants) {
      if (!plant.alive || world.time >= plant.blessedUntil) continue;
      if (Math.random() < dt * 6) {
        const parts = plant.parts.filter((p) => !p.dead);
        const p = parts[(Math.random() * parts.length) | 0];
        this.spawn({
          x: plant.astPos.x + p.tip.x,
          y: plant.astPos.y + p.tip.y,
          vx: this.rand(-5, 5),
          vy: this.rand(-14, -6),
          life: 0,
          maxLife: this.rand(0.7, 1.3),
          size: 1.6,
          color: 0xffd257,
          drag: 0.94,
        });
      }
    }
    // infected parts exhale violet spore motes
    for (const plant of world.plants) {
      if (!plant.alive) continue;
      for (const p of plant.parts) {
        if (p.dead || p.infectedBy < 0) continue;
        if (Math.random() < dt * 1.5) {
          this.spawn({
            x: plant.astPos.x + (p.base.x + p.tip.x) / 2,
            y: plant.astPos.y + (p.base.y + p.tip.y) / 2,
            vx: this.rand(-6, 6),
            vy: this.rand(-6, 6),
            life: 0,
            maxLife: this.rand(0.8, 1.5),
            size: 1.5,
            color: 0xa86ae8,
            drag: 0.95,
          });
        }
      }
    }
    // scarabs grinding rock throw dust and chips from the contact point
    for (const fn of world.fauna) {
      if (fn.kind === 'scarabaeidae' && fn.state === 'push' && Math.random() < dt * 16) {
        this.spawn({
          x: fn.pos.x + this.rand(-8, 8),
          y: fn.pos.y + this.rand(-8, 8),
          vx: -fn.vel.x * 1.4 + this.rand(-18, 18),
          vy: -fn.vel.y * 1.4 + this.rand(-18, 18),
          life: 0,
          maxLife: this.rand(0.5, 1.2),
          size: this.rand(1.2, 2.4),
          color: 0xb5a888,
          drag: 0.9,
          kind: 'chip',
          spin: this.rand(-8, 8),
          angle: this.rand(0, 6.28),
        });
      }
      // lanterns shed slow golden sparks
      if (fn.kind === 'lampyridae' && Math.random() < dt * 7) {
        this.spawn({
          x: fn.pos.x + this.rand(-4, 4),
          y: fn.pos.y + this.rand(-4, 4),
          vx: this.rand(-7, 7),
          vy: this.rand(-7, 7),
          life: 0,
          maxLife: this.rand(0.8, 1.6),
          size: 1.4,
          color: 0xffe9a8,
          drag: 0.95,
        });
      }
    }
    // faint drifting dust across the void
    if (Math.random() < dt * 3) {
      this.spawn({
        x: this.rand(-world.width / 2, world.width / 2),
        y: this.rand(-world.height / 2, world.height / 2),
        vx: this.rand(-6, 6),
        vy: this.rand(-6, 6),
        life: 0,
        maxLife: this.rand(2.5, 5),
        size: this.rand(0.8, 1.6),
        color: 0x7a86a3,
        drag: 1,
      });
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
    kind: ParticleKind = 'mote',
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
        drag: kind === 'spark' ? 0.94 : 0.86,
        kind,
        spin: this.rand(-7, 7),
        angle: a,
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
      switch (p.kind ?? 'mote') {
        case 'spark': {
          // a streak stretched along its own motion, white-hot at the head
          const sp = Math.hypot(p.vx, p.vy) + 1;
          const lx = (p.vx / sp) * Math.min(sp * 0.12, 10) * (0.4 + t);
          const ly = (p.vy / sp) * Math.min(sp * 0.12, 10) * (0.4 + t);
          g.moveTo(p.x - lx, p.y - ly)
            .lineTo(p.x, p.y)
            .stroke({ width: p.size * 0.8, color: p.color, alpha: t * 0.9 });
          g.circle(p.x, p.y, p.size * 0.5).fill({ color: 0xffffff, alpha: t * 0.6 });
          break;
        }
        case 'chip': {
          // a tumbling shard of stone
          p.angle = (p.angle ?? 0) + (p.spin ?? 0) * dt;
          const ca = Math.cos(p.angle);
          const sa = Math.sin(p.angle);
          const r = p.size * (0.6 + t * 0.4);
          g.poly([
            p.x + ca * r * 1.4, p.y + sa * r * 1.4,
            p.x - sa * r, p.y + ca * r,
            p.x - ca * r * 1.2, p.y - sa * r * 1.2,
            p.x + sa * r * 0.7, p.y - ca * r * 0.7,
          ]).fill({ color: p.color, alpha: t * 0.8 });
          break;
        }
        case 'petal': {
          // a little leaf-petal fluttering as it falls
          p.angle = (p.angle ?? 0) + (p.spin ?? 0) * dt;
          const flutter = Math.sin(p.life * 9 + p.x) * 0.6;
          const ca = Math.cos(p.angle + flutter);
          const sa = Math.sin(p.angle + flutter);
          const r = p.size * 1.3;
          g.poly([
            p.x + ca * r, p.y + sa * r,
            p.x - sa * r * 0.6, p.y + ca * r * 0.6,
            p.x - ca * r * 0.8, p.y - sa * r * 0.8,
          ]).fill({ color: p.color, alpha: t * 0.85 });
          break;
        }
        default: {
          // soft mote: halo + core, the gentlest glow
          g.circle(p.x, p.y, p.size * (0.9 + t * 0.9)).fill({ color: p.color, alpha: t * 0.25 });
          g.circle(p.x, p.y, p.size * (0.5 + t * 0.5)).fill({ color: p.color, alpha: t * 0.9 });
        }
      }
    }
  }
}

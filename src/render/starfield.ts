import { Container, Graphics } from 'pixi.js';
import { makeRng } from '../sim/rng';

interface StarLayer {
  g: Graphics;
  parallax: number;
}

/**
 * Three parallax star layers drawn in screen space. Stars cover an area
 * generously larger than the map so a clamped camera never runs off the edge.
 */
export class Starfield {
  readonly container = new Container();
  private layers: StarLayer[] = [];

  constructor(worldW: number, worldH: number, seed: number) {
    const rng = makeRng(seed ^ 0x5eedf1e1);
    const spanW = worldW * 2.2;
    const spanH = worldH * 2.4;
    const specs = [
      { parallax: 0.15, count: 220, size: [0.6, 1.3], alpha: 0.5 },
      { parallax: 0.35, count: 140, size: [0.9, 1.8], alpha: 0.7 },
      { parallax: 0.6, count: 70, size: [1.2, 2.4], alpha: 0.9 },
    ];
    for (const s of specs) {
      const g = new Graphics();
      for (let i = 0; i < s.count; i++) {
        const x = rng.range(-spanW / 2, spanW / 2);
        const y = rng.range(-spanH / 2, spanH / 2);
        const r = rng.range(s.size[0], s.size[1]);
        const tint = rng.next() < 0.22 ? 0x9fc4ff : rng.next() < 0.12 ? 0xffd9a8 : 0xdde6f5;
        g.circle(x, y, r).fill({ color: tint, alpha: s.alpha * rng.range(0.5, 1) });
      }
      this.container.addChild(g);
      this.layers.push({ g, parallax: s.parallax });
    }
  }

  update(camX: number, camY: number, screenW: number, screenH: number): void {
    for (const l of this.layers) {
      l.g.position.set(screenW / 2 - camX * l.parallax, screenH / 2 - camY * l.parallax);
    }
  }
}

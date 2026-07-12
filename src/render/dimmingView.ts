import { Container, Graphics } from 'pixi.js';
import type { World } from '../sim/types';

/**
 * The Dimming (Long Road maps): a wall of permanent darkness devouring the
 * region from the west. Deep black layers hide what it has taken; the front
 * itself is a slow-breathing violet curtain so the player can always read
 * exactly how much road is left.
 */
export class DimmingView {
  readonly container = new Container();
  private dark = new Graphics();
  private rim = new Graphics();

  constructor() {
    this.rim.blendMode = 'add';
    this.container.addChild(this.dark, this.rim);
  }

  update(world: World): void {
    const g = this.dark;
    const r = this.rim;
    g.clear();
    r.clear();
    if (!world.dimming) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    const x = world.dimming.x;
    const top = -world.height / 2 - 500;
    const h = world.height + 1000;
    const left = -world.width / 2 - 600;

    // the swallowed lands: three deepening bands behind the front
    if (x - 500 > left) g.rect(left, top, x - 500 - left, h).fill({ color: 0x000004, alpha: 0.97 });
    g.rect(Math.max(x - 500, left), top, Math.min(500, x - left), h).fill({
      color: 0x02030a,
      alpha: 0.88,
    });
    g.rect(Math.max(x - 180, left), top, Math.min(180, x - left), h).fill({
      color: 0x05060f,
      alpha: 0.6,
    });

    // the curtain: a wavering violet edge, and dying embers behind it
    const steps = 30;
    let started = false;
    for (let k = 0; k <= steps; k++) {
      const y = top + (h * k) / steps;
      const wob =
        Math.sin(y * 0.012 + world.time * 0.7) * 14 + Math.sin(y * 0.05 - world.time * 0.4) * 5;
      if (!started) {
        r.moveTo(x + wob, y);
        started = true;
      } else r.lineTo(x + wob, y);
    }
    r.stroke({ width: 3, color: 0x7a5acF, alpha: 0.22 });
    // faint inner glow band along the curtain
    for (let k = 0; k < 8; k++) {
      const y = top + h * ((k + 0.5) / 8);
      const wob = Math.sin(y * 0.012 + world.time * 0.7) * 14;
      const pulse = 0.5 + 0.5 * Math.sin(world.time * 1.3 + k * 2.2);
      r.circle(x + wob - 30, y, 40 + pulse * 18).fill({ color: 0x5a3aa0, alpha: 0.05 });
    }
  }
}

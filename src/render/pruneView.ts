import { Graphics } from 'pixi.js';
import type { Vec2 } from '../sim/vec';

/** The in-progress prune swipe: a bright cut line following the finger. */
export class PruneView {
  readonly g = new Graphics();

  update(path: Vec2[] | null): void {
    const g = this.g;
    g.clear();
    if (!path || path.length < 2) return;
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.stroke({ width: 2.5, color: 0xff9d6b, alpha: 0.9 });
    const last = path[path.length - 1];
    g.circle(last.x, last.y, 4).fill({ color: 0xffc9a8, alpha: 0.9 });
  }
}

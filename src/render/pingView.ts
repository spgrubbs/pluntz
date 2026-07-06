import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';

/** The colony's attention marker: soft pulsing rings, fading near expiry. */
export class PingView {
  readonly g = new Graphics();

  update(world: World): void {
    const g = this.g;
    g.clear();
    const ping = world.ping;
    if (!ping) return;
    const remain = ping.expires - world.time;
    const fade = Math.min(remain / 5, 1);
    const pulse = (world.time * 1.2) % 1;
    g.circle(ping.x, ping.y, 10 + pulse * 26).stroke({
      width: 2,
      color: 0x69d2ff,
      alpha: (1 - pulse) * 0.7 * fade,
    });
    g.circle(ping.x, ping.y, 5).fill({ color: 0x69d2ff, alpha: 0.8 * fade });
    g.circle(ping.x, ping.y, 2).fill({ color: 0xd9f2ff, alpha: fade });
  }
}

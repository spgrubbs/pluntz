import { Graphics } from 'pixi.js';
import type { World } from '../sim/types';

/** The colony's attention marker: soft pulsing rings, fading near expiry. */
export class PingView {
  readonly g = new Graphics();

  update(world: World): void {
    const g = this.g;
    g.clear();
    this.marker(g, world, world.ping, 0x69d2ff, 0xd9f2ff);
    this.marker(g, world, world.lure, 0xff8ac2, 0xffe2f0); // the Lure scent
  }

  private marker(
    g: Graphics,
    world: World,
    ping: World['ping'],
    color: number,
    core: number,
  ): void {
    if (!ping) return;
    const remain = ping.expires - world.time;
    const fade = Math.min(remain / 5, 1);
    const pulse = (world.time * 1.2) % 1;
    g.circle(ping.x, ping.y, 10 + pulse * 26).stroke({
      width: 2,
      color,
      alpha: (1 - pulse) * 0.7 * fade,
    });
    g.circle(ping.x, ping.y, 5).fill({ color, alpha: 0.8 * fade });
    g.circle(ping.x, ping.y, 2).fill({ color: core, alpha: fade });
  }
}

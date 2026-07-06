import type { Vec2 } from './vec';
import { fromAngle } from './vec';
import type { Asteroid, SunState } from './types';

/** Unit vector pointing from any point toward the (infinitely distant) sun. */
export function toSunVec(sun: SunState): Vec2 {
  return fromAngle(sun.angle);
}

/**
 * Parallel-light occlusion: a point is lit unless the ray from it toward the
 * sun intersects any asteroid disc. Occlusion uses the collision radius, not
 * the decorative polygon.
 */
export function isLit(p: Vec2, toSun: Vec2, asteroids: Asteroid[]): boolean {
  for (const a of asteroids) {
    const lx = a.pos.x - p.x;
    const ly = a.pos.y - p.y;
    const tca = lx * toSun.x + ly * toSun.y;
    if (tca <= 0) continue; // asteroid is behind the point (away from sun)
    const d2 = lx * lx + ly * ly - tca * tca;
    if (d2 < a.radius * a.radius) return false;
  }
  return true;
}

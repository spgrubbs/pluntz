import type { Vec2 } from './vec';
import { fromAngle } from './vec';
import type { Asteroid, SunState } from './types';

/** 0 = fully lit, 1 = shaded by canopy (any plant's foliage), 2 = hard rock shadow. */
export type ShadeLevel = 0 | 1 | 2;

/**
 * Canopy occluders binned by coordinate perpendicular to the sun ray.
 * Parallel light means a leaf's shade ray keeps one perpendicular coordinate,
 * so each shade query only scans the segments in its own narrow band.
 */
export const CANOPY_BIN = 40;

export interface CanopyIndex {
  bins: Map<number, CanopySeg[]>;
}

export function canopyCross(x: number, y: number, toSun: Vec2): number {
  return x * toSun.y - y * toSun.x;
}

/** A world-space leaf segment that casts canopy shade. */
export interface CanopySeg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  plantId: number;
  group: number; // occlusion group — same-group needles never shade each other
}

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

/** Does the ray from (px,py) along (dx,dy) cross segment A-B? (t > 1 world unit) */
export function rayHitsSegment(
  px: number,
  py: number,
  dx: number,
  dy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const sx = bx - ax;
  const sy = by - ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-9) return false;
  const qx = ax - px;
  const qy = ay - py;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * dy - qy * dx) / denom;
  return t > 1 && u >= 0 && u <= 1;
}

/**
 * Full shade query for a leaf: hard rock shadow beats canopy shade.
 * Foliage in the leaf's own occlusion group (its branch) never shades it,
 * but the rest of its own plant does — architecture that self-shades pays.
 */
export function shadeAt(
  p: Vec2,
  toSun: Vec2,
  asteroids: Asteroid[],
  canopy: CanopySeg[],
  selfPlantId: number,
  selfGroup: number,
): ShadeLevel {
  if (!isLit(p, toSun, asteroids)) return 2;
  for (const s of canopy) {
    if (s.plantId === selfPlantId && s.group === selfGroup) continue;
    if (rayHitsSegment(p.x, p.y, toSun.x, toSun.y, s.ax, s.ay, s.bx, s.by)) return 1;
  }
  return 0;
}

import type { Asteroid } from './types';

/**
 * Radius of the asteroid's *drawn* polygon at a given angle. Vertices are
 * evenly spaced by construction, so this is a simple interpolation. Plants
 * anchor here (not at the collision-circle radius) so nothing sinks into or
 * floats above the visible rock.
 */
export function surfaceRadiusAt(ast: Asteroid, angle: number): number {
  const n = ast.shape.length;
  if (n === 0) return ast.radius;
  const tau = Math.PI * 2;
  let a = angle % tau;
  if (a < 0) a += tau;
  const fi = (a / tau) * n;
  const i0 = Math.floor(fi) % n;
  const i1 = (i0 + 1) % n;
  const t = fi - Math.floor(fi);
  const r0 = Math.hypot(ast.shape[i0].x, ast.shape[i0].y);
  const r1 = Math.hypot(ast.shape[i1].x, ast.shape[i1].y);
  return r0 + (r1 - r0) * t;
}

import { describe, it, expect } from 'vitest';
import { isLit } from '../light';
import type { Asteroid } from '../types';

const rock = (x: number, y: number, r: number): Asteroid => ({
  id: 1,
  pos: { x, y },
  radius: r,
  shape: [],
  rich: false,
});

describe('isLit (parallel-light occlusion)', () => {
  const toSunRight = { x: 1, y: 0 };

  it('is lit with no occluders', () => {
    expect(isLit({ x: 0, y: 0 }, toSunRight, [])).toBe(true);
  });

  it('is shaded when a rock sits between point and sun', () => {
    expect(isLit({ x: 0, y: 0 }, toSunRight, [rock(100, 0, 30)])).toBe(false);
  });

  it('is lit when the rock is behind the point (opposite the sun)', () => {
    expect(isLit({ x: 0, y: 0 }, toSunRight, [rock(-100, 0, 30)])).toBe(true);
  });

  it('is lit when the rock is offset beyond its radius', () => {
    expect(isLit({ x: 0, y: 0 }, toSunRight, [rock(100, 50, 30)])).toBe(true);
    expect(isLit({ x: 0, y: 0 }, toSunRight, [rock(100, 20, 30)])).toBe(false);
  });

  it('a point on the sunlit side of its own rock is lit', () => {
    // rock at origin r=50, leaf at (60, 0), sun to the right
    expect(isLit({ x: 60, y: 0 }, toSunRight, [rock(0, 0, 50)])).toBe(true);
  });

  it('a point on the dark side of its own rock is shaded', () => {
    expect(isLit({ x: -60, y: 0 }, toSunRight, [rock(0, 0, 50)])).toBe(false);
  });
});

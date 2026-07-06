import { describe, it, expect } from 'vitest';
import { isLit, rayHitsSegment, shadeAt, type CanopySeg } from '../light';
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

describe('rayHitsSegment', () => {
  it('hits a segment crossing the ray', () => {
    expect(rayHitsSegment(0, 0, 1, 0, 50, -10, 50, 10)).toBe(true);
  });
  it('misses a segment behind the ray origin', () => {
    expect(rayHitsSegment(0, 0, 1, 0, -50, -10, -50, 10)).toBe(false);
  });
  it('misses a segment off to the side', () => {
    expect(rayHitsSegment(0, 0, 1, 0, 50, 5, 50, 25)).toBe(false);
  });
  it('misses a parallel segment', () => {
    expect(rayHitsSegment(0, 0, 1, 0, 10, 5, 90, 5)).toBe(false);
  });
});

describe('shadeAt (two-tier shading)', () => {
  const toSunRight = { x: 1, y: 0 };
  const seg = (plantId: number, group: number): CanopySeg => ({
    ax: 50,
    ay: -10,
    bx: 50,
    by: 10,
    plantId,
    group,
  });

  it('open sky -> lit (0)', () => {
    expect(shadeAt({ x: 0, y: 0 }, toSunRight, [], [], 1, 2)).toBe(0);
  });

  it("another plant's leaf between point and sun -> canopy shade (1)", () => {
    expect(shadeAt({ x: 0, y: 0 }, toSunRight, [], [seg(9, 3)], 1, 2)).toBe(1);
  });

  it('own plant, different branch -> still canopy shade (self-shading)', () => {
    expect(shadeAt({ x: 0, y: 0 }, toSunRight, [], [seg(1, 7)], 1, 2)).toBe(1);
  });

  it('own branch (same plant + same group) never shades itself', () => {
    expect(shadeAt({ x: 0, y: 0 }, toSunRight, [], [seg(1, 2)], 1, 2)).toBe(0);
  });

  it('rock shadow beats canopy shade (2)', () => {
    const r: Asteroid = { id: 1, pos: { x: 100, y: 0 }, radius: 30, shape: [], rich: false };
    expect(shadeAt({ x: 0, y: 0 }, toSunRight, [r], [seg(9, 3)], 1, 2)).toBe(2);
  });
});

import type { Vec2 } from './vec';
import type { RNG } from './rng';

export type FactionId = 'pinophyta';

export type PartKind = 'heart' | 'root' | 'stem' | 'leaf';

/**
 * One node in a plant's part graph. Geometry is stored in the anchor
 * asteroid's local frame so plants move with their rock for free.
 */
export interface Part {
  id: number;
  kind: PartKind;
  parent: number; // index into plant.parts, -1 for the heart
  base: Vec2; // local coords (relative to asteroid center)
  tip: Vec2; // local coords
  dir: Vec2; // unit, base->tip
  len: number;
  depth: number; // trunk segments from the heart
  onBranch: boolean;
  side: number; // -1 | 0 | 1, which side it sprouted on
  leafCount: number; // stems only
  age: number; // seconds of sim time
  lit: boolean; // leaves only: last light query result
}

/** A side-branch growth bud waiting for / undergoing extension. */
export interface BranchBud {
  fromPart: number; // trunk part index it sprouts from
  lastPart: number; // most recent branch stem index, -1 if not started
  side: number;
  steps: number;
  maxSteps: number;
}

export interface Plant {
  id: number;
  faction: FactionId;
  asteroidId: number;
  anchorAngle: number; // radians on the asteroid surface
  up: Vec2; // surface normal at anchor (local frame)
  parts: Part[];
  buds: BranchBud[];
  budCursor: number;
  energy: number;
  capacity: number;
  rootCount: number;
  trunkSegs: number;
  trunkTip: number; // part index of current trunk tip
  growthCooldown: number; // seconds until next growth action
  age: number;
  rng: RNG;
  version: number; // bumped on structural change (render rebuild key)
  // per-tick telemetry for the inspector
  lastIncome: number;
  lastUpkeep: number;
  litLeaves: number;
  totalLeaves: number;
}

export interface Asteroid {
  id: number;
  pos: Vec2;
  radius: number;
  /** Irregular polygon (local coords), for rendering; occlusion uses radius. */
  shape: Vec2[];
  rich: boolean;
}

export interface SunState {
  angle: number; // radians: direction from map center TOWARD the sun
  cycle: boolean;
  cycleRate: number; // radians/sec when cycling
}

export interface World {
  seed: number;
  rng: RNG;
  time: number;
  tick: number;
  width: number;
  height: number;
  sun: SunState;
  asteroids: Asteroid[];
  plants: Plant[];
  nextId: number;
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  sun: { angleDeg: number; cycle: boolean; cyclePeriodSec: number };
  asteroids: { x: number; y: number; r: number; rich?: boolean }[];
  spawns: { asteroid: number; anchorDeg: number; faction: FactionId }[];
}

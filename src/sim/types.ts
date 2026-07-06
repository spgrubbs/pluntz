import type { Vec2 } from './vec';
import type { RNG } from './rng';
import type { ShadeLevel } from './light';

export type FactionId = 'pinophyta';

export type PartKind = 'heart' | 'root' | 'stem' | 'leaf' | 'cone';

/** Render-facing happenings; the fx layer turns these into particles. */
export interface SimEvent {
  type:
    | 'impact' // something took damage (power = dmg)
    | 'partDied'
    | 'shatter' // debris broke up on rock
    | 'seedLaunch'
    | 'seedLand'
    | 'seedFizzle'
    | 'sprout';
  x: number;
  y: number;
  kind?: PartKind;
  faction?: FactionId;
  power?: number;
}

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
  hp: number;
  maxHp: number;
  dead: boolean; // dead parts stay in the array (stable indices); husk render
  hardened: boolean; // old stems gain bark once
  maxAge: number; // natural lifespan (leaves); 0 = immortal
  charge: number; // cones: energy banked toward a seed
  armedAt: number; // cones: sim time when fully charged, -1 if not
  shade: ShadeLevel; // leaves only: last light query result
  /**
   * Occlusion group: needles never shade needles of the same group (a branch
   * arranges its foliage in a plane). 0 = trunk group; branches use the part
   * id of their first segment.
   */
  group: number;
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
  alive: boolean; // false once the heart dies — the whole plant is husk
  faction: FactionId;
  colonyId: number;
  asteroidId: number;
  astPos: Vec2; // cached anchor-asteroid position (for event coordinates)
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
  canopyLeaves: number; // shaded by foliage (own or rival) — half income
  shadowLeaves: number; // in hard rock shadow — near-zero income
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

/** A colony: one player's (or AI's) empire of plants + shared energy pool. */
export interface Colony {
  id: number;
  name: string;
  faction: FactionId;
  isPlayer: boolean;
  palette: number; // index into the faction's palette list
  reserve: number; // shared energy pool fed by thriving plants
}

/** An airborne seed: ballistic, sprouts where it lands. */
export interface Seed {
  id: number;
  colonyId: number;
  faction: FactionId;
  pos: Vec2;
  vel: Vec2;
  age: number;
  maxAge: number; // range / speed
}

export interface Ping {
  x: number;
  y: number;
  colonyId: number;
  expires: number;
}

/** A drifting rock: the ambient hazard. Shatters on asteroids and plants. */
export interface Debris {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  angle: number;
  spin: number;
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
  colonies: Colony[];
  seeds: Seed[];
  debris: Debris[];
  ping: Ping | null;
  events: SimEvent[]; // drained by the renderer every frame
  nextId: number;
  debrisPerMin: number;
  /** Round timer: after roundSec the sun dims to force an ending. 0 = endless. */
  roundSec: number;
  sunFactor: number; // 1 normally, ramps down in sudden death
  roundState: 'playing' | 'won' | 'lost';
  endedAt: number; // sim time the round ended, -1 while playing
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  sun: { angleDeg: number; cycle: boolean; cyclePeriodSec: number };
  debris?: { perMin: number };
  roundSec?: number;
  asteroids: { x: number; y: number; r: number; rich?: boolean }[];
  colonies: { name: string; faction: FactionId; player?: boolean; palette?: number }[];
  spawns: { asteroid: number; anchorDeg: number; colony: number }[];
}

import { v, fromAngle, scale } from './vec';
import type { Vec2 } from './vec';
import { makeRng } from './rng';
import type { Asteroid, MapDef, World } from './types';
import { TUNING } from '../content/tuning';
import { createPlant, stepPlant } from './plant';
import type { CanopySeg } from './light';

function makeAsteroidShape(radius: number, seed: number): Vec2[] {
  const rng = makeRng(seed);
  const [vMin, vMax] = TUNING.world.asteroidVerts;
  const n = vMin + rng.int(vMax - vMin + 1);
  const rough = TUNING.world.asteroidRoughness;
  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (1 - rough + rng.next() * rough * 2);
    pts.push(scale(fromAngle(a), r));
  }
  return pts;
}

export function createWorld(map: MapDef, seed: number): World {
  const rng = makeRng(seed);
  const world: World = {
    seed,
    rng,
    time: 0,
    tick: 0,
    width: map.width,
    height: map.height,
    sun: {
      angle: map.sun.angleDeg * (Math.PI / 180),
      cycle: map.sun.cycle,
      cycleRate: (Math.PI * 2) / map.sun.cyclePeriodSec,
    },
    asteroids: [],
    plants: [],
    nextId: 1,
  };
  for (const def of map.asteroids) {
    const ast: Asteroid = {
      id: world.nextId++,
      pos: v(def.x, def.y),
      radius: def.r,
      shape: makeAsteroidShape(def.r, (seed ^ (world.nextId * 0x85ebca6b)) >>> 0),
      rich: def.rich ?? false,
    };
    world.asteroids.push(ast);
  }
  for (const s of map.spawns) {
    const ast = world.asteroids[s.asteroid];
    world.plants.push(createPlant(world, ast, s.anchorDeg * (Math.PI / 180), s.faction));
  }
  return world;
}

export function stepWorld(world: World, dt: number): void {
  world.time += dt;
  world.tick++;
  if (world.sun.cycle) {
    world.sun.angle = (world.sun.angle + world.sun.cycleRate * dt) % (Math.PI * 2);
  }
  const canopy = collectCanopy(world);
  for (const plant of world.plants) stepPlant(world, plant, dt, canopy);
}

/** World-space leaf segments from every plant — the canopy occluder set. */
function collectCanopy(world: World): CanopySeg[] {
  const segs: CanopySeg[] = [];
  for (const plant of world.plants) {
    const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
    if (!ast) continue;
    for (const p of plant.parts) {
      if (p.kind !== 'leaf') continue;
      // occlude with the central 70% of the fan — needle tips are porous
      segs.push({
        ax: ast.pos.x + p.base.x + (p.tip.x - p.base.x) * 0.15,
        ay: ast.pos.y + p.base.y + (p.tip.y - p.base.y) * 0.15,
        bx: ast.pos.x + p.base.x + (p.tip.x - p.base.x) * 0.85,
        by: ast.pos.y + p.base.y + (p.tip.y - p.base.y) * 0.85,
        plantId: plant.id,
        group: p.group,
      });
    }
  }
  return segs;
}

/** Order-stable integer hash of sim state, for determinism tests. */
export function hashWorld(world: World): number {
  let h = 2166136261 >>> 0;
  const mix = (n: number): void => {
    h ^= Math.round(n * 1000) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  };
  mix(world.tick);
  mix(world.sun.angle * 10000);
  for (const p of world.plants) {
    mix(p.energy * 100);
    mix(p.parts.length);
    for (const part of p.parts) {
      mix(part.tip.x);
      mix(part.tip.y);
    }
  }
  return h;
}

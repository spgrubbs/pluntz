import { v, fromAngle, scale, add, norm, sub, dist, distToSegment, len } from './vec';
import type { Vec2 } from './vec';
import { makeRng } from './rng';
import type { Asteroid, Debris, MapDef, World } from './types';
import { TUNING } from '../content/tuning';
import { createPlant, stepPlant, damagePart } from './plant';
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
    debris: [],
    nextId: 1,
    debrisPerMin: map.debris?.perMin ?? 0,
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
  stepDebris(world, dt);
}

/** Spawn a drifting rock. Exposed for the debug panel and tests. */
export function spawnDebris(world: World, pos: Vec2, vel: Vec2, radius: number): Debris {
  const d: Debris = {
    id: world.nextId++,
    pos: { ...pos },
    vel: { ...vel },
    radius,
    angle: 0,
    spin: world.rng.range(-TUNING.debris.spinMax, TUNING.debris.spinMax),
  };
  world.debris.push(d);
  return d;
}

function spawnAmbientDebris(world: World): void {
  const rng = world.rng;
  const hw = world.width / 2;
  const hh = world.height / 2;
  // random point on the map edge, drifting toward a random interior point
  const side = rng.int(4);
  const pos =
    side === 0
      ? v(rng.range(-hw, hw), -hh)
      : side === 1
        ? v(rng.range(-hw, hw), hh)
        : side === 2
          ? v(-hw, rng.range(-hh, hh))
          : v(hw, rng.range(-hh, hh));
  const target = v(rng.range(-hw * 0.5, hw * 0.5), rng.range(-hh * 0.5, hh * 0.5));
  const speed = rng.range(TUNING.debris.ambientSpeed[0], TUNING.debris.ambientSpeed[1]);
  const vel = scale(norm(sub(target, pos)), speed);
  spawnDebris(world, pos, vel, rng.range(TUNING.debris.radius[0], TUNING.debris.radius[1]));
}

function stepDebris(world: World, dt: number): void {
  const D = TUNING.debris;
  if (world.debrisPerMin > 0 && world.rng.next() < (world.debrisPerMin / 60) * dt) {
    spawnAmbientDebris(world);
  }

  const boundX = (world.width / 2) * D.boundsMargin;
  const boundY = (world.height / 2) * D.boundsMargin;
  for (let i = world.debris.length - 1; i >= 0; i--) {
    const d = world.debris[i];
    d.pos.x += d.vel.x * dt;
    d.pos.y += d.vel.y * dt;
    d.angle += d.spin * dt;
    if (Math.abs(d.pos.x) > boundX || Math.abs(d.pos.y) > boundY) {
      world.debris.splice(i, 1);
      continue;
    }

    let destroyed = false;
    // plants first — the canopy stands above the rock surface and takes the hit
    outer: for (const plant of world.plants) {
      if (!plant.alive) continue;
      const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
      if (!ast) continue;
      // cheap reject: debris far from this asteroid's garden
      if (dist(d.pos, ast.pos) > ast.radius + 220) continue;
      for (const p of plant.parts) {
        if (p.dead) continue;
        const a = add(ast.pos, p.base);
        const b = add(ast.pos, p.tip);
        const slack = d.radius + D.hitSlack + (p.kind === 'heart' ? 9 : 0);
        if (distToSegment(d.pos, a, b) < slack) {
          const dmg = d.radius * len(d.vel) * D.dmgFactor;
          damagePart(plant, p.id, dmg);
          destroyed = true;
          break outer;
        }
      }
    }
    if (!destroyed) {
      for (const a of world.asteroids) {
        if (dist(d.pos, a.pos) < d.radius + a.radius) {
          destroyed = true;
          break;
        }
      }
    }
    if (destroyed) world.debris.splice(i, 1);
  }
}

/** World-space leaf segments from every plant — the canopy occluder set. */
function collectCanopy(world: World): CanopySeg[] {
  const segs: CanopySeg[] = [];
  for (const plant of world.plants) {
    const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
    if (!ast) continue;
    for (const p of plant.parts) {
      if (p.kind !== 'leaf' || p.dead) continue;
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
    mix(p.alive ? 1 : 0);
    for (const part of p.parts) {
      mix(part.tip.x);
      mix(part.tip.y);
      mix(part.hp * 100);
      mix(part.dead ? 1 : 0);
    }
  }
  mix(world.debris.length);
  for (const d of world.debris) {
    mix(d.pos.x);
    mix(d.pos.y);
  }
  return h;
}

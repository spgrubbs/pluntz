import { v, fromAngle, scale, add, norm, sub, dist, distToSegment, len } from './vec';
import type { Vec2 } from './vec';
import { makeRng } from './rng';
import type { Asteroid, Debris, FactionId, MapDef, World } from './types';
import { TUNING } from '../content/tuning';
import { FACTIONS } from '../content/factions';
import { createPlant, stepPlant, damagePart } from './plant';
import { canopyCross, CANOPY_BIN, type CanopyIndex, type CanopySeg } from './light';
import { emit, setEventSink } from './events';

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
    colonies: [],
    seeds: [],
    debris: [],
    ping: null,
    events: [],
    nextId: 1,
    debrisPerMin: map.debris?.perMin ?? 0,
    roundSec: map.roundSec ?? 0,
    sunFactor: 1,
    roundState: 'playing',
    endedAt: -1,
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
  for (const c of map.colonies) {
    world.colonies.push({
      id: world.nextId++,
      name: c.name,
      faction: c.faction,
      isPlayer: c.player ?? false,
      palette: c.palette ?? 0,
    });
  }
  for (const s of map.spawns) {
    const ast = world.asteroids[s.asteroid];
    const colony = world.colonies[s.colony];
    world.plants.push(
      createPlant(world, ast, s.anchorDeg * (Math.PI / 180), colony.faction, colony.id),
    );
  }
  return world;
}

/** Try to sprout a new plant on an asteroid surface; fails when crowded. */
export function sproutAt(
  world: World,
  colonyId: number,
  faction: FactionId,
  ast: Asteroid,
  angleRad: number,
): boolean {
  const R = FACTIONS[faction].repro;
  const anchor = add(ast.pos, scale(fromAngle(angleRad), ast.radius));
  for (const pl of world.plants) {
    if (!pl.alive || pl.asteroidId !== ast.id) continue;
    const other = add(ast.pos, scale(fromAngle(pl.anchorAngle), ast.radius));
    if (dist(anchor, other) < R.minSpacing) return false;
  }
  const plant = createPlant(world, ast, angleRad, faction, colonyId);
  plant.energy = R.seedStartEnergy;
  world.plants.push(plant);
  emit({ type: 'sprout', x: anchor.x, y: anchor.y, faction });
  return true;
}

/** Place (or move) a colony's ping — the attention verb. */
export function setPing(world: World, colonyId: number, pos: Vec2): void {
  world.ping = { x: pos.x, y: pos.y, colonyId, expires: world.time + 60 };
}

function stepSeeds(world: World, dt: number): void {
  for (let i = world.seeds.length - 1; i >= 0; i--) {
    const s = world.seeds[i];
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.age += dt;
    if (s.age > s.maxAge) {
      emit({ type: 'seedFizzle', x: s.pos.x, y: s.pos.y, faction: s.faction });
      world.seeds.splice(i, 1);
      continue;
    }
    // hardened seeds are slow cannonballs: they bruise rival growth they hit
    let hitRival = false;
    for (const plant of world.plants) {
      if (!plant.alive || plant.colonyId === s.colonyId) continue;
      if (dist(s.pos, plant.astPos) > 320) continue;
      for (const p of plant.parts) {
        if (p.dead) continue;
        const a = add(plant.astPos, p.base);
        const b = add(plant.astPos, p.tip);
        if (distToSegment(s.pos, a, b) < 5) {
          damagePart(plant, p.id, 14);
          hitRival = true;
          break;
        }
      }
      if (hitRival) break;
    }
    if (hitRival) {
      world.seeds.splice(i, 1);
      continue;
    }
    for (const ast of world.asteroids) {
      if (dist(s.pos, ast.pos) < ast.radius + 4) {
        const angle = Math.atan2(s.pos.y - ast.pos.y, s.pos.x - ast.pos.x);
        const ok = sproutAt(world, s.colonyId, s.faction, ast, angle);
        const at = add(ast.pos, scale(fromAngle(angle), ast.radius));
        emit({
          type: ok ? 'seedLand' : 'seedFizzle',
          x: at.x,
          y: at.y,
          faction: s.faction,
        });
        world.seeds.splice(i, 1);
        break;
      }
    }
  }
}

/**
 * Root-network energy sharing: plants of one colony whose substrate beds are
 * near each other (anchor distance < shareRange) equalize energy, richer
 * feeding poorer. Distant outposts are on their own until the beds spread.
 */
function shareColonyEnergy(world: World, dt: number): void {
  const SH = TUNING.colony;
  const plants = world.plants;
  for (let i = 0; i < plants.length; i++) {
    const A = plants[i];
    if (!A.alive) continue;
    const aAnchor = add(A.astPos, A.parts[0].base);
    for (let j = i + 1; j < plants.length; j++) {
      const B = plants[j];
      if (!B.alive || B.colonyId !== A.colonyId) continue;
      const bAnchor = add(B.astPos, B.parts[0].base);
      if (dist(aAnchor, bAnchor) > SH.shareRange) continue;
      const diff = A.energy / A.capacity - B.energy / B.capacity;
      if (Math.abs(diff) < SH.flowDeadband) continue;
      const [src, dst] = diff > 0 ? [A, B] : [B, A];
      const t = Math.min(SH.flowRate * dt, src.energy * 0.5, dst.capacity - dst.energy);
      src.energy -= t;
      dst.energy += t;
    }
  }
}

export function stepWorld(world: World, dt: number): void {
  setEventSink(world.events);
  world.time += dt;
  world.tick++;
  if (world.sun.cycle) {
    world.sun.angle = (world.sun.angle + world.sun.cycleRate * dt) % (Math.PI * 2);
  }
  if (world.ping && world.time > world.ping.expires) world.ping = null;

  // sudden death: past the round timer the sun fades over 2 minutes
  if (world.roundSec > 0 && world.time > world.roundSec) {
    const t = Math.min((world.time - world.roundSec) / 120, 1);
    world.sunFactor = 1 - t * 0.88;
  }

  const canopy = collectCanopyIndex(world);
  for (const plant of world.plants) stepPlant(world, plant, dt, canopy);
  shareColonyEnergy(world, dt);
  stepSeeds(world, dt);
  stepDebris(world, dt);
  if (world.tick % 5 === 0) applyContactDamage(world, dt * 5);
  if (world.tick % 10 === 0) checkRoundEnd(world);
}

/** Approximate shortest distance between two short segments. */
function segSegDist(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): number {
  return Math.min(
    distToSegment(a1, b1, b2),
    distToSegment(a2, b1, b2),
    distToSegment(b1, a1, a2),
    distToSegment(b2, a1, a2),
  );
}

const CONTACT_DPS: Record<string, number> = {
  leaf: 3.0,
  cone: 3.0,
  stem: 0.8,
  heart: 1.5,
  root: 0,
};

/**
 * Overgrowth warfare: where rival colonies' living tissue touches, both
 * sides take slow crushing damage — soft parts (needles, cones) lose fast,
 * hardened wood grinds slowly. Runs every 5th tick.
 */
function applyContactDamage(world: World, dt: number): void {
  const plants = world.plants;
  for (let i = 0; i < plants.length; i++) {
    const A = plants[i];
    if (!A.alive) continue;
    for (let j = i + 1; j < plants.length; j++) {
      const B = plants[j];
      if (!B.alive || B.colonyId === A.colonyId) continue;
      // broadphase: gardens can only touch if their rocks are close
      if (dist(A.astPos, B.astPos) > 620) continue;
      for (const pa of A.parts) {
        if (pa.dead || pa.kind === 'root') continue;
        const a1 = add(A.astPos, pa.base);
        const a2 = add(A.astPos, pa.tip);
        for (const pb of B.parts) {
          if (pb.dead || pb.kind === 'root') continue;
          const b1 = add(B.astPos, pb.base);
          const b2 = add(B.astPos, pb.tip);
          if (segSegDist(a1, a2, b1, b2) < 3.5) {
            damagePart(A, pa.id, CONTACT_DPS[pa.kind] * dt);
            damagePart(B, pb.id, CONTACT_DPS[pb.kind] * dt);
            if (!A.alive) return;
            if (!B.alive) break;
          }
        }
        if (!B.alive) break;
      }
    }
  }
}

function checkRoundEnd(world: World): void {
  if (world.roundState !== 'playing' || world.colonies.length < 2) return;
  const aliveByColony = new Map<number, number>();
  for (const c of world.colonies) aliveByColony.set(c.id, 0);
  for (const p of world.plants) {
    if (p.alive) aliveByColony.set(p.colonyId, (aliveByColony.get(p.colonyId) ?? 0) + 1);
  }
  const player = world.colonies.find((c) => c.isPlayer);
  if (!player) return;
  const playerAlive = (aliveByColony.get(player.id) ?? 0) > 0;
  const rivalsAlive = world.colonies.some(
    (c) => !c.isPlayer && (aliveByColony.get(c.id) ?? 0) > 0,
  );
  if (!playerAlive) {
    world.roundState = 'lost';
    world.endedAt = world.time;
  } else if (!rivalsAlive) {
    world.roundState = 'won';
    world.endedAt = world.time;
  }
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
          emit({ type: 'shatter', x: d.pos.x, y: d.pos.y, power: d.radius });
          destroyed = true;
          break;
        }
      }
    }
    if (destroyed) world.debris.splice(i, 1);
  }
}

function collectCanopyIndex(world: World): CanopyIndex {
  const toSun = fromAngle(world.sun.angle);
  const bins = new Map<number, CanopySeg[]>();
  for (const plant of world.plants) {
    const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
    if (!ast) continue;
    for (const p of plant.parts) {
      if (p.kind !== 'leaf' || p.dead) continue;
      // occlude with the central 70% of the fan — needle tips are porous
      const seg: CanopySeg = {
        ax: ast.pos.x + p.base.x + (p.tip.x - p.base.x) * 0.15,
        ay: ast.pos.y + p.base.y + (p.tip.y - p.base.y) * 0.15,
        bx: ast.pos.x + p.base.x + (p.tip.x - p.base.x) * 0.85,
        by: ast.pos.y + p.base.y + (p.tip.y - p.base.y) * 0.85,
        plantId: plant.id,
        group: p.group,
      };
      const c1 = canopyCross(seg.ax, seg.ay, toSun);
      const c2 = canopyCross(seg.bx, seg.by, toSun);
      const k0 = Math.floor(Math.min(c1, c2) / CANOPY_BIN);
      const k1 = Math.floor(Math.max(c1, c2) / CANOPY_BIN);
      for (let k = k0; k <= k1; k++) {
        let arr = bins.get(k);
        if (!arr) {
          arr = [];
          bins.set(k, arr);
        }
        arr.push(seg);
      }
    }
  }
  return { bins };
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
      mix(part.charge * 100);
      mix(part.dead ? 1 : 0);
    }
  }
  mix(world.debris.length);
  for (const d of world.debris) {
    mix(d.pos.x);
    mix(d.pos.y);
  }
  mix(world.seeds.length);
  for (const s of world.seeds) {
    mix(s.pos.x);
    mix(s.pos.y);
  }
  return h;
}

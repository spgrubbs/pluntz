import { v, fromAngle, scale, add, norm, sub, dist, distToSegment, len } from './vec';
import type { Vec2 } from './vec';
import { makeRng } from './rng';
import type { Asteroid, Debris, FactionId, MapDef, World } from './types';
import { TUNING } from '../content/tuning';
import { FACTIONS } from '../content/factions';
import { createPlant, stepPlant, damagePart, killPart, fireCone } from './plant';
import { canopyCross, isLit, CANOPY_BIN, type CanopyIndex, type CanopySeg } from './light';
import { emit, setEventSink } from './events';
import { colonyMods, verbReady, useVerb } from './stats';
import { substrateHalfAngle, canRootAt } from './plant';
import { MUTATIONS, AI_MUTATION_PREF, MUTATION_TIMING } from '../content/mutations';

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
    fauna: [],
    faunaRespawns: [],
    ping: null,
    lure: null,
    events: [],
    nextId: 1,
    debrisPerMin: map.debris?.perMin ?? 0,
    roundSec: map.roundSec ?? 0,
    sunFactor: 1,
    roundState: 'playing',
    endedAt: -1,
    endReason: '',
    canopyHolder: -1,
    canopyHeldSec: 0,
    canopyShares: [],
    canopyWin: map.canopyWin ?? null,
    dimming: map.dimming ? { x: map.dimming.startX, speed: map.dimming.speed } : null,
    vanguard: null, // resolved to an asteroid id below, once rocks exist
    vanguardHolder: -1,
    vanguardHeldSec: 0,
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
      mutations: [],
      pendingOffer: null,
      nextMutationAt: MUTATION_TIMING.firstAt,
      bonusDepth: 0,
      verbReadyAt: { ping: 0, lure: 0, bless: 0, prune: 0 },
    });
  }
  for (const s of map.spawns) {
    const ast = world.asteroids[s.asteroid];
    const colony = world.colonies[s.colony];
    world.plants.push(
      createPlant(world, ast, s.anchorDeg * (Math.PI / 180), colony.faction, colony.id),
    );
  }
  if (map.vanguard) {
    world.vanguard = {
      asteroidId: world.asteroids[map.vanguard.asteroid].id,
      holdSec: map.vanguard.holdSec,
    };
  }
  const fauna = map.fauna ?? {};
  for (const kind of [
    'frugivora',
    'phytophaga',
    'anthophila',
    'scarabaeidae',
    'araneae',
    'lampyridae',
  ] as const) {
    for (let i = 0; i < (fauna[kind] ?? 0); i++) spawnFauna(world, kind);
  }
  return world;
}

const FAUNA_HP: Record<import('./types').FaunaKind, number> = {
  frugivora: 30,
  phytophaga: 25,
  anthophila: 8,
  scarabaeidae: 45,
  araneae: 18,
  lampyridae: 10,
};

/** Spawn one wild critter at a random spot. Also used by respawns. */
function spawnFauna(world: World, kind: import('./types').FaunaKind): void {
  const rng = world.rng;
  const hp = FAUNA_HP[kind];
  world.fauna.push({
    id: world.nextId++,
    kind,
    pos: v(rng.range(-world.width / 2, world.width / 2), rng.range(-world.height / 2, world.height / 2)),
    vel: v(0, 0),
    state: 'wander',
    targetPlant: -1,
    targetPart: -1,
    targetAst: -1,
    carryColony: -1,
    carryFaction: null,
    waypoint: v(rng.range(-world.width / 3, world.width / 3), rng.range(-world.height / 3, world.height / 3)),
    timer: rng.range(2, 8),
    hp,
    maxHp: hp,
    satiety: rng.range(0, 0.3),
    wander: rng.range(0, Math.PI * 2),
    webPrey: -1,
    orbit: null,
  });
}

/** The Lure verb: a 40s scent that pulls fauna. Runs on a cooldown. */
export function placeLure(world: World, colonyId: number, pos: Vec2): boolean {
  const colony = world.colonies.find((c) => c.id === colonyId);
  if (!colony || !verbReady(world, colony, 'lure')) return false;
  useVerb(world, colony, 'lure');
  const life = TUNING.verbs.lureLife * colonyMods(colony).lureDurationMult;
  world.lure = { x: pos.x, y: pos.y, colonyId, expires: world.time + life };
  emit({ type: 'lure', x: pos.x, y: pos.y });
  return true;
}

const FAUNA_SPEED = { frugivora: 95, phytophaga: 55, anthophila: 70, scarabaeidae: 42, araneae: 130, lampyridae: 60 };
const GRAZE_APPEAL = { anthophyta: 3, pinophyta: 0.4, basidiomycota: 0.1 } as const;

function steer(fn: { pos: Vec2; vel: Vec2 }, target: Vec2, speed: number, dt: number): void {
  const want = scale(norm(sub(target, fn.pos)), speed);
  const k = Math.min(3 * dt, 1);
  fn.vel.x += (want.x - fn.vel.x) * k;
  fn.vel.y += (want.y - fn.vel.y) * k;
  fn.pos.x += fn.vel.x * dt;
  fn.pos.y += fn.vel.y * dt;
}

/**
 * Steer toward a target but along a lazy curved path rather than a beeline:
 * the desired heading is nudged sideways by a slow sine, so approach arcs read
 * as unhurried, animal wandering. `time` keeps it deterministic.
 */
function steerCurved(
  fn: import('./types').Fauna,
  target: Vec2,
  speed: number,
  dt: number,
  time: number,
  swayAmt = 0.6,
): void {
  const to = sub(target, fn.pos);
  const d = len(to);
  const dir = norm(to);
  // less sway when close, so they actually arrive
  const sway = Math.sin(time * 0.9 + fn.wander) * swayAmt * Math.min(d / 200, 1);
  const heading = { x: dir.x - dir.y * sway, y: dir.y + dir.x * sway };
  const want = scale(norm(heading), speed);
  const k = Math.min(3 * dt, 1);
  fn.vel.x += (want.x - fn.vel.x) * k;
  fn.vel.y += (want.y - fn.vel.y) * k;
  fn.pos.x += fn.vel.x * dt;
  fn.pos.y += fn.vel.y * dt;
}

/**
 * The universal Lure: by default a lure tempts EVERY kind of fauna inside its
 * pull radius (clades/mutations can specialize this later). Returns true when
 * the critter is answering the scent — the caller skips its usual wandering.
 */
function lurePull(
  world: World,
  fn: import('./types').Fauna,
  dt: number,
  speed: number,
  maxD = 800,
): boolean {
  const l = world.lure;
  if (!l) return false;
  const d = Math.hypot(l.x - fn.pos.x, l.y - fn.pos.y);
  if (d > maxD) return false;
  if (d < 70) {
    // arrived: mill about the scent
    fn.vel.x = fn.vel.x * 0.92 + (l.y - fn.pos.y) * 0.02;
    fn.vel.y = fn.vel.y * 0.92 - (l.x - fn.pos.x) * 0.02;
    fn.pos.x += fn.vel.x * dt;
    fn.pos.y += fn.vel.y * dt;
    return true;
  }
  fn.orbit = null;
  steerCurved(fn, { x: l.x, y: l.y }, speed, dt, world.time);
  return true;
}

/** How appealing is `plant` to a grazer at distance `d`, lure included? */
function grazeScore(world: World, plant: import('./types').Plant, d: number): number {
  const lured =
    world.lure &&
    Math.hypot(world.lure.x - plant.astPos.x, world.lure.y - plant.astPos.y) < 340;
  let score = (GRAZE_APPEAL[plant.faction] * plant.totalLeaves) / (60 + d * 0.05);
  if (lured) score += 1000; // the scent overrides ordinary appetite
  return score;
}

/** The tastiest reachable plant right now (used to (re)target and to bail). */
function bestGrazeTarget(world: World, fn: import('./types').Fauna): import('./types').Plant | null {
  let target: import('./types').Plant | null = null;
  let best = 1.2; // apathy threshold
  for (const plant of world.plants) {
    if (!plant.alive || plant.totalLeaves < 3) continue;
    const d = dist(fn.pos, plant.astPos);
    const lured =
      world.lure &&
      Math.hypot(world.lure.x - plant.astPos.x, world.lure.y - plant.astPos.y) < 340;
    if (d > 900 && !lured) continue;
    const score = grazeScore(world, plant, d);
    if (score > best) {
      best = score;
      target = plant;
    }
  }
  return target;
}

/**
 * Idle flight rides an orbit around a rock, hopping to a new one now and
 * then — the transfer arcs read as orbital mechanics without simulating any.
 */
function faunaWanderTick(world: World, fn: import('./types').Fauna, dt: number): void {
  fn.timer -= dt;
  if (!fn.orbit || fn.timer <= 0) {
    const ast = world.asteroids[world.rng.int(world.asteroids.length)];
    const low = fn.kind === 'phytophaga';
    fn.orbit = {
      ast: ast.id,
      r: ast.radius + (low ? world.rng.range(18, 48) : world.rng.range(55, 130)),
      a: Math.atan2(fn.pos.y - ast.pos.y, fn.pos.x - ast.pos.x),
      dir: world.rng.next() < 0.5 ? -1 : 1,
    };
    fn.timer = world.rng.range(9, 18);
  }
  // per-individual character: different cruising speeds, wobbling orbits,
  // and the occasional whimsical dart off-course
  const speed = FAUNA_SPEED[fn.kind] * 0.65 * (0.75 + (fn.id % 7) * 0.09);
  const ast = world.asteroids.find((a) => a.id === fn.orbit!.ast);
  if (!ast) {
    fn.orbit = null;
    return;
  }
  fn.orbit.a += (fn.orbit.dir * speed * dt) / fn.orbit.r;
  const wobble = 1 + 0.22 * Math.sin(world.time * (0.5 + (fn.id % 5) * 0.17) + fn.id);
  const target = add(ast.pos, scale(fromAngle(fn.orbit.a), fn.orbit.r * wobble));
  steer(fn, target, speed * 1.5, dt);
  if (world.rng.next() < dt * 0.12) {
    // a sudden fancy takes it
    const dart = fromAngle(world.rng.range(0, Math.PI * 2));
    fn.vel.x += dart.x * speed * 1.6;
    fn.vel.y += dart.y * speed * 1.6;
  }
}

/** Ripe fruit (armed fauna-style cones) not yet claimed by another bird. */
function findRipeFruit(
  world: World,
  claimedBy: import('./types').Fauna,
): { plant: import('./types').Plant; part: import('./types').Part } | null {
  let best: { plant: import('./types').Plant; part: import('./types').Part } | null = null;
  let bestD = Infinity;
  for (const plant of world.plants) {
    if (!plant.alive || FACTIONS[plant.faction].repro.style !== 'fauna') continue;
    for (const p of plant.parts) {
      if (p.dead || p.kind !== 'cone' || p.armedAt < 0) continue;
      const claimed = world.fauna.some(
        (o) =>
          o !== claimedBy &&
          o.kind === 'frugivora' &&
          o.state === 'toFruit' &&
          o.targetPlant === plant.id &&
          o.targetPart === p.id,
      );
      if (claimed) continue;
      let d = dist(claimedBy.pos, { x: plant.astPos.x + p.tip.x, y: plant.astPos.y + p.tip.y });
      // Sweetfruit: birds cross the map for this colony's fruit first
      if (colonyMods(world.colonies.find((c) => c.id === plant.colonyId)).sweetfruit) {
        d *= 0.25;
      }
      if (d < bestD) {
        bestD = d;
        best = { plant, part: p };
      }
    }
  }
  return best;
}

/**
 * Pick a rock for a carrying Frugivora to deliver to: rootable ground the
 * carrier colony doesn't already saturate, not already the destination of
 * another delivering bird (so a flock spreads out), biased to riches and the
 * colony's lure.
 */
function chooseDeliveryRock(
  world: World,
  bird: import('./types').Fauna,
): import('./types').Asteroid | null {
  let dest: import('./types').Asteroid | null = null;
  let bestScore = 0;
  for (const ast of world.asteroids) {
    let own = 0;
    for (const pl of world.plants) {
      if (pl.alive && pl.asteroidId === ast.id && pl.colonyId === bird.carryColony) own++;
    }
    const slots = Math.max(2, Math.floor((Math.PI * 2 * ast.radius) / 48));
    if (own >= Math.ceil(slots * 0.5)) continue;
    // how many other birds are already inbound with the same colony's seed?
    let inbound = 0;
    for (const o of world.fauna) {
      if (o !== bird && o.state === 'deliver' && o.targetAst === ast.id) inbound++;
    }
    let score =
      ((ast.rich ? 1.3 : 1) + world.rng.next() * 0.3) / (1 + own * 2 + inbound * 4);
    if (
      world.lure &&
      world.lure.colonyId === bird.carryColony &&
      Math.hypot(world.lure.x - ast.pos.x, world.lure.y - ast.pos.y) < ast.radius + 200
    ) {
      score *= 30;
    }
    if (score > bestScore) {
      bestScore = score;
      dest = ast;
    }
  }
  return dest;
}

function stepFauna(world: World, dt: number): void {
  if (world.lure && world.time > world.lure.expires) world.lure = null;
  for (const fn of world.fauna) {
    switch (fn.kind) {
      case 'frugivora': {
        if (fn.state === 'wander') {
          if (!lurePull(world, fn, dt, FAUNA_SPEED.frugivora)) faunaWanderTick(world, fn, dt);
          const fruit = findRipeFruit(world, fn);
          if (fruit) {
            fn.state = 'toFruit';
            fn.targetPlant = fruit.plant.id;
            fn.targetPart = fruit.part.id;
          }
        } else if (fn.state === 'toFruit') {
          const plant = world.plants.find((p) => p.id === fn.targetPlant);
          const part = plant?.parts[fn.targetPart];
          if (!plant || !plant.alive || !part || part.dead || part.armedAt < 0) {
            fn.state = 'wander';
            break;
          }
          const at = { x: plant.astPos.x + part.tip.x, y: plant.astPos.y + part.tip.y };
          steerCurved(fn, at, FAUNA_SPEED.frugivora, dt, world.time);
          if (dist(fn.pos, at) < 15) {
            killPart(plant, part.id); // fruit plucked
            fn.carryColony = plant.colonyId;
            fn.carryFaction = plant.faction;
            // choose a delivery rock: unsaturated ground, not already targeted
            // by another delivering bird, biased to the carrier's lure/riches
            const dest = chooseDeliveryRock(world, fn);
            if (dest) {
              fn.targetAst = dest.id;
              fn.state = 'deliver';
            } else {
              fn.carryColony = -1;
              fn.carryFaction = null;
              fn.state = 'wander';
            }
          }
        } else if (fn.state === 'deliver') {
          const ast = world.asteroids.find((a) => a.id === fn.targetAst);
          if (!ast || fn.carryFaction === null) {
            fn.state = 'wander';
            break;
          }
          steerCurved(fn, ast.pos, FAUNA_SPEED.frugivora, dt, world.time);
          const d = dist(fn.pos, ast.pos);
          if (d < ast.radius + 18) {
            const angle = Math.atan2(fn.pos.y - ast.pos.y, fn.pos.x - ast.pos.x);
            sproutAt(world, fn.carryColony, fn.carryFaction, ast, angle);
            fn.carryColony = -1;
            fn.carryFaction = null;
            fn.state = 'wander';
            fn.timer = 0;
          }
        }
        break;
      }
      case 'phytophaga': {
        // digest between meals: a full grazer wanders and does other things
        fn.satiety = Math.max(0, fn.satiety - dt / 60); // fully digests in ~60s
        if (fn.state === 'wander') {
          faunaWanderTick(world, fn, dt);
          // only hunt when hungry — unless a lure is out, which always tempts
          const hungry = fn.satiety < 0.6 || !!world.lure;
          if (hungry) {
            const target = bestGrazeTarget(world, fn);
            if (target) {
              fn.state = 'graze';
              fn.targetPlant = target.id;
              fn.targetPart = -1;
            } else lurePull(world, fn, dt, FAUNA_SPEED.phytophaga);
          }
        } else if (fn.state === 'graze') {
          const plant = world.plants.find((p) => p.id === fn.targetPlant);
          // leave when sated, when the plant's gone, or when a fresh lure calls
          // it somewhere better (re-evaluated every tick, not just on entry)
          const better = bestGrazeTarget(world, fn);
          if (fn.satiety >= 0.97 || !plant || !plant.alive || plant.totalLeaves === 0) {
            fn.state = 'wander';
            fn.targetPart = -1;
            // sated grazers scatter: pick a fresh far waypoint
            faunaWanderTick(world, fn, dt);
            break;
          }
          // stick with the current meal until full — except a lure yanks it
          // to a better target immediately (that's the whole point of Lure)
          if (world.lure && better && better.id !== plant.id) {
            fn.targetPlant = better.id;
            fn.targetPart = -1;
          }
          const cur = world.plants.find((p) => p.id === fn.targetPlant)!;
          let leaf = fn.targetPart >= 0 ? cur.parts[fn.targetPart] : undefined;
          if (!leaf || leaf.dead || leaf.kind !== 'leaf') {
            let bestD = Infinity;
            leaf = undefined;
            for (const p of cur.parts) {
              if (p.dead || p.kind !== 'leaf') continue;
              const at = { x: cur.astPos.x + p.tip.x, y: cur.astPos.y + p.tip.y };
              const d = dist(fn.pos, at);
              if (d < bestD) {
                bestD = d;
                leaf = p;
              }
            }
            if (!leaf) {
              fn.state = 'wander';
              break;
            }
            fn.targetPart = leaf.id;
          }
          const at = { x: cur.astPos.x + leaf.tip.x, y: cur.astPos.y + leaf.tip.y };
          steer(fn, at, FAUNA_SPEED.phytophaga, dt);
          if (dist(fn.pos, at) < 14) {
            damagePart(cur, leaf.id, 6 * dt); // grazers bite hard now
            const gm = colonyMods(world.colonies.find((c) => c.id === cur.colonyId));
            // Narcotic Nectar: drugged grazers fill up fast and wander off
            fn.satiety = Math.min(1, fn.satiety + (dt / 14) * (gm.nectarSleep ? 2.5 : 1));
            // Thorns: every bite costs blood — enough bites kill
            if (gm.thorns) {
              fn.hp -= 9 * dt;
              if (world.tick % 10 === 0) {
                emit({ type: 'impact', x: fn.pos.x, y: fn.pos.y, power: 3 });
              }
            }
          }
        }
        break;
      }
      case 'anthophila': {
        // drift toward the nearest charging flower; otherwise wander
        let flower: Vec2 | null = null;
        let bestD = 700;
        for (const plant of world.plants) {
          if (!plant.alive || FACTIONS[plant.faction].repro.style !== 'fauna') continue;
          for (const p of plant.parts) {
            if (p.dead || p.kind !== 'cone' || p.armedAt >= 0) continue;
            const at = { x: plant.astPos.x + p.tip.x, y: plant.astPos.y + p.tip.y };
            const d = dist(fn.pos, at);
            if (d < bestD) {
              bestD = d;
              flower = at;
            }
          }
        }
        if (flower && !world.lure) steer(fn, flower, FAUNA_SPEED.anthophila, dt);
        else if (!lurePull(world, fn, dt, FAUNA_SPEED.anthophila)) {
          if (flower) steer(fn, flower, FAUNA_SPEED.anthophila, dt);
          else faunaWanderTick(world, fn, dt);
        }
        break;
      }
      case 'scarabaeidae': {
        // the rock-shover: rests, then picks an asteroid and leans into it
        // for a long shove. The map is not fixed — light and territory drift.
        if (fn.state === 'push') stepScarabPush(world, fn, dt);
        else {
          if (!lurePull(world, fn, dt, FAUNA_SPEED.scarabaeidae * 1.6)) {
            faunaWanderTick(world, fn, dt);
          }
          fn.timer -= dt;
          if (fn.timer <= 0) {
            // a fresh scent redirects the titan: it shoves the rock nearest
            // the lure (toward the scent) — the shepherd's tow-cable
            const ref = world.lure ? { x: world.lure.x, y: world.lure.y } : fn.pos;
            let rock: import('./types').Asteroid | null = null;
            let bd = 1100;
            for (const a of world.asteroids) {
              const d = dist(ref, a.pos) - a.radius;
              if (d < bd) {
                bd = d;
                rock = a;
              }
            }
            if (rock) {
              fn.state = 'push';
              fn.targetAst = rock.id;
              // shove heading: through the rock from where it stands — or,
              // when a lure is out, toward the scent itself
              const h = world.lure
                ? Math.atan2(world.lure.y - rock.pos.y, world.lure.x - rock.pos.x)
                : Math.atan2(rock.pos.y - fn.pos.y, rock.pos.x - fn.pos.x) +
                  world.rng.range(-0.5, 0.5);
              fn.waypoint = { x: Math.cos(h), y: Math.sin(h) }; // stores the dir
              fn.timer = world.rng.range(22, 40); // shove duration
            } else fn.timer = 10;
          }
        }
        break;
      }
      case 'araneae': {
        // the nesting hunter: claims a grown plant and murders any fauna that
        // strays too close. A resident spider is rent-a-guard — and a curse,
        // because it does not spare your pollinators or couriers.
        // the scent is irresistible even to the ambusher: a lure within reach
        // tugs it off its nest — this is how a shepherd evicts a spider
        if (fn.state === 'nest' && world.lure) {
          const host = world.plants.find((p) => p.id === fn.targetPlant);
          const dSelf = Math.hypot(world.lure.x - fn.pos.x, world.lure.y - fn.pos.y);
          const dNest = host
            ? Math.hypot(world.lure.x - host.astPos.x, world.lure.y - host.astPos.y)
            : Infinity;
          if (Math.min(dSelf, dNest) < 800) {
            fn.state = 'wander';
            fn.targetPlant = -1;
            fn.webPrey = -1;
          }
        }
        if (fn.state === 'nest') stepSpiderNest(world, fn, dt);
        else if (lurePull(world, fn, dt, FAUNA_SPEED.araneae * 0.5, 1200)) {
          /* answering the scent — it renests only after the lure fades */
        } else {
          faunaWanderTick(world, fn, dt);
          let host: import('./types').Plant | null = null;
          let bestSize = 11; // only grown plants make worthy webs
          for (const p of world.plants) {
            if (!p.alive) continue;
            const size = p.parts.reduce((n, q) => n + (q.dead ? 0 : 1), 0);
            const d = dist(fn.pos, p.astPos);
            if (size > bestSize && d < 1300) {
              bestSize = size;
              host = p;
            }
          }
          if (host) {
            fn.state = 'nest';
            fn.targetPlant = host.id;
            fn.targetPart = -1;
          }
        }
        break;
      }
      case 'lampyridae': {
        // the wandering lantern: pure drifting light. Utterly lure-bound —
        // the shepherd's portable sun for a shaded garden.
        if (!lurePull(world, fn, dt, FAUNA_SPEED.lampyridae * 1.4)) {
          faunaWanderTick(world, fn, dt);
        }
        break;
      }
    }
  }

  // deaths (thorns and other hazards), then delayed respawns as fresh critters
  for (let i = world.fauna.length - 1; i >= 0; i--) {
    const fn = world.fauna[i];
    if (fn.hp > 0) continue;
    emit({ type: 'shatter', x: fn.pos.x, y: fn.pos.y, power: 6 });
    world.faunaRespawns.push({ kind: fn.kind, at: world.time + 75 });
    for (const o of world.fauna) if (o.webPrey === fn.id) o.webPrey = -1;
    world.fauna.splice(i, 1);
  }
  for (let i = world.faunaRespawns.length - 1; i >= 0; i--) {
    if (world.time < world.faunaRespawns[i].at) continue;
    const r = world.faunaRespawns.splice(i, 1)[0];
    spawnFauna(world, r.kind);
  }
}

/** One tick of a Scarabaeidae shoving its rock along the stored heading. */
function stepScarabPush(world: World, fn: import('./types').Fauna, dt: number): void {
  const ast = world.asteroids.find((a) => a.id === fn.targetAst);
  if (!ast) {
    fn.state = 'wander';
    return;
  }
  const dir = fn.waypoint; // unit heading chosen when the shove began
  // the shove point: on the rim, opposite the direction of travel
  const contact = {
    x: ast.pos.x - dir.x * (ast.radius + 8),
    y: ast.pos.y - dir.y * (ast.radius + 8),
  };
  const d = dist(fn.pos, contact);
  if (d > 16) {
    steer(fn, contact, FAUNA_SPEED.scarabaeidae, dt);
  } else {
    // braced and shoving: the rock creeps, the beetle rides the rim
    fn.timer -= dt;
    let vx = dir.x * TUNING.world.scarabPush * dt;
    let vy = dir.y * TUNING.world.scarabPush * dt;
    // never shove a rock into another rock or off the map
    const nx = ast.pos.x + vx;
    const ny = ast.pos.y + vy;
    for (const o of world.asteroids) {
      if (o.id === ast.id) continue;
      if (Math.hypot(o.pos.x - nx, o.pos.y - ny) < o.radius + ast.radius + 60) {
        fn.timer = 0;
        vx = 0;
        vy = 0;
        break;
      }
    }
    if (Math.abs(nx) > world.width * 0.46 || Math.abs(ny) > world.height * 0.46) {
      fn.timer = 0;
      vx = 0;
      vy = 0;
    }
    ast.pos.x += vx;
    ast.pos.y += vy;
    fn.pos.x = contact.x + vx;
    fn.pos.y = contact.y + vy;
    fn.vel.x = dir.x * 10; // face the work (render orientation)
    fn.vel.y = dir.y * 10;
    if (fn.timer <= 0) {
      fn.state = 'wander';
      fn.targetAst = -1;
      fn.timer = world.rng.range(35, 70); // a long rest between shoves
    }
  }
}

/** Per-second odds that a snared critter rips free of the web — the bigger
 * the bug, the better its chances. Scarabaeidae never get snared at all. */
const WEB_ESCAPE: Partial<Record<import('./types').FaunaKind, number>> = {
  frugivora: 0.45,
  phytophaga: 0.12,
  anthophila: 0.02,
  lampyridae: 0.15,
};

/**
 * One tick of an Araneae holding its nest: it shoots a web at fauna inside
 * reach, reels the catch back to the perch, and eats it there. Larger bugs
 * can tear free mid-reel (and birds usually do).
 */
function stepSpiderNest(world: World, fn: import('./types').Fauna, dt: number): void {
  const host = world.plants.find((p) => p.id === fn.targetPlant);
  if (!host || !host.alive) {
    fn.state = 'wander';
    fn.targetPlant = -1;
    fn.webPrey = -1;
    return;
  }
  const perch = add(host.astPos, host.parts[host.trunkTip].tip);

  // hold the perch — the web does the chasing
  if (dist(fn.pos, perch) > 8) steer(fn, perch, FAUNA_SPEED.araneae * 0.5, dt);
  else {
    fn.vel.x *= 0.8;
    fn.vel.y *= 0.8;
  }

  if (fn.webPrey >= 0) {
    const prey = world.fauna.find((o) => o.id === fn.webPrey);
    if (!prey) {
      fn.webPrey = -1; // eaten or lost
      return;
    }
    // the struggle: per-second escape roll scaled by the bug's size
    if (world.rng.next() < (WEB_ESCAPE[prey.kind] ?? 0.1) * dt) {
      fn.webPrey = -1;
      const away = norm(sub(prey.pos, perch));
      prey.vel.x = away.x * 160; // tears free and bolts
      prey.vel.y = away.y * 160;
      emit({ type: 'shatter', x: prey.pos.x, y: prey.pos.y, power: 4 });
      return;
    }
    const toPerch = sub(perch, prey.pos);
    const d = len(toPerch);
    if (d > 14) {
      // reel it in: the strand overpowers the prey's own flight
      const pull = scale(norm(toPerch), 55);
      prey.pos.x += pull.x * dt;
      prey.pos.y += pull.y * dt;
      prey.vel.x *= 0.7;
      prey.vel.y *= 0.7;
    } else {
      prey.hp -= 30 * dt; // dinner at the web's heart
      if (world.tick % 5 === 0) {
        emit({ type: 'impact', x: prey.pos.x, y: prey.pos.y, power: 4 });
      }
    }
    return;
  }

  // web-shot: snare the nearest catchable critter inside reach
  let prey: import('./types').Fauna | null = null;
  let bd: number = TUNING.world.spiderReach;
  for (const o of world.fauna) {
    if (o === fn || o.kind === 'araneae') continue;
    if (o.kind === 'scarabaeidae') continue; // far too big to snare
    const d = dist(o.pos, perch);
    if (d < bd) {
      bd = d;
      prey = o;
    }
  }
  if (prey) {
    fn.webPrey = prey.id;
    emit({ type: 'impact', x: prey.pos.x, y: prey.pos.y, power: 5 });
  }
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
  // spacing rule = territory rule: a seed cannot take root inside any living
  // plant's substrate bed (the visible litter arc), nor closer than the
  // faction's hard minimum. Mature plants therefore guard more ground.
  if (!canRootAt(world, ast, angleRad, faction)) return false;
  const plant = createPlant(world, ast, angleRad, faction, colonyId);
  const colony = world.colonies.find((c) => c.id === colonyId);
  plant.energy = R.seedStartEnergy + colonyMods(colony).seedlingEnergyAdd;
  world.plants.push(plant);
  emit({ type: 'sprout', x: anchor.x, y: anchor.y, faction });
  return true;
}

/** Place (or move) a colony's ping — the attention verb. Runs on a cooldown. */
export function setPing(world: World, colonyId: number, pos: Vec2): boolean {
  const colony = world.colonies.find((c) => c.id === colonyId);
  if (!colony || !verbReady(world, colony, 'ping')) return false;
  useVerb(world, colony, 'ping');
  world.ping = { x: pos.x, y: pos.y, colonyId, expires: world.time + 60 };
  emit({ type: 'ping', x: pos.x, y: pos.y });
  return true;
}

function stepSeeds(world: World, dt: number): void {
  const modsBy = new Map(world.colonies.map((c) => [c.id, colonyMods(c)] as const));
  for (let i = world.seeds.length - 1; i >= 0; i--) {
    const s = world.seeds[i];

    // riding a drifting rock: follow it (the debris step handles the landing)
    if (s.riding >= 0) {
      const rock = world.debris.find((d) => d.id === s.riding);
      if (!rock) {
        // the rock is gone and we weren't sprouted with it — a lost seed
        emit({ type: 'seedFizzle', x: s.pos.x, y: s.pos.y, faction: s.faction });
        world.seeds.splice(i, 1);
        continue;
      }
      s.pos.x = rock.pos.x;
      s.pos.y = rock.pos.y;
      continue;
    }

    // riding a Scarabaeidae: cling to the shell until it braces against a
    // NEW rock, then hop off and sprout there — the titan as a ferry
    if (s.ridingFauna >= 0) {
      const mount = world.fauna.find((f) => f.id === s.ridingFauna);
      if (!mount) {
        emit({ type: 'seedFizzle', x: s.pos.x, y: s.pos.y, faction: s.faction });
        world.seeds.splice(i, 1);
        continue;
      }
      s.pos.x = mount.pos.x;
      s.pos.y = mount.pos.y;
      let dropped = false;
      for (const ast of world.asteroids) {
        if (ast.id === s.ignoreAst) continue; // not back onto the birth rock
        if (dist(s.pos, ast.pos) < ast.radius + 26) {
          const angle = Math.atan2(s.pos.y - ast.pos.y, s.pos.x - ast.pos.x);
          const ok = sproutAt(world, s.colonyId, s.faction, ast, angle);
          const at = add(ast.pos, scale(fromAngle(angle), ast.radius));
          emit({ type: ok ? 'seedLand' : 'seedFizzle', x: at.x, y: at.y, faction: s.faction });
          world.seeds.splice(i, 1);
          dropped = true;
          break;
        }
      }
      if (dropped) continue;
      continue;
    }

    // Windborne: after a couple seconds of free flight the seed starts to
    // feel nearby rocks — a short-range terminal-guidance curve, never a
    // tractor beam (and never back toward its own launch rock)
    if (s.age > 2 && modsBy.get(s.colonyId)?.windborne) {
      let pullTo: Vec2 | null = null;
      let bd = 150;
      for (const a of world.asteroids) {
        if (a.id === s.ignoreAst) continue;
        const d = dist(s.pos, a.pos) - a.radius;
        if (d > 8 && d < bd) {
          bd = d;
          pullTo = a.pos;
        }
      }
      if (pullTo) {
        const pull = scale(norm(sub(pullTo, s.pos)), 80 * dt);
        s.vel.x += pull.x;
        s.vel.y += pull.y;
      }
    }
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.age += dt;
    if (s.age > s.maxAge) {
      emit({ type: 'seedFizzle', x: s.pos.x, y: s.pos.y, faction: s.faction });
      world.seeds.splice(i, 1);
      continue;
    }
    // mount a drifting rock — or a passing Scarabaeidae — and hitch a ride
    let mounted = false;
    for (const d of world.debris) {
      if (dist(s.pos, d.pos) < d.radius + 10) {
        s.riding = d.id;
        emit({ type: 'sprout', x: s.pos.x, y: s.pos.y, faction: s.faction });
        mounted = true;
        break;
      }
    }
    if (!mounted) {
      for (const fn of world.fauna) {
        if (fn.kind !== 'scarabaeidae') continue;
        if (dist(s.pos, fn.pos) < 18) {
          s.ridingFauna = fn.id;
          emit({ type: 'sprout', x: s.pos.x, y: s.pos.y, faction: s.faction });
          mounted = true;
          break;
        }
      }
    }
    if (mounted) continue;
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
          if (FACTIONS[s.faction].repro.infects && p.infectedBy < 0 && p.kind !== 'heart') {
            p.infectedBy = s.colonyId; // the spore takes hold — prune it off
            plant.version++;
            emit({ type: 'impact', x: s.pos.x, y: s.pos.y, kind: p.kind, power: 4 });
          } else {
            damagePart(plant, p.id, 14);
          }
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
      // grace period: a fresh seed flies OVER its own launch rock instead of
      // face-planting into it (dome launchers sit right on the surface)
      if (ast.id === s.ignoreAst && s.age < 1.2) continue;
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
        // Volatile Seeds: the landing sears nearby rival growth either way
        if (modsBy.get(s.colonyId)?.volatileSeeds) {
          emit({ type: 'shatter', x: at.x, y: at.y, power: 10 });
          for (const plant of world.plants) {
            if (!plant.alive || plant.colonyId === s.colonyId) continue;
            if (dist(at, plant.astPos) > 320) continue;
            for (const p of plant.parts) {
              if (p.dead) continue;
              const pa = add(plant.astPos, p.base);
              const pb = add(plant.astPos, p.tip);
              if (distToSegment(at, pa, pb) < 34) damagePart(plant, p.id, 20);
              if (!plant.alive) break;
            }
          }
        }
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
  stepFauna(world, dt);
  if (world.tick % 5 === 0) applyContactDamage(world, dt * 5);
  stepDeaths(world);
  if (world.dimming && world.roundState === 'playing') {
    world.dimming.x += world.dimming.speed * dt; // the darkness never rests
  }
  if (world.tick % 10 === 0) {
    stepCanopyControl(world, dt * 10);
    stepVanguard(world, dt * 10);
    stepMutations(world);
    checkRoundEnd(world);
  }
}

/** Deaths ripple outward: Necrosis colonies re-knit their verbs on each kill. */
function stepDeaths(world: World): void {
  if (world.roundState !== 'playing') return;
  for (const p of world.plants) {
    if (p.alive || p.deathScored) continue;
    p.deathScored = true;
    for (const c of world.colonies) {
      if (c.id === p.colonyId) continue;
      if (colonyMods(c).necrosis) {
        c.verbReadyAt = { ping: 0, lure: 0, bless: 0, prune: 0 }; // the feast restores
      }
    }
  }
}

/**
 * The mutation clock: three draft opportunities per round. Draft k deals
 * every card of tier k — two baseline, plus the win-unlocked bonus card when
 * the colony's bonusDepth reaches k. AI picks immediately down its faction's
 * preference list; the player's draft waits in pendingOffer, and their next
 * deal is timed from the moment they choose.
 */
function stepMutations(world: World): void {
  if (world.roundState !== 'playing') return;
  for (const c of world.colonies) {
    if (c.pendingOffer || world.time < c.nextMutationAt) continue;
    const draft = c.mutations.length + 1; // one keep per opportunity
    if (draft > 3) {
      c.nextMutationAt = MUTATION_TIMING.never; // fully evolved this round
      continue;
    }
    const offer = (MUTATIONS[c.faction] ?? [])
      .filter((m) => m.tier === draft && (!m.bonus || c.bonusDepth >= draft))
      .map((m) => m.id);
    if (offer.length === 0) {
      c.nextMutationAt = MUTATION_TIMING.never;
      continue;
    }
    if (!c.isPlayer) {
      const pref = AI_MUTATION_PREF[c.faction] ?? [];
      const rank = (id: string): number => {
        const i = pref.indexOf(id);
        return i < 0 ? 99 : i;
      };
      const pick = offer.slice().sort((x, y) => rank(x) - rank(y))[0];
      c.mutations.push(pick);
      c.nextMutationAt = world.time + MUTATION_TIMING.interval;
    } else {
      c.pendingOffer = offer; // chooseMutation() reschedules
    }
  }
}

/**
 * Canopy control: sample the lit surface of every rock; a sample belongs to
 * a colony when it falls inside one of its plants' substrate arcs. Holding
 * more than the threshold share for holdSec wins the round.
 */
export function computeCanopyControl(world: World): Map<number, number> {
  const toSun = fromAngle(world.sun.angle);
  const counts = new Map<number, number>();
  let litTotal = 0;
  for (const ast of world.asteroids) {
    const residents = world.plants.filter((p) => p.alive && p.asteroidId === ast.id);
    const n = Math.max(8, Math.round((Math.PI * 2 * ast.radius) / 45));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const point = add(ast.pos, scale(fromAngle(a), ast.radius + 6));
      if (!isLit(point, toSun, world.asteroids)) continue;
      litTotal++;
      let bestColony = -1;
      let bestGap = Infinity;
      for (const p of residents) {
        let gap = Math.abs(a - p.anchorAngle) % (Math.PI * 2);
        if (gap > Math.PI) gap = Math.PI * 2 - gap;
        if (gap < substrateHalfAngle(p) && gap < bestGap) {
          bestGap = gap;
          bestColony = p.colonyId;
        }
      }
      if (bestColony >= 0) counts.set(bestColony, (counts.get(bestColony) ?? 0) + 1);
    }
  }
  const shares = new Map<number, number>();
  for (const c of world.colonies) {
    shares.set(c.id, litTotal > 0 ? (counts.get(c.id) ?? 0) / litTotal : 0);
  }
  return shares;
}

function stepCanopyControl(world: World, interval: number): void {
  if (!world.canopyWin || world.roundState !== 'playing') return;
  const shares = computeCanopyControl(world);
  world.canopyShares = [...shares.entries()].map(([colonyId, share]) => ({
    colonyId,
    share,
  }));
  let holder = -1;
  for (const [colonyId, share] of shares) {
    if (share >= world.canopyWin.share) holder = colonyId;
  }
  if (holder !== world.canopyHolder) {
    world.canopyHolder = holder;
    world.canopyHeldSec = 0;
  } else if (holder >= 0) {
    world.canopyHeldSec += interval;
    if (world.canopyHeldSec >= world.canopyWin.holdSec) {
      const isPlayer = world.colonies.find((c) => c.id === holder)?.isPlayer ?? false;
      world.roundState = isPlayer ? 'won' : 'lost';
      world.endReason = 'canopy';
      world.endedAt = world.time;
    }
  }
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
  const modsByColony = new Map(
    world.colonies.map((c) => [c.id, colonyMods(c)] as const),
  );
  for (let i = 0; i < plants.length; i++) {
    const A = plants[i];
    if (!A.alive) continue;
    for (let j = i + 1; j < plants.length; j++) {
      const B = plants[j];
      if (!B.alive || B.colonyId === A.colonyId) continue;
      // broadphase: gardens can only touch if their rocks are close
      if (dist(A.astPos, B.astPos) > 620) continue;
      const mA = modsByColony.get(A.colonyId);
      const mB = modsByColony.get(B.colonyId);
      const dmgToA = dt * (mB?.contactDealt ?? 1) * (mA?.contactTaken ?? 1);
      const dmgToB = dt * (mA?.contactDealt ?? 1) * (mB?.contactTaken ?? 1);
      for (const pa of A.parts) {
        if (pa.dead || pa.kind === 'root') continue;
        const a1 = add(A.astPos, pa.base);
        const a2 = add(A.astPos, pa.tip);
        for (const pb of B.parts) {
          if (pb.dead || pb.kind === 'root') continue;
          const b1 = add(B.astPos, pb.base);
          const b2 = add(B.astPos, pb.tip);
          if (segSegDist(a1, a2, b1, b2) < 3.5) {
            damagePart(A, pa.id, CONTACT_DPS[pa.kind] * dmgToA);
            damagePart(B, pb.id, CONTACT_DPS[pb.kind] * dmgToB);
            // Strangler: the runner drinks what it crushes
            if (mA?.strangler && A.alive && B.alive) {
              const sip = Math.min(1.4 * dt, B.energy);
              B.energy -= sip;
              A.energy = Math.min(A.energy + sip, A.capacity);
            }
            if (mB?.strangler && A.alive && B.alive) {
              const sip = Math.min(1.4 * dt, A.energy);
              A.energy -= sip;
              B.energy = Math.min(B.energy + sip, B.capacity);
            }
            if (!A.alive) return;
            if (!B.alive) break;
          }
        }
        if (!B.alive) break;
      }
    }
  }
}

/** The Long Road: whoever keeps a living plant on the threshold rock long
 * enough crosses into the next region — and ends this one. */
function stepVanguard(world: World, interval: number): void {
  if (!world.vanguard || world.roundState !== 'playing') return;
  let holder = -1;
  for (const p of world.plants) {
    if (!p.alive || p.asteroidId !== world.vanguard.asteroidId) continue;
    if (holder === -1) holder = p.colonyId;
    else if (holder !== p.colonyId) return void resetHold(world); // contested
  }
  if (holder === -1) return void resetHold(world);
  if (holder !== world.vanguardHolder) {
    world.vanguardHolder = holder;
    world.vanguardHeldSec = 0;
  }
  world.vanguardHeldSec += interval;
  if (world.vanguardHeldSec >= world.vanguard.holdSec) {
    const player = world.colonies.find((c) => c.isPlayer);
    world.roundState = holder === player?.id ? 'won' : 'lost';
    world.endReason = 'vanguard';
    world.endedAt = world.time;
  }
}

function resetHold(world: World): void {
  world.vanguardHolder = -1;
  world.vanguardHeldSec = 0;
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
    world.endReason = 'domination';
    world.endedAt = world.time;
  } else if (!rivalsAlive) {
    world.roundState = 'won';
    world.endReason = 'domination';
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
      dropRiders(world, d.id, null); // riders lost to the void
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
          joltSerotiny(world, ast.id);
          destroyed = true;
          break outer;
        }
      }
    }
    if (!destroyed) {
      for (const a of world.asteroids) {
        if (dist(d.pos, a.pos) < d.radius + a.radius) {
          emit({ type: 'shatter', x: d.pos.x, y: d.pos.y, power: d.radius });
          dropRiders(world, d.id, a); // any hitching seeds make landfall here
          joltSerotiny(world, a.id);
          destroyed = true;
          break;
        }
      }
    }
    if (destroyed) world.debris.splice(i, 1);
  }
}

/**
 * Serotiny: a debris strike on a rock is a signal, not just a wound. Every
 * cone belonging to a serotinous colony on that rock surges with charge, and
 * armed cones fire on the spot — catastrophe scatters the next generation.
 */
function joltSerotiny(world: World, asteroidId: number): void {
  for (const plant of world.plants) {
    if (!plant.alive || plant.asteroidId !== asteroidId) continue;
    const mods = colonyMods(world.colonies.find((c) => c.id === plant.colonyId));
    if (!mods.serotiny) continue;
    const R = FACTIONS[plant.faction].repro;
    for (const p of plant.parts) {
      if (p.dead || p.kind !== 'cone') continue;
      if (p.armedAt >= 0) {
        fireCone(world, plant, p.id, null);
      } else {
        p.charge = Math.min(p.charge + R.coneEnergy * 0.4, R.coneEnergy);
      }
    }
  }
}

/** Resolve seeds riding a doomed debris: sprout on `ast`, else fizzle. */
function dropRiders(world: World, debrisId: number, ast: import('./types').Asteroid | null): void {
  for (let i = world.seeds.length - 1; i >= 0; i--) {
    const s = world.seeds[i];
    if (s.riding !== debrisId) continue;
    if (ast) {
      const angle = Math.atan2(s.pos.y - ast.pos.y, s.pos.x - ast.pos.x);
      const ok = sproutAt(world, s.colonyId, s.faction, ast, angle);
      const at = add(ast.pos, scale(fromAngle(angle), ast.radius));
      emit({ type: ok ? 'seedLand' : 'seedFizzle', x: at.x, y: at.y, faction: s.faction });
    } else {
      emit({ type: 'seedFizzle', x: s.pos.x, y: s.pos.y, faction: s.faction });
    }
    world.seeds.splice(i, 1);
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
  for (const a of world.asteroids) {
    mix(a.pos.x); // scarabs move rocks: their positions are live state
    mix(a.pos.y);
  }
  mix(world.dimming ? world.dimming.x : -1);
  mix(world.vanguardHeldSec * 10);
  for (const p of world.plants) {
    mix(p.energy * 100);
    mix(p.parts.length);
    mix(p.alive ? 1 : 0);
    mix(p.myco ? p.myco.half * 1000 : -1);
    for (const part of p.parts) {
      mix(part.tip.x);
      mix(part.tip.y);
      mix(part.hp * 100);
      mix(part.charge * 100);
      mix(part.dead ? 1 : 0);
    }
  }
  for (const c of world.colonies) {
    mix(c.mutations.length);
    mix(c.pendingOffer ? c.pendingOffer.length : -1);
    mix(Math.min(c.nextMutationAt, 1e6));
    mix(c.verbReadyAt.ping);
    mix(c.verbReadyAt.lure);
    mix(c.verbReadyAt.bless);
    mix(c.verbReadyAt.prune);
  }
  mix(world.faunaRespawns.length);
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
  for (const fn of world.fauna) {
    mix(fn.pos.x);
    mix(fn.pos.y);
  }
  return h;
}

import type { Vec2 } from './vec';
import { add, sub, scale, norm, rot, dot, dist, fromAngle, segsIntersect, DEG } from './vec';
import { makeRng } from './rng';
import type { Asteroid, Part, PartKind, Plant, World, FactionId } from './types';
import { FACTIONS, type FactionDef } from '../content/factions';
import { TUNING } from '../content/tuning';
import {
  shadeAt,
  isLit,
  toSunVec,
  canopyCross,
  CANOPY_BIN,
  type CanopyIndex,
  type CanopySeg,
} from './light';
import { emit } from './events';
import { colonyMods, type Mods } from './stats';
import { surfaceRadiusAt } from './asteroid';

const EMPTY_SEGS: CanopySeg[] = [];

export function createPlant(
  world: World,
  asteroid: Asteroid,
  anchorAngle: number,
  faction: FactionId,
  colonyId: number,
): Plant {
  const f = FACTIONS[faction];
  const up = fromAngle(anchorAngle);
  const anchor = scale(up, surfaceRadiusAt(asteroid, anchorAngle));
  const heart: Part = {
    id: 0,
    kind: 'heart',
    parent: -1,
    base: anchor,
    tip: anchor,
    dir: up,
    len: 0,
    depth: 0,
    onBranch: false,
    side: 0,
    leafCount: 0,
    age: 0,
    hp: f.life.hp.heart,
    maxHp: f.life.hp.heart,
    dead: false,
    hardened: false,
    maxAge: 0,
    charge: 0,
    armedAt: -1,
    infected: false,
    shade: 0,
    group: 0,
  };
  const rng = makeRng((world.seed ^ ((world.nextId + 1) * 0x9e3779b9)) >>> 0);
  return {
    id: world.nextId++,
    alive: true,
    faction,
    colonyId,
    asteroidId: asteroid.id,
    astPos: { ...asteroid.pos },
    anchorAngle,
    up,
    parts: [heart],
    buds: [],
    budCursor: 0,
    vineSide: rng.next() < 0.5 ? -1 : 1,
    energy: f.energy.heartInitial,
    capacity: f.energy.capBase,
    rootCount: 0,
    trunkSegs: 0,
    trunkTip: 0,
    growthCooldown: 0,
    age: 0,
    blessedUntil: 0,
    infectSpreadAt: 0,
    deathScored: false,
    rng,
    version: 0,
    lastIncome: 0,
    lastUpkeep: 0,
    litLeaves: 0,
    canopyLeaves: 0,
    shadowLeaves: 0,
    totalLeaves: 0,
  };
}

export function stepPlant(world: World, plant: Plant, dt: number, canopy: CanopyIndex): void {
  if (!plant.alive) return; // husks are inert until decomposers exist (M8)
  const f = FACTIONS[plant.faction];
  const asteroid = world.asteroids.find((a) => a.id === plant.asteroidId);
  if (!asteroid) return;

  plant.astPos = { ...asteroid.pos };
  plant.age += dt;

  const colony = world.colonies.find((c) => c.id === plant.colonyId);
  const mods = colonyMods(colony);
  const blessed = world.time < plant.blessedUntil;

  // --- Aging: bark hardening, natural needle drop, infection rot -------------
  let anyInfected = false;
  for (const p of plant.parts) {
    if (p.dead) continue;
    p.age += dt;
    if (p.kind === 'stem' && !p.hardened && p.age > f.life.hardenAge * mods.hardenAgeMult) {
      p.hardened = true;
      p.hp += f.life.hardenBonus + mods.hardenBonusAdd;
      p.maxHp += f.life.hardenBonus + mods.hardenBonusAdd;
    }
    if (p.infected) {
      anyInfected = true;
      p.hp -= 0.4 * dt; // the parasite eats quietly (no impact-event spam)
      if (p.hp <= 0) killPart(plant, p.id);
    }
    if (p.maxAge > 0 && p.age > p.maxAge) killPart(plant, p.id); // needle drops, slot reopens
  }

  // infection creeps to a neighboring part every few seconds — prune it off
  if (anyInfected && world.time >= plant.infectSpreadAt) {
    plant.infectSpreadAt = world.time + 5;
    outer: for (const p of plant.parts) {
      if (p.dead || !p.infected) continue;
      const parent = p.parent >= 0 ? plant.parts[p.parent] : null;
      if (parent && !parent.dead && !parent.infected) {
        parent.infected = true;
        plant.version++;
        break;
      }
      for (const c of plant.parts) {
        if (!c.dead && !c.infected && c.parent === p.id) {
          c.infected = true;
          plant.version++;
          break outer;
        }
      }
    }
  }

  // --- Energy: income from light or from death; upkeep from everything ------
  const toSun = toSunVec(world.sun);
  const decomp = f.energy.mode === 'decomp';
  let income = 0;
  let upkeep = 0;
  let litLeaves = 0;
  let canopyLeaves = 0;
  let shadowLeaves = 0;
  let totalLeaves = 0;
  let aliveParts = 0;
  let stems = 0;
  for (const p of plant.parts) {
    if (p.dead) continue;
    aliveParts++;
    upkeep += f.energy.upkeep[p.kind];
    if (p.kind === 'heart') income += f.energy.heartIncome;
    if (p.kind === 'stem') stems++;
    if (p.kind !== 'leaf') continue;
    totalLeaves++;
    if (decomp) {
      litLeaves++; // gills never mind the dark
      continue;
    }
    const mid = add(asteroid.pos, add(p.base, scale(p.dir, p.len * 0.5)));
    const bin =
      canopy.bins.get(Math.floor(canopyCross(mid.x, mid.y, toSun) / CANOPY_BIN)) ??
      EMPTY_SEGS;
    const shade = shadeAt(mid, toSun, world.asteroids, bin, plant.id, p.group);
    if (shade !== p.shade) {
      p.shade = shade;
      plant.version++; // lighting changed -> leaf tint must re-render
    }
    if (shade === 0) litLeaves++;
    else if (shade === 1) canopyLeaves++;
    else shadowLeaves++;
    const shadeMult =
      shade === 0
        ? 1
        : shade === 1
          ? (mods.canopyShadeOverride ?? f.energy.canopyShade)
          : (mods.shadeFloorOverride ?? f.energy.shadeFloor);
    const angleEff = Math.max(Math.abs(dot(p.dir, toSun)), f.energy.minAngleEff);
    income +=
      f.energy.leafIncome *
      angleEff *
      shadeMult *
      world.sunFactor *
      mods.leafIncome *
      (blessed ? TUNING.verbs.blessIncomeMult : 1);
  }
  if (decomp && f.energy.decomp) {
    // saprotroph economy: mineral trickle per cord, digestion per gill, and
    // any husk on this rock is food. The dying sun feeds them instead.
    const D = f.energy.decomp;
    const darkBoost = 1 + (1 - world.sunFactor) * 1.2;
    income += (stems * D.rockTrickle + totalLeaves * D.gillIncome) * mods.leafIncome * darkBoost;
    let mouths = 3; // how many husk parts one web digests at once
    for (const other of world.plants) {
      if (mouths <= 0) break;
      if (other.asteroidId !== plant.asteroidId) continue;
      for (const hp of other.parts) {
        if (!hp.dead || hp.maxHp <= 0) continue;
        const bite = Math.min(D.huskRate * dt, hp.maxHp);
        hp.maxHp -= bite;
        income += (bite * D.huskYield) / dt;
        if (hp.maxHp <= 0) other.version++; // consumed: the husk crumbles away
        if (--mouths <= 0) break;
      }
    }
    income *= blessed ? TUNING.verbs.blessIncomeMult : 1;
  }
  plant.lastIncome = income;
  plant.lastUpkeep = upkeep;
  plant.litLeaves = litLeaves;
  plant.canopyLeaves = canopyLeaves;
  plant.shadowLeaves = shadowLeaves;
  plant.totalLeaves = totalLeaves;
  plant.capacity = f.energy.capBase + aliveParts * f.energy.capPerPart;
  plant.energy = Math.min(Math.max(plant.energy + (income - upkeep) * dt, 0), plant.capacity);

  // --- Starvation: at zero energy the colony consumes itself -----------------
  if (plant.energy <= 0 && income < upkeep) {
    applyStarvation(plant, f, dt);
    if (!plant.alive) return;
  }

  // --- Cones: charge, arm, and eventually self-fire ---------------------------
  for (const p of plant.parts) {
    if (p.dead || p.kind !== 'cone') continue;
    const R = f.repro;
    if (p.charge < R.coneEnergy) {
      // Anthophila pollination: a mote near the flower speeds its bloom
      let pollinate = 1;
      if (f.repro.style === 'fauna') {
        const cx = plant.astPos.x + p.tip.x;
        const cy = plant.astPos.y + p.tip.y;
        for (const fn of world.fauna) {
          if (fn.kind !== 'anthophila') continue;
          if (Math.hypot(fn.pos.x - cx, fn.pos.y - cy) < 50) {
            pollinate = 1.8;
            break;
          }
        }
      }
      const take = Math.min(
        R.chargeRate * mods.chargeRate * pollinate * dt,
        Math.max(plant.energy - f.energy.reserve, 0),
        R.coneEnergy - p.charge,
      );
      if (take > 0) {
        p.charge += take;
        plant.energy -= take;
      }
      if (p.charge >= R.coneEnergy && p.armedAt < 0) {
        p.armedAt = world.time;
        plant.version++;
      }
    } else if (p.armedAt >= 0) {
      // fauna-style fruit waits for a Frugivora; the timer is only the
      // self-drop fallback, so it's forgiving. An active ping makes armed
      // cones answer the shepherd almost immediately.
      let delay = colony && !colony.isPlayer ? R.aiAutoFire : R.armedAutoFire;
      if (world.ping && world.ping.colonyId === plant.colonyId) delay = Math.min(delay, 1.5);
      if (world.time - p.armedAt > delay) fireCone(world, plant, p.id, null);
    }
  }

  // --- Growth: one action per cooldown window -------------------------------
  const cooldown = f.growth.actionCooldown * (blessed ? TUNING.verbs.blessCooldownMult : 1);
  plant.growthCooldown -= dt;
  if (plant.growthCooldown <= 0) {
    if (tryGrow(plant, f, toSun, mods)) {
      plant.growthCooldown = cooldown;
      plant.version++;
      const grown = plant.parts[plant.parts.length - 1];
      emit({
        type: 'grow',
        x: plant.astPos.x + grown.tip.x,
        y: plant.astPos.y + grown.tip.y,
        faction: plant.faction,
      });
    } else {
      plant.growthCooldown = cooldown * 0.5; // re-check soon
    }
  }
}

/** The trunk-segment goal after colony traits/instincts. */
export function trunkTargetFor(f: FactionDef, mods: Mods): number {
  return Math.max(4, Math.round(f.growth.trunkTarget * mods.trunkTargetMult) + mods.trunkTargetAdd);
}

/**
 * The plant's terraformed substrate bed on its rock: an arc (radians half-
 * angle) around the anchor that widens as the plant matures. Drives both the
 * bed rendering and canopy-control territory (M6).
 */
export function substrateHalfAngle(plant: Plant): number {
  const S = TUNING.colony.substrate;
  const r = Math.max(Math.hypot(plant.parts[0].base.x, plant.parts[0].base.y), 1);
  const aliveParts = plant.parts.reduce((n, p) => n + (p.dead ? 0 : 1), 0);
  const arcLen = Math.min(S.baseArc + aliveParts * S.perPart, S.maxArc);
  return arcLen / r;
}

/** Can a seed of this faction take root at this angle? (bed + spacing rule) */
export function canRootAt(
  world: World,
  ast: Asteroid,
  angleRad: number,
  faction: FactionId,
): boolean {
  const R = FACTIONS[faction].repro;
  const seedHalf = (TUNING.colony.substrate.baseArc * 0.5) / ast.radius;
  const anchor = add(ast.pos, scale(fromAngle(angleRad), ast.radius));
  for (const pl of world.plants) {
    if (!pl.alive || pl.asteroidId !== ast.id) continue;
    let gap = Math.abs(angleRad - pl.anchorAngle) % (Math.PI * 2);
    if (gap > Math.PI) gap = Math.PI * 2 - gap;
    if (gap < substrateHalfAngle(pl) + seedHalf) return false;
    const other = add(ast.pos, scale(fromAngle(pl.anchorAngle), ast.radius));
    if (dist(anchor, other) < R.minSpacing) return false;
  }
  return true;
}

export function aliveConeCount(plant: Plant): number {
  return plant.parts.filter((p) => !p.dead && p.kind === 'cone').length;
}

/** Attempt exactly one growth action. Returns true if something grew. */
function tryGrow(plant: Plant, f: FactionDef, toSun: Vec2, mods: Mods): boolean {
  const g = f.growth;
  const spendable = plant.energy - f.energy.reserve;

  // 1. Anchor first: roots before anything else.
  if (plant.rootCount < g.rootMax) {
    if (spendable < g.rootCost) return false;
    addRoot(plant, f, mods);
    return true;
  }

  // 2. Photosynthesis before architecture: fill every open needle slot first,
  //    so income always scales with structure and the plant can't bankrupt
  //    itself building a leafless trunk.
  if (leafDeficit(plant, f) > 0 && spendable >= g.leafCost) return addLeaf(plant, f, mods);

  // 3. Extend the trunk (spawns branch buds on schedule).
  if (plant.trunkSegs < trunkTargetFor(f, mods) && spendable >= g.stemCost) {
    extendTrunk(plant, f, toSun, mods);
    return true;
  }

  // 4. Extend a side branch.
  if (spendable >= g.stemCost && extendBranch(plant, f, mods)) return true;

  // 5. Bud seed cones on the highest free tips.
  if (aliveConeCount(plant) < f.repro.coneMax && spendable >= f.repro.coneCost) {
    return growCone(plant, f, mods);
  }

  return false;
}

/** Bud a cone on one of the highest stem tips (trunk top or branch ends). */
function growCone(plant: Plant, f: FactionDef, mods: Mods): boolean {
  const hasChildStem = new Set<number>();
  for (const p of plant.parts) {
    if (!p.dead && (p.kind === 'stem' || p.kind === 'cone')) hasChildStem.add(p.parent);
  }
  const cands = plant.parts
    .filter((p) => !p.dead && p.kind === 'stem' && !hasChildStem.has(p.id))
    .sort((a, b) => (b.base.x ** 2 + b.base.y ** 2) - (a.base.x ** 2 + a.base.y ** 2));
  if (cands.length === 0) return false;
  const stem = cands[plant.rng.int(Math.min(3, cands.length))];
  const hp = rollHp(plant, f, 'cone', mods);
  pushPart(plant, {
    kind: 'cone',
    parent: stem.id,
    base: stem.tip,
    tip: add(stem.tip, scale(stem.dir, 5)),
    dir: stem.dir,
    len: 5,
    depth: stem.depth,
    onBranch: stem.onBranch,
    side: stem.side,
    leafCount: 0,
    age: 0,
    hp,
    maxHp: hp,
    dead: false,
    hardened: false,
    maxAge: 0,
    charge: 0,
    armedAt: -1,
    infected: false,
    shade: 0,
    group: stem.group,
  });
  plant.energy -= f.repro.coneCost;
  return true;
}

/**
 * Fire an armed cone. dir null = auto-aim at the most promising asteroid in
 * range (unclaimed, rich, near the colony's ping). Returns false if held
 * (not armed, or nothing worth shooting at).
 */
export function fireCone(world: World, plant: Plant, coneId: number, dir: Vec2 | null): boolean {
  const cone = plant.parts[coneId];
  const f = FACTIONS[plant.faction];
  const R = f.repro;
  if (!plant.alive || cone.dead || cone.kind !== 'cone' || cone.charge < R.coneEnergy) {
    return false;
  }
  const mods = colonyMods(world.colonies.find((c) => c.id === plant.colonyId));
  const range = R.seedRange * mods.seedRange;
  const from = add(plant.astPos, cone.tip);
  const aim = dir ?? autoAim(world, plant, from, range);
  if (!aim) return false; // hold fire until something is in range (or the player aims)

  const fan = R.sporeFan ?? 1;
  for (let i = 0; i < fan; i++) {
    const spread = (i - (fan - 1) / 2) * 0.22;
    world.seeds.push({
      id: world.nextId++,
      colonyId: plant.colonyId,
      faction: plant.faction,
      pos: { ...from },
      vel: scale(rot(norm(aim), spread), R.seedSpeed),
      age: 0,
      maxAge: range / R.seedSpeed,
    });
  }
  emit({ type: 'seedLaunch', x: from.x, y: from.y, faction: plant.faction });
  killPart(plant, coneId); // spent cone drops; the slot reopens
  return true;
}

function autoAim(world: World, plant: Plant, from: Vec2, range: number): Vec2 | null {
  const toSun = toSunVec(world.sun);
  let best: Vec2 | null = null;
  let bestScore = 0;
  for (const ast of world.asteroids) {
    // seed factions spread outward; spore factions also blanket their own rock
    if (ast.id === plant.asteroidId && !FACTIONS[plant.faction].repro.infects) continue;
    const d = Math.hypot(ast.pos.x - from.x, ast.pos.y - from.y) - ast.radius;
    if (d > range * 0.95) continue;
    let own = 0;
    let rival = 0;
    for (const p of world.plants) {
      if (!p.alive || p.asteroidId !== ast.id) continue;
      if (p.colonyId === plant.colonyId) own++;
      else rival++;
    }
    // sample landing angles: only rocks with genuinely rootable ground count,
    // and the shot goes at a real free spot (sunlit if possible)
    const samples = 10;
    const a0 = plant.rng.range(0, Math.PI * 2);
    let freeCount = 0;
    let landAngle: number | null = null;
    let landLit = false;
    for (let k = 0; k < samples; k++) {
      const a = a0 + (k / samples) * Math.PI * 2;
      if (!canRootAt(world, ast, a, plant.faction)) continue;
      freeCount++;
      const point = add(ast.pos, scale(fromAngle(a), ast.radius + 6));
      const lit = isLit(point, toSun, world.asteroids);
      if (landAngle === null || (lit && !landLit)) {
        landAngle = a;
        landLit = lit;
      }
    }
    if (freeCount === 0 || landAngle === null) continue; // nothing can root here
    let score =
      ((ast.rich ? 1.35 : 1) *
        (1.2 - d / range) *
        Math.sqrt(freeCount / samples) *
        (landLit ? 1 : 0.4)) /
      (1 + own * 1.5 + rival * 0.5);
    const ping = world.ping;
    if (
      ping &&
      ping.colonyId === plant.colonyId &&
      Math.hypot(ping.x - ast.pos.x, ping.y - ast.pos.y) < ast.radius + 130
    ) {
      score *= 25; // the shepherd pointed HERE
    }
    if (score > bestScore) {
      bestScore = score;
      best = sub(add(ast.pos, scale(fromAngle(landAngle), ast.radius + 2)), from);
    }
  }
  if (best) return best;

  // nothing left to colonize in range: bombard the nearest rival canopy
  let bestD = range * 0.95;
  for (const p of world.plants) {
    if (!p.alive || p.colonyId === plant.colonyId) continue;
    const crown = add(p.astPos, p.parts[p.trunkTip].tip);
    const d = Math.hypot(crown.x - from.x, crown.y - from.y);
    if (d < bestD) {
      bestD = d;
      const jitter = scale(fromAngle(plant.rng.range(0, Math.PI * 2)), 15);
      best = sub(add(crown, jitter), from);
    }
  }
  return best;
}

export function maxLeavesFor(part: Part, f: FactionDef): number {
  if (part.kind !== 'stem') return 0;
  return part.onBranch ? f.growth.leavesPerBranchStem : f.growth.leavesPerTrunkStem;
}

export function leafDeficit(plant: Plant, f: FactionDef): number {
  let d = 0;
  for (const p of plant.parts) {
    if (p.dead) continue;
    d += Math.max(0, maxLeavesFor(p, f) - p.leafCount);
  }
  return d;
}

/** Roll hp with per-part variance so damage cascades stagger naturally. */
function rollHp(plant: Plant, f: FactionDef, kind: PartKind, mods: Mods): number {
  const v = f.life.hpVariance;
  return f.life.hp[kind] * plant.rng.range(1 - v, 1 + v) * mods.partHp;
}

/**
 * Kill a part and its whole subtree. Dead parts stay in the array as husk
 * (stable indices); needle slots and root counts reopen so the plant can
 * regrow through the wound. Killing the heart kills the colony.
 */
export function killPart(plant: Plant, id: number): void {
  const stack = [id];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const part = plant.parts[i];
    if (part.dead) continue;
    part.dead = true;
    part.hp = 0;
    emit({
      type: 'partDied',
      x: plant.astPos.x + (part.base.x + part.tip.x) / 2,
      y: plant.astPos.y + (part.base.y + part.tip.y) / 2,
      kind: part.kind,
      faction: plant.faction,
    });
    if (part.kind === 'leaf') {
      const parent = plant.parts[part.parent];
      if (parent && parent.leafCount > 0) parent.leafCount--;
    }
    if (part.kind === 'root' && plant.rootCount > 0) plant.rootCount--;
    if (part.kind === 'heart') {
      plant.alive = false;
      for (const p of plant.parts) p.dead = true; // the whole colony husks
      plant.version++;
      return;
    }
    for (const c of plant.parts) if (c.parent === i && !c.dead) stack.push(c.id);
  }

  // cull branch buds rooted in dead wood
  plant.buds = plant.buds.filter(
    (b) =>
      !plant.parts[b.fromPart].dead && (b.lastPart === -1 || !plant.parts[b.lastPart].dead),
  );

  // repair the trunk tip so the spire regrows from the cut
  if (plant.parts[plant.trunkTip].dead) {
    let tip = 0;
    let depth = 0;
    for (const p of plant.parts) {
      if (!p.dead && p.kind === 'stem' && !p.onBranch && p.depth > depth) {
        tip = p.id;
        depth = p.depth;
      }
    }
    plant.trunkTip = tip;
    plant.trunkSegs = depth;
  }
  plant.version++;
}

export function damagePart(plant: Plant, id: number, dmg: number): void {
  const p = plant.parts[id];
  if (p.dead) return;
  p.hp -= dmg;
  emit({
    type: 'impact',
    x: plant.astPos.x + (p.base.x + p.tip.x) / 2,
    y: plant.astPos.y + (p.base.y + p.tip.y) / 2,
    kind: p.kind,
    power: dmg,
  });
  if (p.hp <= 0) killPart(plant, id);
  else plant.version++; // damage tint / cracks need a re-render
}

/** Starvation cascade: leaves wither first, then wood, the heart last. */
function applyStarvation(plant: Plant, f: FactionDef, dt: number): void {
  const hasAlive = (k: PartKind): boolean =>
    plant.parts.some((p) => !p.dead && p.kind === k);
  let kinds: PartKind[];
  if (hasAlive('leaf') || hasAlive('cone')) kinds = ['leaf', 'cone'];
  else if (hasAlive('stem') || hasAlive('root')) kinds = ['stem', 'root'];
  else kinds = ['heart'];
  for (const p of plant.parts) {
    if (p.dead || !kinds.includes(p.kind)) continue;
    p.hp -= f.life.starveDps[p.kind] * dt;
    if (p.hp <= 0) killPart(plant, p.id);
    if (!plant.alive) return;
  }
}

export interface PruneResult {
  cut: number;
  refund: number;
}

/**
 * The Prune verb: cut every part whose segment crosses the swipe path (the
 * heart is uncuttable). Subtrees fall with their support; a fraction of the
 * build cost of everything removed returns to the colony as energy.
 */
export function pruneAlongPath(world: World, plant: Plant, path: Vec2[]): PruneResult {
  if (!plant.alive || path.length < 2) return { cut: 0, refund: 0 };
  const f = FACTIONS[plant.faction];
  const ast = world.asteroids.find((a) => a.id === plant.asteroidId);
  if (!ast) return { cut: 0, refund: 0 };

  const hits: number[] = [];
  for (const part of plant.parts) {
    if (part.dead || part.kind === 'heart') continue;
    const a = add(ast.pos, part.base);
    const b = add(ast.pos, part.tip);
    for (let i = 0; i < path.length - 1; i++) {
      if (segsIntersect(path[i], path[i + 1], a, b)) {
        hits.push(part.id);
        break;
      }
    }
  }
  if (hits.length === 0) return { cut: 0, refund: 0 };

  const wasAlive = plant.parts.map((p) => !p.dead);
  for (const id of hits) if (!plant.parts[id].dead) killPart(plant, id);

  const costs: Record<PartKind, number> = {
    stem: f.growth.stemCost,
    leaf: f.growth.leafCost,
    root: f.growth.rootCost,
    cone: f.repro.coneCost,
    heart: 0,
  };
  let cut = 0;
  let refund = 0;
  for (const part of plant.parts) {
    if (wasAlive[part.id] && part.dead) {
      cut++;
      refund += costs[part.kind] * f.life.pruneRefund;
    }
  }
  plant.energy = Math.min(plant.energy + refund, plant.capacity);
  return { cut, refund };
}

function pushPart(plant: Plant, part: Omit<Part, 'id'>): Part {
  const full: Part = { ...part, id: plant.parts.length };
  plant.parts.push(full);
  return full;
}

function addRoot(plant: Plant, f: FactionDef, mods: Mods): void {
  const g = f.growth;
  const heart = plant.parts[0];
  const side = plant.rootCount === 0 ? -1 : 1;
  const dir = norm(rot(scale(plant.up, -1), side * plant.rng.range(15, 30) * DEG));
  const hp = rollHp(plant, f, 'root', mods);
  pushPart(plant, {
    kind: 'root',
    parent: 0,
    base: heart.base,
    tip: add(heart.base, scale(dir, g.rootLen)),
    dir,
    len: g.rootLen,
    depth: 0,
    onBranch: false,
    side,
    leafCount: 0,
    age: 0,
    hp,
    maxHp: hp,
    dead: false,
    hardened: false,
    maxAge: 0,
    charge: 0,
    armedAt: -1,
    infected: false,
    shade: 0,
    group: 0,
  });
  plant.rootCount++;
  plant.energy -= g.rootCost;
}

function extendTrunk(plant: Plant, f: FactionDef, toSun: Vec2, mods: Mods): void {
  const g = f.growth;
  const tip = plant.parts[plant.trunkTip];
  const prevDir = plant.trunkSegs === 0 ? plant.up : tip.dir;
  const noise = fromAngle(plant.rng.range(0, Math.PI * 2));
  // vines hug the surface: bias along the local tangent, wrapping vineSide-ward
  const radial = norm(tip.tip.x === 0 && tip.tip.y === 0 ? plant.up : tip.tip);
  const tangent = rot(radial, (plant.vineSide || 1) * (Math.PI / 2));
  let dir = norm(
    add(
      add(scale(prevDir, g.wPrevDir), scale(plant.up, g.wUp)),
      add(
        add(scale(toSun, g.wSun), scale(noise, g.wNoise)),
        scale(tangent, g.wTangent),
      ),
    ),
  );
  if (g.style === 'vine') {
    // keep runners from burrowing: reflect the radial-inward component away
    const tipR = Math.hypot(tip.tip.x, tip.tip.y);
    const anchorR = Math.hypot(plant.parts[0].base.x, plant.parts[0].base.y);
    if (tipR < anchorR + 6 && dot(dir, radial) < 0.05) {
      dir = norm(add(dir, scale(radial, 0.4)));
    }
  }
  const len = g.trunkSegLen * (1 - Math.min(plant.trunkSegs * g.trunkTaper * 0.1, 0.45));
  const base = tip.tip;
  const depth = plant.trunkSegs + 1;
  const hp = rollHp(plant, f, 'stem', mods);
  const part = pushPart(plant, {
    kind: 'stem',
    parent: plant.trunkTip,
    base,
    tip: add(base, scale(dir, len)),
    dir,
    len,
    depth,
    onBranch: false,
    side: 0,
    leafCount: 0,
    age: 0,
    hp,
    maxHp: hp,
    dead: false,
    hardened: false,
    maxAge: 0,
    charge: 0,
    armedAt: -1,
    infected: false,
    shade: 0,
    group: 0,
  });
  plant.trunkTip = part.id;
  plant.trunkSegs = depth;
  plant.energy -= g.stemCost;

  // Branch buds on schedule: lower branches get more steps (spire silhouette).
  if (depth >= g.branchStartDepth && (depth - g.branchStartDepth) % g.branchEvery === 0) {
    const maxSteps =
      Math.max(1, Math.min(4, Math.round((g.trunkTarget - depth) / 3))) + mods.branchStepsAdd;
    for (const side of [-1, 1]) {
      plant.buds.push({ fromPart: part.id, lastPart: -1, side, steps: 0, maxSteps });
    }
  }
}

function extendBranch(plant: Plant, f: FactionDef, mods: Mods): boolean {
  const g = f.growth;
  const live = plant.buds.filter((b) => b.steps < b.maxSteps);
  if (live.length === 0) return false;
  const bud = live[plant.budCursor % live.length];
  plant.budCursor++;

  const from = bud.lastPart === -1 ? plant.parts[bud.fromPart] : plant.parts[bud.lastPart];
  let dir: Vec2;
  if (bud.lastPart === -1) {
    const spread = g.branchAngleDeg + plant.rng.range(-8, 8);
    dir = norm(rot(from.dir, bud.side * spread * DEG));
  } else {
    // subsequent steps curl gently upward (toward the anchor normal)
    dir = norm(add(from.dir, scale(plant.up, g.branchCurl)));
  }
  const len = g.branchSegLen * (1 - bud.steps * 0.15);
  const hp = rollHp(plant, f, 'stem', mods);
  const part = pushPart(plant, {
    kind: 'stem',
    parent: from.id,
    base: from.tip,
    tip: add(from.tip, scale(dir, len)),
    dir,
    len,
    depth: from.depth,
    onBranch: true,
    side: bud.side,
    leafCount: 0,
    age: 0,
    hp,
    maxHp: hp,
    dead: false,
    hardened: false,
    maxAge: 0,
    charge: 0,
    armedAt: -1,
    infected: false,
    shade: 0,
    group: 0,
  });
  // occlusion group: a branch's first segment names the group for the whole branch
  part.group = bud.lastPart === -1 ? part.id : from.group;
  bud.lastPart = part.id;
  bud.steps++;
  plant.energy -= g.stemCost;
  return true;
}

function addLeaf(plant: Plant, f: FactionDef, mods: Mods): boolean {
  const g = f.growth;
  // Fill youngest stems first so needles appear where growth is happening.
  for (let i = plant.parts.length - 1; i >= 0; i--) {
    const stem = plant.parts[i];
    if (stem.kind !== 'stem' || stem.dead || stem.leafCount >= maxLeavesFor(stem, f)) continue;
    const side = stem.leafCount % 2 === 0 ? 1 : -1;
    const t = stem.onBranch ? 0.65 : 0.5;
    const base = add(stem.base, scale(stem.dir, stem.len * t));
    const ang = (g.leafAngleDeg + plant.rng.range(-10, 10)) * DEG;
    const dir = norm(rot(stem.dir, side * ang));
    const hp = rollHp(plant, f, 'leaf', mods);
    pushPart(plant, {
      kind: 'leaf',
      parent: stem.id,
      base,
      tip: add(base, scale(dir, g.leafLen)),
      dir,
      len: g.leafLen,
      depth: stem.depth,
      onBranch: stem.onBranch,
      side,
      leafCount: 0,
      age: 0,
      hp,
      maxHp: hp,
      dead: false,
      hardened: false,
      maxAge: plant.rng.range(f.life.leafLifespan[0], f.life.leafLifespan[1]),
      charge: 0,
      armedAt: -1,
      infected: false,
      shade: 0,
      group: stem.group, // needles share their branch's occlusion group
    });
    stem.leafCount++;
    plant.energy -= g.leafCost;
    return true;
  }
  return false;
}

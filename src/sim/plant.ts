import type { Vec2 } from './vec';
import { add, scale, norm, rot, dot, fromAngle, segsIntersect, DEG } from './vec';
import { makeRng } from './rng';
import type { Asteroid, Part, PartKind, Plant, World, FactionId } from './types';
import { FACTIONS, type FactionDef } from '../content/factions';
import { shadeAt, toSunVec, type CanopySeg } from './light';

export function createPlant(
  world: World,
  asteroid: Asteroid,
  anchorAngle: number,
  faction: FactionId,
): Plant {
  const f = FACTIONS[faction];
  const up = fromAngle(anchorAngle);
  const anchor = scale(up, asteroid.radius);
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
    shade: 0,
    group: 0,
  };
  return {
    id: world.nextId++,
    alive: true,
    faction,
    asteroidId: asteroid.id,
    anchorAngle,
    up,
    parts: [heart],
    buds: [],
    budCursor: 0,
    energy: f.energy.heartInitial,
    capacity: f.energy.capBase,
    rootCount: 0,
    trunkSegs: 0,
    trunkTip: 0,
    growthCooldown: 0,
    age: 0,
    rng: makeRng((world.seed ^ (world.nextId * 0x9e3779b9)) >>> 0),
    version: 0,
    lastIncome: 0,
    lastUpkeep: 0,
    litLeaves: 0,
    canopyLeaves: 0,
    shadowLeaves: 0,
    totalLeaves: 0,
  };
}

export function stepPlant(world: World, plant: Plant, dt: number, canopy: CanopySeg[]): void {
  if (!plant.alive) return; // husks are inert until decomposers exist (M8)
  const f = FACTIONS[plant.faction];
  const asteroid = world.asteroids.find((a) => a.id === plant.asteroidId);
  if (!asteroid) return;

  plant.age += dt;

  // --- Aging: bark hardening, natural needle drop ----------------------------
  for (const p of plant.parts) {
    if (p.dead) continue;
    p.age += dt;
    if (p.kind === 'stem' && !p.hardened && p.age > f.life.hardenAge) {
      p.hardened = true;
      p.hp += f.life.hardenBonus;
      p.maxHp += f.life.hardenBonus;
    }
    if (p.maxAge > 0 && p.age > p.maxAge) killPart(plant, p.id); // needle drops, slot reopens
  }

  // --- Energy: income from leaves, upkeep from everything -------------------
  const toSun = toSunVec(world.sun);
  let income = 0;
  let upkeep = 0;
  let litLeaves = 0;
  let canopyLeaves = 0;
  let shadowLeaves = 0;
  let totalLeaves = 0;
  let aliveParts = 0;
  for (const p of plant.parts) {
    if (p.dead) continue;
    aliveParts++;
    upkeep += f.energy.upkeep[p.kind];
    if (p.kind === 'heart') income += f.energy.heartIncome;
    if (p.kind !== 'leaf') continue;
    totalLeaves++;
    const mid = add(asteroid.pos, add(p.base, scale(p.dir, p.len * 0.5)));
    const shade = shadeAt(mid, toSun, world.asteroids, canopy, plant.id, p.group);
    if (shade !== p.shade) {
      p.shade = shade;
      plant.version++; // lighting changed -> leaf tint must re-render
    }
    if (shade === 0) litLeaves++;
    else if (shade === 1) canopyLeaves++;
    else shadowLeaves++;
    const shadeMult = shade === 0 ? 1 : shade === 1 ? f.energy.canopyShade : f.energy.shadeFloor;
    const angleEff = Math.max(Math.abs(dot(p.dir, toSun)), f.energy.minAngleEff);
    income += f.energy.leafIncome * angleEff * shadeMult;
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

  // --- Growth: one action per cooldown window -------------------------------
  plant.growthCooldown -= dt;
  if (plant.growthCooldown <= 0) {
    if (tryGrow(plant, f, toSun)) {
      plant.growthCooldown = f.growth.actionCooldown;
      plant.version++;
    } else {
      plant.growthCooldown = f.growth.actionCooldown * 0.5; // re-check soon
    }
  }
}

/** Attempt exactly one growth action. Returns true if something grew. */
function tryGrow(plant: Plant, f: FactionDef, toSun: Vec2): boolean {
  const g = f.growth;
  const spendable = plant.energy - f.energy.reserve;

  // 1. Anchor first: roots before anything else.
  if (plant.rootCount < g.rootMax) {
    if (spendable < g.rootCost) return false;
    addRoot(plant, f);
    return true;
  }

  // 2. Photosynthesis before architecture: fill every open needle slot first,
  //    so income always scales with structure and the plant can't bankrupt
  //    itself building a leafless trunk.
  if (leafDeficit(plant, f) > 0 && spendable >= g.leafCost) return addLeaf(plant, f);

  // 3. Extend the trunk (spawns branch buds on schedule).
  if (plant.trunkSegs < g.trunkTarget && spendable >= g.stemCost) {
    extendTrunk(plant, f, toSun);
    return true;
  }

  // 4. Extend a side branch.
  if (spendable >= g.stemCost && extendBranch(plant, f)) return true;

  return false;
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
function rollHp(plant: Plant, f: FactionDef, kind: PartKind): number {
  const v = f.life.hpVariance;
  return f.life.hp[kind] * plant.rng.range(1 - v, 1 + v);
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
  if (p.hp <= 0) killPart(plant, id);
}

/** Starvation cascade: leaves wither first, then wood, the heart last. */
function applyStarvation(plant: Plant, f: FactionDef, dt: number): void {
  const hasAlive = (k: PartKind): boolean =>
    plant.parts.some((p) => !p.dead && p.kind === k);
  let kinds: PartKind[];
  if (hasAlive('leaf')) kinds = ['leaf'];
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

function addRoot(plant: Plant, f: FactionDef): void {
  const g = f.growth;
  const heart = plant.parts[0];
  const side = plant.rootCount === 0 ? -1 : 1;
  const dir = norm(rot(scale(plant.up, -1), side * plant.rng.range(15, 30) * DEG));
  const hp = rollHp(plant, f, 'root');
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
    shade: 0,
    group: 0,
  });
  plant.rootCount++;
  plant.energy -= g.rootCost;
}

function extendTrunk(plant: Plant, f: FactionDef, toSun: Vec2): void {
  const g = f.growth;
  const tip = plant.parts[plant.trunkTip];
  const prevDir = plant.trunkSegs === 0 ? plant.up : tip.dir;
  const noise = fromAngle(plant.rng.range(0, Math.PI * 2));
  const dir = norm(
    add(
      add(scale(prevDir, g.wPrevDir), scale(plant.up, g.wUp)),
      add(scale(toSun, g.wSun), scale(noise, g.wNoise)),
    ),
  );
  const len = g.trunkSegLen * (1 - Math.min(plant.trunkSegs * g.trunkTaper * 0.1, 0.45));
  const base = tip.tip;
  const depth = plant.trunkSegs + 1;
  const hp = rollHp(plant, f, 'stem');
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
    shade: 0,
    group: 0,
  });
  plant.trunkTip = part.id;
  plant.trunkSegs = depth;
  plant.energy -= g.stemCost;

  // Branch buds on schedule: lower branches get more steps (spire silhouette).
  if (depth >= g.branchStartDepth && (depth - g.branchStartDepth) % g.branchEvery === 0) {
    const maxSteps = Math.max(1, Math.min(4, Math.round((g.trunkTarget - depth) / 3)));
    for (const side of [-1, 1]) {
      plant.buds.push({ fromPart: part.id, lastPart: -1, side, steps: 0, maxSteps });
    }
  }
}

function extendBranch(plant: Plant, f: FactionDef): boolean {
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
  const hp = rollHp(plant, f, 'stem');
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

function addLeaf(plant: Plant, f: FactionDef): boolean {
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
    const hp = rollHp(plant, f, 'leaf');
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
      shade: 0,
      group: stem.group, // needles share their branch's occlusion group
    });
    stem.leafCount++;
    plant.energy -= g.leafCost;
    return true;
  }
  return false;
}

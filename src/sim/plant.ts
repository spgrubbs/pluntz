import type { Vec2 } from './vec';
import { add, scale, norm, rot, dot, fromAngle, DEG } from './vec';
import { makeRng } from './rng';
import type { Asteroid, Part, Plant, World, FactionId } from './types';
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
    shade: 0,
    group: 0,
  };
  return {
    id: world.nextId++,
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
  const f = FACTIONS[plant.faction];
  const asteroid = world.asteroids.find((a) => a.id === plant.asteroidId);
  if (!asteroid) return;

  plant.age += dt;
  for (const p of plant.parts) p.age += dt;

  // --- Energy: income from leaves, upkeep from everything -------------------
  const toSun = toSunVec(world.sun);
  let income = 0;
  let upkeep = 0;
  let litLeaves = 0;
  let canopyLeaves = 0;
  let shadowLeaves = 0;
  let totalLeaves = 0;
  for (const p of plant.parts) {
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
  plant.capacity = f.energy.capBase + plant.parts.length * f.energy.capPerPart;
  plant.energy = Math.min(Math.max(plant.energy + (income - upkeep) * dt, 0), plant.capacity);

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
  for (const p of plant.parts) d += Math.max(0, maxLeavesFor(p, f) - p.leafCount);
  return d;
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
    if (stem.kind !== 'stem' || stem.leafCount >= maxLeavesFor(stem, f)) continue;
    const side = stem.leafCount % 2 === 0 ? 1 : -1;
    const t = stem.onBranch ? 0.65 : 0.5;
    const base = add(stem.base, scale(stem.dir, stem.len * t));
    const ang = (g.leafAngleDeg + plant.rng.range(-10, 10)) * DEG;
    const dir = norm(rot(stem.dir, side * ang));
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
      shade: 0,
      group: stem.group, // needles share their branch's occlusion group
    });
    stem.leafCount++;
    plant.energy -= g.leafCost;
    return true;
  }
  return false;
}

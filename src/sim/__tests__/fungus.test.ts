import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld, sproutAt } from '../world';
import { damagePart, pruneAlongPath } from '../plant';
import { TUNING } from '../../content/tuning';
import { add } from '../vec';
import type { MapDef, World } from '../types';

const GLOOM: MapDef = {
  id: 'gloom',
  name: 'gloom',
  width: 1800,
  height: 1400,
  sun: { angleDeg: 225, cycle: false, cyclePeriodSec: 240 },
  asteroids: [
    { x: 0, y: 0, r: 95 },
    { x: 420, y: 60, r: 80 },
  ],
  colonies: [
    { name: 'Gloom', faction: 'basidiomycota', player: true },
    { name: 'Green', faction: 'pinophyta', palette: 1 },
  ],
  spawns: [
    { asteroid: 0, anchorDeg: -90, colony: 0 },
    { asteroid: 1, anchorDeg: -90, colony: 1 },
  ],
};

const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(w, TUNING.simDt);
};

describe('Basidiomycota (M8)', () => {
  it('the web grows without any sunlight at all', () => {
    const w = createWorld(GLOOM, 7);
    w.debrisPerMin = 0;
    // bury the map in permanent night: giant blocker sunward of everything
    w.asteroids[1].radius = 1; // shrink the pinophyta rock out of relevance
    const blocker = { ...w.asteroids[0] };
    w.sunFactor = 1;
    // simplest total-darkness: point the sun and put a huge rock in front
    w.asteroids.push({
      id: w.nextId++,
      pos: add(w.asteroids[0].pos, {
        x: Math.cos(w.sun.angle) * 700,
        y: Math.sin(w.sun.angle) * 700,
      }),
      radius: 600,
      shape: blocker.shape,
      rich: false,
    });
    run(w, 2500);
    const fungus = w.plants[0];
    expect(fungus.alive).toBe(true);
    // the plant is the web now: parts stay few, the claimed arc widens
    expect(fungus.myco).not.toBeNull();
    const startHalf = 34 / 95; // myco.startLen / rock radius
    expect(fungus.myco!.half).toBeGreaterThan(startHalf * 1.5);
    expect(fungus.lastIncome).toBeGreaterThan(fungus.lastUpkeep);
    // fruiting domes surfaced along the claimed ground
    expect(fungus.parts.some((p) => !p.dead && p.kind === 'cone')).toBe(true);
  });

  it('the mycelium is territory: no rival seed roots in claimed ground', () => {
    const w = createWorld(GLOOM, 7);
    w.debrisPerMin = 0;
    run(w, 2000);
    const fungus = w.plants[0];
    const half = fungus.myco!.half;
    // well inside the web's claim: rooting is denied
    const inside = fungus.anchorAngle + half * 0.5;
    expect(sproutAt(w, w.colonies[1].id, 'pinophyta', w.asteroids[0], inside)).toBe(false);
  });

  it('decomposition consumes husks on its rock and feeds the web', () => {
    const w = createWorld(GLOOM, 7);
    w.debrisPerMin = 0;
    // early, before the (now spore-capable) web wraps the rock and claims
    // every angle — plant the victim at the opposite pole while it's free
    run(w, 300);
    const fungus = w.plants[0];
    const baseline = fungus.lastIncome;
    const opposite = fungus.anchorAngle + Math.PI;
    expect(sproutAt(w, w.colonies[1].id, 'pinophyta', w.asteroids[0], opposite)).toBe(true);
    const victim = w.plants[w.plants.length - 1];
    run(w, 600); // let it grow some biomass
    damagePart(victim, 0, 9999); // heart death -> whole plant husks
    run(w, 30);
    expect(fungus.lastIncome).toBeGreaterThan(baseline + 1); // the feast
    const biomass = (): number =>
      victim.parts.reduce((n, p) => n + Math.max(p.maxHp, 0), 0);
    const b0 = biomass();
    run(w, 300);
    expect(biomass()).toBeLessThan(b0); // the husk is being eaten away
  });

  it('spores infect living rivals; infection spreads; prune cures it', () => {
    const w = createWorld(GLOOM, 7);
    w.debrisPerMin = 0;
    // silence the fungus itself so the only spore in play is ours — its
    // organic bombardment (now that launches work) would drown the readings
    damagePart(w.plants[0], 0, 9999);
    run(w, 2000);
    const victim = w.plants[1];
    expect(victim.alive).toBe(true);
    // fire a spore straight into the rival crown
    const crown = add(victim.astPos, victim.parts[victim.trunkTip].tip);
    w.seeds.push({
      id: w.nextId++,
      colonyId: w.colonies[0].id,
      faction: 'basidiomycota',
      pos: { x: crown.x, y: crown.y - 100 },
      vel: { x: 0, y: 55 },
      age: 0,
      maxAge: 6,
      riding: -1,
      ridingFauna: -1,
      heir: false,
      steers: 0,
      ignoreAst: -1,
    });
    run(w, 40);
    const infected = (): number =>
      victim.parts.filter((p) => !p.dead && p.infectedBy >= 0).length;
    expect(infected()).toBeGreaterThan(0);
    const before = infected();
    run(w, 120); // 12s: at least two spread ticks
    expect(infected()).toBeGreaterThan(before);
    // prune every infected part off — the cure
    for (const p of victim.parts) {
      if (!p.dead && p.infectedBy >= 0) {
        const mid = add(victim.astPos, {
          x: (p.base.x + p.tip.x) / 2,
          y: (p.base.y + p.tip.y) / 2,
        });
        pruneAlongPath(w, victim, [
          { x: mid.x - 30, y: mid.y },
          { x: mid.x + 30, y: mid.y },
        ]);
      }
    }
    expect(infected()).toBe(0);
  });

  it('spores clear their own launch rock instead of face-planting into it', () => {
    const w = createWorld(GLOOM, 7);
    w.debrisPerMin = 0;
    const rock = w.asteroids[0];
    // a fresh spore born right ON the surface (like a dome launch), aimed
    // tangentially so its early flight skims its own rock
    w.seeds.push({
      id: w.nextId++,
      colonyId: w.colonies[0].id,
      faction: 'basidiomycota',
      pos: { x: rock.pos.x, y: rock.pos.y - rock.radius - 2 }, // grazing height
      vel: { x: 80, y: -4 },
      age: 0,
      maxAge: 6,
      riding: -1,
      ridingFauna: -1,
      heir: false,
      steers: 0,
      ignoreAst: rock.id,
    });
    const id = w.seeds[w.seeds.length - 1].id;
    run(w, 8); // 0.8s: inside the grace window, skimming the surface
    expect(w.seeds.some((s2) => s2.id === id)).toBe(true); // still flying
  });

  it('the dying sun feeds the fungus (inverted sudden death)', () => {
    const w = createWorld(GLOOM, 7);
    w.debrisPerMin = 0;
    run(w, 2000);
    const fungus = w.plants[0];
    const brightIncome = fungus.lastIncome;
    w.roundSec = 1; // trigger the fade
    run(w, 1400); // fade complete (120s ramp)
    expect(w.sunFactor).toBeLessThan(0.2);
    expect(fungus.lastIncome).toBeGreaterThan(brightIncome);
  });
});
